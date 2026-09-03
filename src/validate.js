'use strict';

const MAX = { name: 80, phone: 30, pet: 80, service: 120, preferredTime: 60, message: 1000 };

function clean(value, limit) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

/**
 * Валідація заявки. Повертає { errors, lead }.
 */
function validateLead(body) {
  const lead = {
    name: clean(body.name, MAX.name),
    phone: clean(body.phone, MAX.phone),
    pet: clean(body.pet, MAX.pet),
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

module.exports = { validateLead };
