'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  clinic, services, grooming, advantages, reviews, faq,
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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.locals.siteUrl = SITE_URL;

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

const leadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
    clinic: clinicNow, services, grooming, advantages, reviews, faq,
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

app.get('/privacy', (req, res) => {
  res.render('privacy', { clinic });
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
    console.log(`\n  🐾 Pussy Cat — http://localhost:${PORT}\n`);

    const liveRating = googleRating.start({ placeId: clinic.placeId, apiKey: GOOGLE_KEY });
    if (!liveRating) {
      console.log(`  ℹ️  Рейтинг показуємо з data.js (${clinic.rating}, ${clinic.reviewsCount} відгуків).`);
      console.log('     Для автооновлення додайте GOOGLE_MAPS_API_KEY у .env\n');
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
