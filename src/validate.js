'use strict';

const MAX = { name: 80, phone: 30, petType: 30, petName: 40, petAge: 30, service: 120, preferredTime: 60, message: 1000 };

const PET_TYPES = ['Кіт', 'Собака', 'Інша тварина'];

function clean(value, limit) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

/**
 * Український відмінок числівника: 1 рік, 2 роки, 5 років.
 * Використовується шаблонами (кількість відгуків у Google).
 */
function plural(n, one, few, many) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/**
 * Валідація заявки. Повертає { errors, lead }.
 */
function validateLead(body) {
  const petType = clean(body.petType, MAX.petType);

  const lead = {
    name: clean(body.name, MAX.name),
    phone: clean(body.phone, MAX.phone),
    petType: PET_TYPES.includes(petType) ? petType : '',
    petName: clean(body.petName, MAX.petName),
    petAge: clean(body.petAge, MAX.petAge),
    service: clean(body.service, MAX.service),
    preferredTime: clean(body.preferredTime, MAX.preferredTime),
    message: clean(body.message, MAX.message)
  };

  const errors = {};

  if (lead.name.length < 2) {
    errors.name = 'Вкажіть, будь ласка, ім’я';
  }

  const digits = lead.phone.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    errors.phone = 'Вкажіть коректний номер телефону';
  }

  // згоду перевіряємо і на сервері: у браузері required можна обійти
  if (body.consent !== 'yes' && body.consent !== 'on' && body.consent !== true) {
    errors.consent = 'Потрібна згода на обробку персональних даних';
  }

  return { errors, lead };
}

module.exports = { validateLead, plural };
