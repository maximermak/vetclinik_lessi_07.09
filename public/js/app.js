(function () {
  'use strict';

  /* ── Мобільне меню ─────────────────────────────────────── */
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('nav');

  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── Тінь у шапки при скролі ───────────────────────────── */
  var header = document.querySelector('.header');
  var onScroll = function () {
    if (header) header.classList.toggle('header--stuck', window.scrollY > 10);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Поява блоків при прокрутці ────────────────────────── */
  var revealables = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 });
    revealables.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      io.observe(el);
    });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ── Підсвітка активного пункту меню ───────────────────── */
  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
  var links = {};
  document.querySelectorAll('.nav a[href^="#"]').forEach(function (a) {
    links[a.getAttribute('href').slice(1)] = a;
  });
  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = links[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          Object.keys(links).forEach(function (k) { links[k].classList.remove('is-active'); });
          link.classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ── Маска телефону ────────────────────────────────────── */
  var phone = document.getElementById('f-phone');
  if (phone) {
    var format = function (raw) {
      var d = raw.replace(/\D/g, '');
      if (d.startsWith('380')) d = d.slice(2);
      else if (d.startsWith('80')) d = d.slice(1);
      else if (!d.startsWith('0') && d.length) d = '0' + d;
      d = d.slice(0, 10);
      if (!d) return '';
      var out = '+38 (' + d.slice(0, 3);
      if (d.length >= 3) out += ')';
      if (d.length > 3) out += ' ' + d.slice(3, 6);
      if (d.length > 6) out += '-' + d.slice(6, 8);
      if (d.length > 8) out += '-' + d.slice(8, 10);
      return out;
    };
    phone.addEventListener('input', function () {
      var atEnd = phone.selectionStart === phone.value.length;
      phone.value = format(phone.value);
      if (atEnd) phone.setSelectionRange(phone.value.length, phone.value.length);
    });
    phone.addEventListener('focus', function () {
      if (!phone.value) phone.value = '+38 (';
    });
    phone.addEventListener('blur', function () {
      if (phone.value.replace(/\D/g, '').length <= 2) phone.value = '';
    });
  }

  /* ── Відправка заявки ──────────────────────────────────── */
  var form = document.getElementById('leadForm');
  if (!form) return;

  var wrap = form.parentElement;
  var done = wrap.querySelector('.form__done');
  var status = form.querySelector('.form__status');
  var label = form.querySelector('.btn__label');
  var labelText = label ? label.textContent : '';

  var clearErrors = function () {
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('has-error'); });
    form.querySelectorAll('.err').forEach(function (e) { e.textContent = ''; });
    status.textContent = '';
  };

  var showErrors = function (errors) {
    Object.keys(errors).forEach(function (key) {
      var slot = form.querySelector('[data-err="' + key + '"]');
      if (slot) {
        slot.textContent = errors[key];
        slot.closest('.field').classList.add('has-error');
      }
    });
    var first = form.querySelector('.has-error input');
    if (first) first.focus();
  };

  form.addEventListener('input', function (e) {
    var field = e.target.closest('.field');
    if (field && field.classList.contains('has-error')) {
      field.classList.remove('has-error');
      var slot = field.querySelector('.err');
      if (slot) slot.textContent = '';
    }
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearErrors();

    var payload = Object.fromEntries(new FormData(form).entries());

    form.classList.add('is-sending');
    if (label) label.textContent = 'Надсилаємо…';

    try {
      var res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await res.json().catch(function () { return {}; });

      if (res.ok && data.ok) {
        form.reset();
        form.hidden = true;
        done.hidden = false;
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (data.errors) showErrors(data.errors);
      else status.textContent = data.error || 'Щось пішло не так. Спробуйте ще раз або зателефонуйте нам.';
    } catch (err) {
      status.textContent = 'Немає зв’язку з сервером. Перевірте інтернет або зателефонуйте нам.';
    } finally {
      form.classList.remove('is-sending');
      if (label) label.textContent = labelText;
    }
  });

  var resetBtn = done ? done.querySelector('[data-reset]') : null;
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      done.hidden = true;
      form.hidden = false;
      clearErrors();
      form.querySelector('input').focus();
    });
  }
})();
