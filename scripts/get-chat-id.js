'use strict';

/**
 * Допоміжний скрипт: показує chat_id усіх, хто писав боту.
 * Використання: напишіть боту «привіт» у Telegram, потім `npm run chat-id`.
 */
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не заданий у .env');
  process.exit(1);
}

(async () => {
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = await meRes.json();
  if (!me.ok) {
    console.error('❌ Токен недійсний:', me.description);
    process.exit(1);
  }
  console.log(`✅ Бот: @${me.result.username} (${me.result.first_name})\n`);

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = await res.json();

  if (!data.ok) {
    console.error('❌ getUpdates:', data.description);
    process.exit(1);
  }

  const chats = new Map();
  for (const update of data.result) {
    const msg = update.message || update.channel_post || update.my_chat_member;
    if (msg?.chat) chats.set(msg.chat.id, msg.chat);
  }

  if (!chats.size) {
    console.log('Поки що немає повідомлень.');
    console.log(`Відкрийте https://t.me/${me.result.username}, натисніть «Start» і запустіть скрипт ще раз.`);
    console.log('Для групи: додайте бота в групу та напишіть там будь-що.');
    return;
  }

  console.log('Знайдені чати — скопіюйте потрібний ID у .env (TELEGRAM_CHAT_ID):\n');
  for (const chat of chats.values()) {
    const title = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ');
    console.log(`  ${chat.id}\t${chat.type}\t${title}${chat.username ? ' @' + chat.username : ''}`);
  }
  console.log('');
})().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
