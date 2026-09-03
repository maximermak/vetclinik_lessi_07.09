'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');

const { clinic, services, grooming, advantages, reviews, faq, serviceOptions } = require('./src/data');
const { validateLead } = require('./src/validate');
const { sendLead } = require('./src/telegram');

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

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
  res.render('index', { clinic, services, grooming, advantages, reviews, faq, serviceOptions });
});

app.post('/api/lead', leadLimiter, async (req, res) => {
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

app.get('/health', (req, res) => {
  res.json({ ok: true, telegram: Boolean(TOKEN && CHAT_ID) });
});

app.use((req, res) => {
  res.status(404).render('404', { clinic });
});

app.listen(PORT, () => {
  console.log(`\n  🐾 Pussy Cat — http://localhost:${PORT}\n`);
  if (!TOKEN || !CHAT_ID) {
    console.warn('  ⚠️  Заявки не підуть у Telegram: заповніть TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID у .env');
    console.warn('     Підказка: напишіть боту повідомлення та виконайте `npm run chat-id`\n');
  }
});
