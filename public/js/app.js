(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ── Мобільне меню ─────────────────────────────────────── */
  var burger = $('.burger');
  var nav = $('#nav');

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
  var header = $('.header');
  var onScroll = function () {
    if (header) header.classList.toggle('header--stuck', window.scrollY > 10);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Поява блоків при прокрутці ────────────────────────── */
  var revealables = $$('.reveal');
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
  var sections = $$('main section[id]');
  var links = {};
  $$('.nav a[href^="#"]').forEach(function (a) {
    links[a.getAttribute('href').slice(1)] = a;
  });
  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = links[entry.target.id];
        if (!link || !entry.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.remove('is-active'); });
        link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ── Сегментований перемикач «Кіт / Собака / Інша» ─────── */
  function initSegmented(root) {
    var opts = $$('input[type="radio"]', root);
    var sync = function () {
      opts.forEach(function (input, i) {
        if (input.checked) root.style.setProperty('--seg', i);
      });
    };
    opts.forEach(function (input) { input.addEventListener('change', sync); });
    sync();
  }

  /* ── Лічильник віку ────────────────────────────────────── */
  function initStepper(root) {
    var input = $('.stepper__val', root);
    var MAX = 30;

    var read = function () {
      var n = parseInt(input.value, 10);
      return isNaN(n) ? null : n;
    };

    var write = function (n, animate) {
      input.value = n === null ? '' : String(n);
      $$('.stepper__btn', root).forEach(function (b) {
        var dir = Number(b.dataset.step);
        b.disabled = n !== null && ((dir < 0 && n <= 0) || (dir > 0 && n >= MAX));
      });
      if (!animate) return;
      input.classList.remove('is-bumped');
      void input.offsetWidth; // перезапуск анімації
      input.classList.add('is-bumped');
    };

    $$('.stepper__btn', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var current = read();
        var next = current === null ? (Number(btn.dataset.step) > 0 ? 1 : 0)
                                    : current + Number(btn.dataset.step);
        write(Math.min(MAX, Math.max(0, next)), true);
      });
    });

    input.addEventListener('input', function () {
      input.value = input.value.replace(/\D/g, '').slice(0, 2);
      write(read(), false);
    });

    write(read(), false);
  }

  /* ── Власний випадний список ───────────────────────────── */
  function initDropdown(root) {
    var btn = $('.dropdown__btn', root);
    var list = $('.dropdown__list', root);
    var hidden = $('input[type="hidden"]', root);
    var valueEl = $('.dropdown__value', root);
    var opts = $$('.dropdown__opt', root);
    var cursor = -1;

    var moveCursor = function (i) {
      opts.forEach(function (o) { o.classList.remove('is-cursor'); });
      cursor = i;
      if (i < 0) return;
      opts[i].classList.add('is-cursor');
      opts[i].scrollIntoView({ block: 'nearest' });
    };

    var open = function () {
      root.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      moveCursor(opts.findIndex(function (o) { return o.getAttribute('aria-selected') === 'true'; }));
      // у модалці форма прокручується — показуємо список повністю
      setTimeout(function () { list.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 60);
    };

    var close = function () {
      root.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      moveCursor(-1);
    };

    var pick = function (opt) {
      opts.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
      opt.setAttribute('aria-selected', 'true');
      hidden.value = opt.dataset.value;
      valueEl.textContent = opt.dataset.value;
      valueEl.classList.remove('is-placeholder');
      close();
      btn.focus();
    };

    btn.addEventListener('click', function () {
      root.classList.contains('is-open') ? close() : open();
    });

    opts.forEach(function (opt) {
      opt.addEventListener('click', function () { pick(opt); });
    });

    root.addEventListener('keydown', function (e) {
      var isOpen = root.classList.contains('is-open');

      if (e.key === 'Escape' && isOpen) { e.stopPropagation(); close(); btn.focus(); return; }

      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        return;
      }

      if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(Math.min(opts.length - 1, cursor + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(Math.max(0, cursor - 1)); }
      else if (e.key === 'Home') { e.preventDefault(); moveCursor(0); }
      else if (e.key === 'End') { e.preventDefault(); moveCursor(opts.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (cursor >= 0) pick(opts[cursor]);
      }
    });

    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) close();
    });

    // програмний вибір послуги ззовні (кнопки «Записатись» у картках)
    root.selectByValue = function (value) {
      var match = opts.find(function (o) { return o.dataset.value === value; });
      if (match) {
        opts.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
        match.setAttribute('aria-selected', 'true');
        hidden.value = match.dataset.value;
        valueEl.textContent = match.dataset.value;
        valueEl.classList.remove('is-placeholder');
      }
    };

    root.reset = function () {
      opts.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
      hidden.value = '';
      valueEl.textContent = 'Оберіть послугу';
      valueEl.classList.add('is-placeholder');
    };
  }

  /* ── Маска телефону ────────────────────────────────────── */
  function initPhone(input) {
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
    input.addEventListener('input', function () {
      var atEnd = input.selectionStart === input.value.length;
      input.value = format(input.value);
      if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
    });
    input.addEventListener('focus', function () {
      if (!input.value) input.value = '+38 (';
    });
    input.addEventListener('blur', function () {
      if (input.value.replace(/\D/g, '').length <= 2) input.value = '';
    });
  }

  /* ── Відправка заявки ──────────────────────────────────── */
  function initForm(form) {
    var wrap = form.parentElement;
    var done = $('.form__done', wrap);
    var status = $('.form__status', form);
    var label = $('.btn__label', form);
    var labelText = label ? label.textContent : '';

    $$('[data-segmented]', form).forEach(initSegmented);
    $$('[data-stepper]', form).forEach(initStepper);
    $$('[data-dropdown]', form).forEach(initDropdown);
    $$('input[name="phone"]', form).forEach(initPhone);

    var clearErrors = function () {
      $$('.field', form).forEach(function (f) { f.classList.remove('has-error'); });
      $$('.err', form).forEach(function (e) { e.textContent = ''; });
      status.textContent = '';
    };

    var showErrors = function (errors) {
      Object.keys(errors).forEach(function (key) {
        var slot = $('[data-err="' + key + '"]', form);
        if (!slot) return;
        slot.textContent = errors[key];
        slot.closest('.field').classList.add('has-error');
      });
      var first = $('.has-error input', form);
      if (first) first.focus();
    };

    form.addEventListener('input', function (e) {
      var field = e.target.closest('.field');
      if (!field || !field.classList.contains('has-error')) return;
      field.classList.remove('has-error');
      var slot = $('.err', field);
      if (slot) slot.textContent = '';
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
          $$('[data-dropdown]', form).forEach(function (d) { d.reset(); });
          $$('[data-segmented]', form).forEach(initSegmented);
          form.hidden = true;
          done.hidden = false;
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

    var resetBtn = done ? $('[data-reset]', done) : null;
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        done.hidden = true;
        form.hidden = false;
        clearErrors();
        var firstInput = $('input[name="name"]', form);
        if (firstInput) firstInput.focus();
      });
    }
  }

  $$('[data-lead-form]').forEach(initForm);

  /* ── Модальне вікно ────────────────────────────────────── */
  var modal = $('#bookingModal');

  if (modal && typeof modal.showModal === 'function') {
    var lastTrigger = null;

    var openModal = function (service) {
      modal.showModal();
      requestAnimationFrame(function () { modal.classList.add('is-open'); });

      if (service) {
        var dd = $('[data-dropdown]', modal);
        if (dd && dd.selectByValue) dd.selectByValue(service);
      }
      setTimeout(function () {
        var field = $('input[name="name"]', modal);
        if (field) field.focus({ preventScroll: true });
      }, 260);
    };

    var closeModal = function () {
      modal.classList.remove('is-open');
      var box = $('.modal__box', modal);
      var finish = function () { modal.close(); };
      if (box) {
        box.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, 420); // підстраховка, якщо transitionend не прийде
      } else {
        finish();
      }
    };

    $$('[data-modal-open]').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        lastTrigger = trigger;
        openModal(trigger.dataset.service);
      });
    });

    $$('[data-modal-close]', modal).forEach(function (btn) {
      btn.addEventListener('click', closeModal);
    });

    // клік по підкладці поза карткою
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    // Esc: гасимо штатне закриття, щоб програти анімацію
    modal.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeModal();
    });

    modal.addEventListener('close', function () {
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    });
  }
})();
