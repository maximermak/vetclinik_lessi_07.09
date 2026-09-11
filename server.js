'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  clinic, services, smallPets, advantages, reviews, faq,
  serviceOptions, petAgeOptions, scheduleByWeekday
} = require('./src/data');
const { validateLead, plural } = require('./src/validate');
const { sendLead } = require('./src/telegram');
const googleRating = require('./src/googleRating');

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
// абсолютний адрес потрібен для og:image — соцмережі не розуміють відносні.
// На Vercel, якщо SITE_URL не заданий, беремо домен самого деплою.
const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  `http://localhost:${PORT}`
).replace(/\/$/, '');

// Express за замовчуванням підписується заголовком X-Powered-By.
// Користі нуль, а зловмиснику це підказка, під що добирати вразливості.
app.disable('x-powered-by');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.locals.siteUrl = SITE_URL;
// Порожній рядок = аналітики немає. Саме так і має бути локально.
app.locals.gaId = (process.env.GA_MEASUREMENT_ID || '').trim();

app.locals.plural = function (n, one, few, many) {
  return plural(parseInt(n, 10) || 0, one, few, many);
};

// ?v=... — щоб браузер не тримав старий CSS/JS після правок.
// Локально мітка = час зміни файлу. На Vercel файли з public/ віддає CDN
// і їх немає в бандлі функції, тому там міткою слугує ідентифікатор
// деплою: він новий на кожен реліз, тобто кеш скидається так само.
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_URL || '')
  .replace(/[^a-z0-9]/gi, '')
  .slice(0, 12);

app.locals.v = function (file) {
  if (BUILD_ID) return BUILD_ID;
  try {
    return String(Math.floor(fs.statSync(path.join(__dirname, 'public', file)).mtimeMs));
  } catch (err) {
    return '1';
  }
};

app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));

/**
 * Хто відправник — з погляду ліміту заявок.
 *
 * За Cloudflare до застосунку доходить ланцюжок «відвідувач → Cloudflare →
 * Caddy», і req.ip у ньому вказує на Cloudflare, а не на людину. Без цієї
 * функції всі відвідувачі потрапляли б в одне відро: після п'ятої заявки
 * форма замовкла б для всіх одразу.
 *
 * CF-Connecting-IP ставить сам Cloudflare. Підмінити його може лише той,
 * хто стукає в origin повз Cloudflare, знаючи IP сервера, — для форми
 * запису такий ризик прийнятний.
 *
 * IPv6 ріжемо до /64: провайдер видає абоненту цілу підмережу, і без
 * цього обійти ліміт можна було б, просто змінюючи останні групи адреси.
 */
function clientKey(req) {
  const ip = String(req.headers['cf-connecting-ip'] || req.ip || '');
  if (!ip.includes(':')) return ip;
  return ip.split(':').slice(0, 4).join(':');
}

const leadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { ok: false, error: 'Забагато заявок з цієї адреси. Спробуйте за 10 хвилин або зателефонуйте нам.' }
});

app.get('/', (req, res) => {
  // рейтинг береться з кешу Google, якщо він є, інакше — з data.js
  const live = googleRating.get(clinic);
  const clinicNow = Object.assign({}, clinic, {
    rating: live.rating,
    reviewsCount: live.reviewsCount
  });

  res.render('index', {
    clinic: clinicNow, services, smallPets, advantages, reviews, faq,
    serviceOptions, petAgeOptions, scheduleByWeekday
  });
});

// Два шляхи навмисно: на Vercel тека api/ зарезервована під функції,
// тому основним для клієнта служить /lead, а /api/lead лишається
// сумісності заради (і працює на будь-якому іншому хостингу).
app.post(['/lead', '/api/lead'], leadLimiter, async (req, res) => {
  // Приманка для ботів: люди це поле не бачать і не заповнюють.
  if (req.body.website) {
    return res.json({ ok: true });
  }

  const { errors, lead } = validateLead(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  try {
    await sendLead(lead, { token: TOKEN, chatId: CHAT_ID });
    res.json({ ok: true });
  } catch (err) {
    console.error('[lead] не вдалось надіслати в Telegram:', err.message);
    console.error('[lead] заявка:', lead);
    res.status(502).json({
      ok: false,
      error: 'Не вдалось надіслати заявку. Зателефонуйте, будь ласка, за номером ' + clinic.phones[0].pretty
    });
  }
});

// Сторінка з візитки: коротка адреса, щоб QR-код вийшов простим
// і сканувався навіть з надрукованого дрібно квадрата.
app.get('/qr', (req, res) => {
  res.render('qr', { clinic, serviceOptions, petAgeOptions, scheduleByWeekday });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { clinic });
});

