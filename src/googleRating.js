'use strict';

/**
 * Рейтинг клініки з Google Places API (New).
 *
 * Працює лише якщо в .env заданий GOOGLE_MAPS_API_KEY. Без ключа модуль
 * мовчки віддає запасні цифри з src/data.js — сайт від цього не ламається.
 *
 * Дані оновлюються у фоні за таймером, тому жоден запит користувача
 * ніколи не чекає на відповідь Google.
 */

const ENDPOINT = 'https://places.googleapis.com/v1/places/';
const REFRESH_MS = 12 * 60 * 60 * 1000; // двічі на добу

let cache = null;      // { rating, reviewsCount, fetchedAt }
let timer = null;

async function fetchFromGoogle(placeId, apiKey, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${ENDPOINT}${placeId}?languageCode=uk`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'rating,userRatingCount'
      },
      signal: controller.signal
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error?.message || `HTTP ${res.status}`);
    }
    if (typeof data.rating !== 'number' || typeof data.userRatingCount !== 'number') {
      throw new Error('відповідь без rating / userRatingCount');
    }

    return {
      rating: data.rating.toFixed(1).replace('.', ','),
      reviewsCount: String(data.userRatingCount),
      fetchedAt: new Date()
    };
  } finally {
    clearTimeout(t);
  }
}

async function refresh({ placeId, apiKey }) {
  try {
    cache = await fetchFromGoogle(placeId, apiKey);
    console.log(`  ⭐ Google: рейтинг ${cache.rating}, відгуків ${cache.reviewsCount}`);
  } catch (err) {
    console.warn('  ⚠️  Не вдалось оновити рейтинг з Google:', err.message);
  }
}

let config = null;      // { placeId, apiKey }
let inFlight = false;

/**
 * Вмикає оновлення. За наявності постійного процесу (background: true)
 * тримає таймер; у serverless таймер між викликами не виживає, тому там
 * дані освіжаються ліниво — при першому запиті після протухання кешу.
 */
function start({ placeId, apiKey, background = true }) {
  if (!apiKey || !placeId) return false;
  config = { placeId, apiKey };

  refresh(config);
  if (background) {
    timer = setInterval(() => refresh(config), REFRESH_MS);
    timer.unref?.();
  }
  return true;
}

/** Оновлює у фоні, якщо кеш протух. Запит користувача не чекає. */
function refreshIfStale() {
  if (!config || inFlight) return;
  if (cache && Date.now() - cache.fetchedAt.getTime() < REFRESH_MS) return;

  inFlight = true;
  refresh(config).finally(() => { inFlight = false; });
}

/** Свіжі цифри або запасні з data.js. */
function get(fallback) {
  refreshIfStale();
  if (!cache) return { rating: fallback.rating, reviewsCount: fallback.reviewsCount, live: false };
  return { rating: cache.rating, reviewsCount: cache.reviewsCount, live: true };
}

module.exports = { start, get, refresh };
