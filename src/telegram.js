'use strict';

const API = 'https://api.telegram.org';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Заявка -> текст повідомлення для чату клініки.
 */
function formatLead(lead) {
  const petIcon = lead.petType === 'Собака' ? '🐕' : lead.petType === 'Кіт' ? '🐈' : '🐾';

  const rows = [
    ['👤 Ім’я', lead.name],
    ['📞 Телефон', lead.phone],
    [`${petIcon} Тварина`, lead.petType],
    ['🎂 Вік', lead.petAge],
    ['🩺 Послуга', lead.service],
    ['🗓 Бажаний час', lead.preferredTime],
    ['💬 Коментар', lead.message]
  ];

  const body = rows
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: <b>${escapeHtml(value)}</b>`)
    .join('\n');

  const when = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });

  return `🐶🐱 <b>Нова заявка з сайту Pussy Cat</b>\n\n${body}\n\n🕒 ${escapeHtml(when)}`;
}

async function sendLead(lead, { token, chatId, timeoutMs = 10000 } = {}) {
  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не налаштовані');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatLead(lead),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
      signal: controller.signal
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(`Telegram API: ${data.description || res.status}`);
    }
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendLead, formatLead, escapeHtml };