// ─── SEO / GEO ──────────────────────────────────────────────
// Віддаємо з застосунку, а не файлом у public/: усередині потрібен
// абсолютний домен, а він відомий лише під час виконання (SITE_URL).

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    'User-agent: *\n' +
    'Allow: /\n' +
    '\n' +
    // Cloudflare підмішує власний «керований» блок ПЕРЕД цим файлом і
    // забороняє там Google-Extended — агента, що керує використанням
    // вмісту в Gemini та Vertex. Змінити той блок можна лише в панелі
    // Cloudflare. Звідси ми можемо його перебити: за RFC 9309 групи з
    // однаковим агентом об'єднуються, а при однаковій довжині шляху
    // Allow має перевагу над Disallow.
    'User-agent: Google-Extended\n' +
    'Allow: /\n' +
    '\n' +
    // Сторінка політики має noindex, тож у карті сайту її немає.
    'Sitemap: ' + SITE_URL + '/sitemap.xml\n'
  );
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url>\n' +
    '    <loc>' + SITE_URL + '/</loc>\n' +
    '    <lastmod>' + clinic.contentUpdated + '</lastmod>\n' +
    '    <changefreq>monthly</changefreq>\n' +
    '    <priority>1.0</priority>\n' +
    '  </url>\n' +
    '</urlset>\n'
  );
});

// llms.txt — стисла вижимка фактів для генеративних пошукових систем.
// Формується з тих самих даних, що й сайт, тож не розходиться з ним.
app.get('/llms.txt', (req, res) => {
  const phone = clinic.phones[0];
  const lines = [
    '# Ветеринарна клініка «' + clinic.name + '»',
    '',
    'Інші написання назви: ' + clinic.alternateNames.join(', ') + '.',
    '',
    '> ' + clinic.tagline + ' у ' + clinic.cityIn + '. Приймає котів, собак, ' +
      'морських свинок, кроликів і гризунів. Працює щодня без вихідних.',
    '',
    '## Факти',
    '',
    '- Адреса: ' + clinic.addressFull + ' (' + clinic.addressOld + '), район ' + clinic.district +
      ', поруч зі станцією метро «' + clinic.metro + '»',
    '- Координати: ' + clinic.geo.lat + ', ' + clinic.geo.lng,
    '- Телефон: ' + phone.pretty + (phone.person ? ' (' + phone.person + ')' : ''),
    ...(clinic.email ? ['- Пошта: ' + clinic.email] : []),
    '- Графік: ' + clinic.scheduleShort + ', без вихідних і свят',
    '- Запис: онлайн на сайті або телефоном; гострі стани — без запису',
    '- Google Maps: ' + clinic.googleReviewsUrl,
    '',
    '## Послуги',
    '',
    ...services.map((x) => '- ' + x.title + ' — ' + x.text),
    '',
    '## Яких тварин приймають',
    '',
    ...smallPets.filter((x) => !x.cta).map((x) => '- ' + x.title + ' — ' + x.text),
    '',
    '## Часті питання',
    '',
    ...faq.flatMap((f) => ['### ' + f.q, '', f.a, '']),
    '## Чого на цьому сайті немає',
    '',
    '- Рейтинг і відгуки не наводяться як зведена оцінка: актуальні дані —',
    '  лише на сторінці клініки в Google Maps за посиланням вище.',
    '- Ціни на сайті не публікуються: вартість залежить від обсягу допомоги',
    '  і озвучується до початку прийому.',
    ''
  ];
  res.type('text/plain').send(lines.join('\n'));
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    telegram: Boolean(TOKEN && CHAT_ID),
    googleRating: googleRating.get(clinic)
  });
});

app.use((req, res) => {
  res.status(404).render('404', { clinic });
});

function startServer() {
  return app.listen(PORT, () => {
    console.log(`\n  🐾 Лессі — http://localhost:${PORT}\n`);

    const liveRating = googleRating.start({ placeId: clinic.placeId, apiKey: GOOGLE_KEY });
    if (!liveRating) {
      console.log('  ℹ️  Рейтинг у шапці не показуємо: немає живих даних з Google.');
      console.log('     Щоб він з\'явився, додайте GOOGLE_MAPS_API_KEY у .env\n');
    }
    if (!TOKEN || !CHAT_ID) {
      console.warn('  ⚠️  Заявки не підуть у Telegram: заповніть TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID у .env');
      console.warn('     Підказка: напишіть боту повідомлення та виконайте `npm run chat-id`\n');
    }
  });
}

// Постійний процес (npm start, Railway, VPS) — слухаємо порт і тримаємо
// таймер оновлення рейтингу. На Vercel файл підключається як модуль:
// там порту немає, а рейтинг освіжається ліниво, у googleRating.get().
if (require.main === module) {
  startServer();
} else {
  googleRating.start({ placeId: clinic.placeId, apiKey: GOOGLE_KEY, background: false });
}

module.exports = app;
module.exports.startServer = startServer;
