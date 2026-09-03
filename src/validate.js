'use strict';

const MAX = { name: 80, phone: 30, petType: 30, service: 120, preferredTime: 60, message: 1000 };

const PET_TYPES = ['Кіт', 'Собака', 'Інша тварина'];
const AGE_UNITS = ['місяців', 'років'];

function clean(value, limit) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

/**
 * Український відмінок числівника: 1 рік, 2 роки, 5 років.
 */
function plural(n, one, few, many) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function formatAge(rawAge, rawUnit) {
  const n = parseInt(String(rawAge ?? '').replace(/\D/g, ''), 10);
  if (isNaN(n) || n < 0 || n > 30) return '';

  const unit = AGE_UNITS.includes(rawUnit) ? rawUnit : 'років';
  return unit === 'місяців'
    ? `${n} ${plural(n, 'місяць', 'місяці', 'місяців')}`
    : `${n} ${plural(n, 'рік', 'роки', 'років')}`;
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
    petAge: formatAge(body.petAge, clean(body.petAgeUnit, 12)),
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

  return { errors, lead };
}

module.exports = { validateLead, formatAge, plural };
