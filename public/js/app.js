(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ── Блокування скролу сторінки ────────────────────────── */
  // Лічильник, а не прапорець: бічне меню й модалка можуть
  // теоретично перекритись у часі — знімаємо блок лише коли
  // закрились усі, хто його просив.
  var lockCount = 0;
  var lockScroll = function () {
    if (lockCount === 0) {
      // ховаємо смугу прокрутки — сторінка стає ширшою на її ширину
      // і весь контент стрибає вправо; компенсуємо тим самим паддингом
      var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) document.body.style.paddingRight = scrollbarWidth + 'px';
      document.body.classList.add('is-locked');
    }
    lockCount += 1;
  };
  var unlockScroll = function () {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.classList.remove('is-locked');
      document.body.style.paddingRight = '';
    }
  };

  /* ── Мобільне меню ─────────────────────────────────────── */
  var burger = $('.burger');
  var nav = $('#nav');
  var navOverlay = $('.nav-overlay');

  if (burger && nav) {
    var openNav = function () {
      if (navOverlay) {
        navOverlay.hidden = false;
        requestAnimationFrame(function () { navOverlay.classList.add('is-on'); });
      }
      nav.classList.add('is-open');
      lockScroll();
      burger.setAttribute('aria-expanded', 'true');
    };

    // instant — прибрати шухляду без анімації. Потрібно, коли з неї
    // одразу відкривається модалка: виїзд шухляди накладався б на появу
    // вікна, а це два перетворення й два розмиття фону водночас —
    // на телефоні анімація помітно смикається.
    var closeNav = function (instant) {
      // idempotent: без цього застереження клік по .nav__cta (вона теж
      // data-modal-open, тобто відкриває модалку і лежить всередині
      // <nav>) знімав би блокування скролу, накинуте модалкою, навіть
      // коли сама шухляда вже була закрита
      if (!nav.classList.contains('is-open')) return;
      if (instant) nav.classList.add('nav--instant');
      nav.classList.remove('is-open');
      unlockScroll();
      burger.setAttribute('aria-expanded', 'false');
      if (instant) {
        // знімаємо наступним кадром, коли шухляда вже поїхала за екран
        requestAnimationFrame(function () { nav.classList.remove('nav--instant'); });
      }
      if (!navOverlay) return;
      navOverlay.classList.remove('is-on');
      var hide = function () { navOverlay.hidden = true; };
      if (instant) { hide(); return; }
      navOverlay.addEventListener('transitionend', hide, { once: true });
      setTimeout(hide, 400);
    };

    burger.addEventListener('click', function () {
      nav.classList.contains('is-open') ? closeNav() : openNav();
    });

    $$('[data-nav-close]').forEach(function (el) {
      // обгортка обов'язкова: інакше в closeNav першим аргументом
      // прилетить об'єкт події, а він істинний — і закриття щоразу
      // виходило б миттєвим, без анімації
      el.addEventListener('click', function () { closeNav(); });
    });

    nav.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;
      closeNav(link.hasAttribute('data-modal-open'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) closeNav();
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
      valueEl.textContent = root.dataset.placeholder || 'Оберіть зі списку';
      valueEl.classList.add('is-placeholder');
    };
  }

  /* ── Вибір дати та часу візиту ─────────────────────────── */
  var MONTHS_NOM = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  var MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
                    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var WEEK_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  var DAYS_AHEAD = 60;   // наскільки далеко можна записатись
  var LEAD_MIN = 60;     // на сьогодні — не раніше ніж за годину
  var STEP_MIN = 30;     // крок сітки часу

  function initDatepick(root) {
    var hours = {};
    try { hours = JSON.parse(root.dataset.hours || '{}'); } catch (e) { hours = {}; }

    var btn = $('.datepick__btn', root);
    var pop = $('.datepick__pop', root);
    var valueEl = $('.datepick__value', root);
    var hidden = $('input[type="hidden"]', root);
    var monthEl = $('[data-dp-month]', root);
    var daysEl = $('[data-dp-days]', root);
    var labelEl = $('[data-dp-label]', root);
    var slotsEl = $('[data-dp-slots]', root);

    var startOfDay = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
    var today = startOfDay(new Date());
    var maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + DAYS_AHEAD);

    var view = new Date(today.getFullYear(), today.getMonth(), 1);
    var selected = null;

    var minutesOf = function (hhmm) {
      var parts = hhmm.split(':');
      return Number(parts[0]) * 60 + Number(parts[1]);
    };

    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    var isClosed = function (date) { return !hours[date.getDay()]; };

    /** Вільні слоти на день або порожній масив. */
    var slotsFor = function (date) {
      var work = hours[date.getDay()];
      if (!work) return [];

      var from = minutesOf(work.opens);
      var to = minutesOf(work.closes) - STEP_MIN;

      if (date.getTime() === today.getTime()) {
        var now = new Date();
        var earliest = now.getHours() * 60 + now.getMinutes() + LEAD_MIN;
        from = Math.max(from, Math.ceil(earliest / STEP_MIN) * STEP_MIN);
      }

      var out = [];
      for (var m = from; m <= to; m += STEP_MIN) {
        out.push(pad(Math.floor(m / 60)) + ':' + pad(m % 60));
      }
      return out;
    };

    var renderMonth = function () {
      monthEl.textContent = MONTHS_NOM[view.getMonth()] + ' ' + view.getFullYear();

      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var lead = (first.getDay() + 6) % 7; // тиждень починається з понеділка
      var total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

      daysEl.innerHTML = '';

      for (var i = 0; i < lead; i++) {
        var gap = document.createElement('span');
        gap.className = 'dp-day dp-day--empty';
        daysEl.appendChild(gap);
      }

      for (var d = 1; d <= total; d++) {
        var date = new Date(view.getFullYear(), view.getMonth(), d);
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'dp-day';
        cell.textContent = String(d);
        cell.style.setProperty('--i', String((lead + d - 1) % 7));

        var tooEarly = date < today;
        var tooLate = date > maxDate;
        var closed = isClosed(date);
        var noSlots = !closed && slotsFor(date).length === 0;

        if (tooEarly || tooLate || closed || noSlots) {
          cell.disabled = true;
        } else {
          // не toISOString(): він переводить у UTC і для Києва (+2/+3)
          // північ місцевого часу зсувається на попередню добу
          cell.dataset.date = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
        }
        if (date.getTime() === today.getTime()) cell.classList.add('is-today');
        if (selected && date.getTime() === selected.getTime()) cell.classList.add('is-picked');

        daysEl.appendChild(cell);
      }

      var prevBtn = $('[data-dp-prev]', root);
      prevBtn.disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
      $('[data-dp-next]', root).disabled =
        new Date(view.getFullYear(), view.getMonth() + 1, 1) > maxDate;
    };

    var renderSlots = function () {
      slotsEl.innerHTML = '';

      if (!selected) {
        labelEl.textContent = 'Спершу оберіть день';
        return;
      }

      var list = slotsFor(selected);
      labelEl.textContent = selected.getDate() + ' ' + MONTHS_GEN[selected.getMonth()] +
                            ', ' + WEEK_SHORT[selected.getDay()];

      if (!list.length) {
        var empty = document.createElement('p');
        empty.className = 'dp-empty';
        empty.textContent = 'На цей день вільного часу вже немає';
        slotsEl.appendChild(empty);
        return;
      }

      list.forEach(function (time, i) {
        var slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'dp-slot';
        slot.textContent = time;
        slot.dataset.time = time;
        slot.style.setProperty('--i', String(i));
        slotsEl.appendChild(slot);
      });
    };

    // на телефоні поповер — фіксована шторка, тож підкручувати
    // до нього сторінку не треба (і шкідливо: вона б смикалась)
    var isSheet = function () {
      return window.matchMedia && window.matchMedia('(max-width: 560px)').matches;
    };

    var open = function () {
      root.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      if (isSheet()) {
        // z-index шторки живе всередині .booking__in, тож плаваюча
        // кнопка малюється поверх неї й затуляє нижні слоти
        document.body.classList.add('is-sheet-open');
        return;
      }
      setTimeout(function () { pop.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 60);
    };

    var close = function () {
      root.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('is-sheet-open');
    };

    var commit = function (time) {
      var text = selected.getDate() + ' ' + MONTHS_GEN[selected.getMonth()] +
                 ' (' + WEEK_SHORT[selected.getDay()] + '), ' + time;
      hidden.value = text;
      valueEl.textContent = text;
      valueEl.classList.remove('is-placeholder');
      close();
      btn.focus();
    };

    btn.addEventListener('click', function () {
      root.classList.contains('is-open') ? close() : open();
    });

    $('[data-dp-prev]', root).addEventListener('click', function () {
      view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      renderMonth();
    });

    $('[data-dp-next]', root).addEventListener('click', function () {
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      renderMonth();
    });

    daysEl.addEventListener('click', function (e) {
      var cell = e.target.closest('.dp-day');
      if (!cell || !cell.dataset.date) return;
      var parts = cell.dataset.date.split('-');
      selected = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      renderMonth();
      renderSlots();
    });

    slotsEl.addEventListener('click', function (e) {
      var slot = e.target.closest('.dp-slot');
      if (slot) commit(slot.dataset.time);
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('is-open')) {
        e.stopPropagation();
        close();
        btn.focus();
      }
    });

    // саме pointerdown: на click сітка вже перемальована, клікнутий день
    // від'єднаний від DOM — і contains() помилково каже «клік поза календарем»
    document.addEventListener('pointerdown', function (e) {
      if (!root.contains(e.target)) close();
    });

    root.reset = function () {
      selected = null;
      hidden.value = '';
      valueEl.textContent = 'Оберіть дату та час';
      valueEl.classList.add('is-placeholder');
      view = new Date(today.getFullYear(), today.getMonth(), 1);
      renderMonth();
      renderSlots();
    };

    renderMonth();
    renderSlots();
  }

  /* ── Маска телефону ────────────────────────────────────── */
  function initPhone(input) {
    var format = function (raw) {
      var d = raw.replace(/\D/g, '');
      // «38» — це цифри нашого ж префікса «+38 (», а не введені користувачем.
      // Без цієї гілки вони діставали ведучий нуль, ставали «038» і
      // відновлювались на кожне натискання Backspace — поле не очищалось.
      if (d.startsWith('380')) d = d.slice(2);
      else if (d.startsWith('38')) d = d.slice(2);
      else if (d.startsWith('80')) d = d.slice(1);
      else if (d && d[0] !== '0') d = '0' + d;
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
    $$('[data-dropdown]', form).forEach(initDropdown);
    $$('[data-datepick]', form).forEach(initDatepick);
    $$('input[name="phone"]', form).forEach(initPhone);

    var clearErrors = function () {
      $$('.field', form).forEach(function (f) { f.classList.remove('has-error'); });
      form.classList.remove('has-consent-error');
      $$('.err', form).forEach(function (e) { e.textContent = ''; });
      status.textContent = '';
    };

    var showErrors = function (errors) {
      Object.keys(errors).forEach(function (key) {
        var slot = $('[data-err="' + key + '"]', form);
        if (!slot) return;
        slot.textContent = errors[key];
        // згода лежить поза .field — без цієї перевірки був би виняток
        var field = slot.closest('.field');
        if (field) field.classList.add('has-error');
        else form.classList.add('has-consent-error');
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
        var res = await fetch('/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var data = await res.json().catch(function () { return {}; });

        if (res.ok && data.ok) {
          form.reset();
          $$('[data-dropdown]', form).forEach(function (d) { d.reset(); });
          $$('[data-datepick]', form).forEach(function (d) { d.reset(); });
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

  /* ── Акордеон «Часті питання» ──────────────────────────── */
  var noMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var faqItems = $$('.faq__item');

  faqItems.forEach(function (item) {
    var summary = $('summary', item);
    var body = $('.faq__body', item);
    var anim = null;
    var timer = null;

    // onfinish інколи не приходить (перерване відтворення, фонова вкладка),
    // тому стан завжди довершує ще й таймер
    var run = function (frames, duration, done) {
      if (anim) anim.cancel();
      clearTimeout(timer);

      var settled = false;
      var finish = function () {
        if (settled) return;
        settled = true;
        anim = null;
        done();
      };

      if (noMotion) { finish(); return; }

      anim = body.animate(frames, { duration: duration, easing: 'cubic-bezier(.32, .72, 0, 1)' });
      anim.onfinish = finish;
      timer = setTimeout(finish, duration + 80);
    };

    var expand = function () {
      item.open = true;
      var h = body.scrollHeight;
      run([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], 340, function () {});
    };

    var collapse = function () {
      var h = body.scrollHeight;
      run([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], 260, function () {
        item.open = false;
      });
    };

    item.collapse = collapse;

    summary.addEventListener('click', function (e) {
      e.preventDefault();

      if (item.open) {
        collapse();
        return;
      }

      // відкрите питання лишається одне
      faqItems.forEach(function (other) {
        if (other !== item && other.open) other.collapse();
      });
      expand();
    });
  });

  /* ── Модальні вікна ───────────────────────────────────── */
  function setupModal(modal) {
    if (!modal || typeof modal.showModal !== 'function') return null;

    var box = $('.modal__box', modal);
    var lastTrigger = null;
    var isOpen = false;
    // чи мишу/палець опустили саме на підкладку (не на .modal__box) —
    // інакше виділення тексту, що завершується поза карткою, зачитувалось
    // би як клік по підкладці і закривало вікно
    var downOnBackdrop = false;

    var open = function (trigger) {
      lastTrigger = trigger || null;
      modal.showModal();
      isOpen = true;
      lockScroll();
      requestAnimationFrame(function () { modal.classList.add('is-open'); });
    };

    var close = function () {
      if (!isOpen) return;
      isOpen = false;
      unlockScroll();
      modal.classList.remove('is-open');
      var finish = function () { if (modal.open) modal.close(); };
      if (box) {
        box.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, 420); // підстраховка, якщо transitionend не прийде
      } else {
        finish();
      }
    };

    $$('[data-modal-close]', modal).forEach(function (btn) {
      btn.addEventListener('click', close);
    });

    modal.addEventListener('pointerdown', function (e) {
      downOnBackdrop = e.target === modal;
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal && downOnBackdrop) close();
    });

    // Esc: гасимо штатне закриття, щоб програти анімацію
    modal.addEventListener('cancel', function (e) {
      e.preventDefault();
      close();
    });

    modal.addEventListener('close', function () {
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    });

    return { el: modal, open: open, close: close };
  }

  /* запис на прийом */
  var booking = setupModal($('#bookingModal'));

  if (booking) {
    $$('[data-modal-open]').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        booking.open(trigger);

        var service = trigger.dataset.service;
        if (service) {
          // саме через приховане поле: у модалці кілька списків,
          // і перший із них — вік, а не послуга
          var field = $('input[name="service"]', booking.el);
          var dd = field && field.closest('[data-dropdown]');
          if (dd && dd.selectByValue) dd.selectByValue(service);
        }

        setTimeout(function () {
          var field = $('input[name="name"]', booking.el);
          if (field) field.focus({ preventScroll: true });
        }, 280);
      });
    });
  }

  /* повний текст відгуку */
  var reviewModal = setupModal($('#reviewModal'));

  if (reviewModal) {
    var fill = function (card) {
      var set = function (key, value) {
        var el = $('[data-rv="' + key + '"]', reviewModal.el);
        if (el) el.textContent = value;
      };
      set('avatar', card.dataset.name.charAt(0));
      set('name', card.dataset.name);
      set('pet', card.dataset.pet);
      set('text', '«' + card.dataset.full + '»');
    };

    $$('[data-review]').forEach(function (card) {
      var show = function () {
        fill(card);
        reviewModal.open(card);
      };
      card.addEventListener('click', show);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); }
      });
    });
  }
})();
