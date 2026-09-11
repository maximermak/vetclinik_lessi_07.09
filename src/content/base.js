'use strict';

/**
 * Факти, що не залежать від мови: контакти, координати, графік.
 * Мовні файли (uk.js, ru.js) домішують сюди свої тексти.
 *
 * Тримати це в одному місці критично: інакше телефон або адреса
 * рано чи пізно розійдуться між українською й російською версіями,
 * і Google побачить два різні заклади замість одного.
 */

// Place ID вирахувано з посилання на картку клініки в Google Maps
// (пара 0x4127a786a9db986b:0xfa2b1f2f3c496ae7 з URL).
const GOOGLE_PLACE_ID = 'ChIJa5jbqYanJ0ER52pJPC8fK_o';
// Назва саме така, як у картці Google, — щоб пошук вів на неї, а не на однойменні.
const GOOGLE_QUERY = 'Ветклиника "Лесси" Харків';

const LANGS = ['uk', 'ru'];
const DEFAULT_LANG = 'uk';

const base = {
  // Назва теж залежить від мови: у картці Google клініка зветься
  // «Лесси», і саме це написання шукають російською.
  name: { uk: 'Лессі', ru: 'Лесси' },
  // Як клініка записана в інших місцях. Це не вигадані ключові слова:
  // у картці Google вона зветься саме «Ветклиника "Лесси"», і половина
  // міста шукає її російською.
  alternateNames: ['Ветклиника "Лесси"', 'Лесси', 'Ветклініка Лессі'],

  phones: [
    { raw: '+380974081632', pretty: '+38 (097) 408-16-32', person: { uk: 'Сергій', ru: 'Сергей' } }
  ],
  email: 'vetklinikalessi25@gmail.com',

  // Координати з картки Google — власник підтвердив, що маркер там
  // стоїть правильно. Геокодер за адресою «Нескорених, 6» давав точку
  // на 120 м північніше; довіряємо картці, а не геокодеру.
  geo: { lat: 50.0250839, lng: 36.3275757 },
  postalCode: '61168',

  googleReviewsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(GOOGLE_QUERY) +
    '&query_place_id=' + GOOGLE_PLACE_ID,
  placeId: GOOGLE_PLACE_ID,

  // Рейтинг показуємо ЛИШЕ живий — з Google Places API (потрібен
  // GOOGLE_MAPS_API_KEY у .env). Без ключа цифри просто не виводяться:
  // вигадувати оцінку не можна, а старі цифри швидко стають неправдою.
  rating: null,
  reviewsCount: null,

  // Години однакові для всіх мов; підписи днів — у мовних файлах.
  opens: '09:00',
  closes: '19:00',
  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],

  // Дата останньої змістовної правки контенту — йде в sitemap.xml.
  contentUpdated: '2026-09-11',

  legal: {
    entity: { uk: 'ФОП Круговий Сергій Анатолійович', ru: 'ФЛП Круговой Сергей Анатольевич' },
    // code поки немає: якщо він null, рядок із кодом просто не виводиться —
    // краще, ніж показувати відвідувачам заглушку в дужках.
    // TODO: підставити РНОКПП, коли клієнт його надасть.
    code: null,
    email: 'vetklinikalessi25@gmail.com',
    updated: { uk: '11 вересня 2026 року', ru: '11 сентября 2026 года' }
  }
};

// Графік у машинному вигляді: 0 = неділя ... 6 = субота.
// Використовується календарем вибору часу візиту.
const DAY_INDEX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6
};

const scheduleByWeekday = {};
base.dayOfWeek.forEach((day) => {
  scheduleByWeekday[DAY_INDEX[day]] = { opens: base.opens, closes: base.closes };
});

/** Розгортає поля виду { uk: …, ru: … } у значення однієї мови. */
function pick(value, lang) {
  if (Array.isArray(value)) return value.map((v) => pick(v, lang));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const keys = Object.keys(value);
    if (keys.length && keys.every((k) => LANGS.includes(k))) return value[lang];
    const out = {};
    keys.forEach((k) => { out[k] = pick(value[k], lang); });
    return out;
  }
  return value;
}

module.exports = { base, scheduleByWeekday, pick, LANGS, DEFAULT_LANG };
