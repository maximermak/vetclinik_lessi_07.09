'use strict';

/**
 * Контент сайту у двох мовах.
 *
 * Тексти лежать у src/content/uk.js і ru.js, спільні факти (телефон,
 * координати, графік, реквізити) — у base.js. Тут вони склеюються
 * у готовий набір для шаблонів.
 *
 * Чому так: контакти мають бути в одному місці. Якби кожна мовна
 * версія тримала свій телефон і адресу, вони б рано чи пізно
 * розійшлися — і Google побачив би два різні заклади замість одного.
 */

const { base, scheduleByWeekday, pick, LANGS, DEFAULT_LANG } = require('./content/base');

const bundles = { uk: require('./content/uk'), ru: require('./content/ru') };

/** Підставляє {назви} у рядок: fill('{name} у {city}', { name, city }). */
function fill(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, function (m, k) {
    return (vars && k in vars) ? vars[k] : m;
  });
}

const cache = {};

/** Готовий набір даних для однієї мови. */
function get(lang) {
  const code = LANGS.indexOf(lang) >= 0 ? lang : DEFAULT_LANG;
  if (cache[code]) return cache[code];

  const b = bundles[code];
  const shared = pick(base, code);

  const clinic = Object.assign({}, shared, b.clinic, {
    schedule: [{
      days: b.clinic.scheduleDays,
      hours: b.clinic.scheduleHours,
      dayOfWeek: shared.dayOfWeek,
      opens: shared.opens,
      closes: shared.closes
    }]
  });

  cache[code] = {
    lang: code,
    otherLang: code === 'uk' ? 'ru' : 'uk',
    clinic: clinic,
    services: b.services,
    smallPets: b.smallPets,
    advantages: b.advantages,
    reviews: b.reviews,
    faq: b.faq,
    petAgeOptions: b.petAgeOptions,
    serviceOptions: b.services.map(function (s) { return s.title; }).concat(b.serviceExtra),
    scheduleByWeekday: scheduleByWeekday,
    // текст політики лежить поруч із написами інтерфейсу: шаблон
    // звертається до нього як t.legal, а clinic.legal — це реквізити
    t: Object.assign({}, b.ui, { legal: b.legal }),
    fill: fill
  };
  return cache[code];
}

/**
 * Шлях до сторінки потрібною мовою.
 * Українська лишається в корені: це основна версія, її адреси вже
 * пішли в пошук і на візитку — переносити їх під /uk не можна.
 */
function path(lang, page) {
  const p = page || '/';
  if (lang === DEFAULT_LANG) return p;
  return p === '/' ? '/' + lang : '/' + lang + p;
}

module.exports = { get: get, path: path, fill: fill, LANGS: LANGS, DEFAULT_LANG: DEFAULT_LANG, scheduleByWeekday: scheduleByWeekday };
