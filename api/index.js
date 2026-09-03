'use strict';

// Точка входу для Vercel: serverless-функція очікує експортований
// обробник, а не процес, що слухає порт. Сам застосунок описаний
// у server.js — він же працює і як звичайний сервер (`npm start`).
module.exports = require('../server.js');
