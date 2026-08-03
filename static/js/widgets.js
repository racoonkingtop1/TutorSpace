// Small, dependency-free UI building blocks reused across pages — ports of
// the interactive pieces from the original Claude Design prototype
// (date picker, activity heatmap, donut progress chart, stepper, toggle,
// modal) that a plain multi-page rebuild had dropped.

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export function buildCalendarCells(year, month) {
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: daysInPrevMonth - startWeekday + 1 + i, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, iso: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  let next = 1;
  while (cells.length < 42) cells.push({ day: next++, inMonth: false });
  return cells;
}

export function fmtDateLabel(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ── date picker — single date, popover calendar ─────────────────────────
export function createDatePicker({ initialIso, todayIso, onChange }) {
  const [y, m] = initialIso.split('-').map(Number);
  const state = { year: y, month: m - 1, open: false, selected: initialIso };

  const root = document.createElement('div');
  root.className = 'datepicker';

  function render() {
    const cells = buildCalendarCells(state.year, state.month);
    root.innerHTML = `
      <button type="button" class="input datepicker-trigger">
        <span>${fmtDateLabel(state.selected)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
      </button>
      ${
        state.open
          ? `<div class="datepicker-panel">
              <div class="datepicker-nav">
                <button type="button" data-nav="prev" class="icon-btn">‹</button>
                <span>${MONTH_NAMES[state.month]} ${state.year}</span>
                <button type="button" data-nav="next" class="icon-btn">›</button>
              </div>
              <div class="calendar-grid calendar-weekdays">${WEEKDAYS.map((w) => `<div>${w}</div>`).join('')}</div>
              <div class="calendar-grid">
                ${cells
                  .map((c) => {
                    const isSelected = c.inMonth && c.iso === state.selected;
                    const isToday = c.inMonth && c.iso === todayIso;
                    const cls = ['calendar-cell', isSelected ? 'selected' : '', isToday && !isSelected ? 'today' : '', !c.inMonth ? 'out' : ''].join(' ');
                    return `<button type="button" class="${cls}" ${c.inMonth ? `data-day="${c.iso}"` : 'disabled'}>${c.day}</button>`;
                  })
                  .join('')}
              </div>
            </div>`
          : ''
      }`;

    root.querySelector('.datepicker-trigger').addEventListener('click', () => {
      state.open = !state.open;
      render();
    });
    root.querySelectorAll('[data-nav]')?.forEach((btn) =>
      btn.addEventListener('click', () => {
        if (btn.dataset.nav === 'prev') {
          state.month === 0 ? ((state.month = 11), state.year--) : state.month--;
        } else {
          state.month === 11 ? ((state.month = 0), state.year++) : state.month++;
        }
        render();
      })
    );
    root.querySelectorAll('[data-day]')?.forEach((btn) =>
      btn.addEventListener('click', () => {
        state.selected = btn.dataset.day;
        state.open = false;
        render();
        onChange?.(state.selected);
      })
    );
  }

  render();
  root.getValue = () => state.selected;
  return root;
}

// ── activity heatmap — a month grid colored by lesson count per day ─────
export function renderActivityCalendar({ year, month, lessons, onPrev, onNext, showNav }) {
  const cells = buildCalendarCells(year, month);
  const countByDay = {};
  for (const l of lessons) {
    if (l.status !== 'completed') continue;
    const iso = l.scheduledAt.slice(0, 10);
    countByDay[iso] = (countByDay[iso] || 0) + 1;
  }
  function bucket(iso) {
    const n = countByDay[iso] || 0;
    if (n === 0) return 0;
    if (n === 1) return 1;
    if (n === 2) return 2;
    return 3;
  }
  const wrap = document.createElement('div');
  wrap.className = 'card activity-calendar';
  wrap.innerHTML = `
    <div class="muted activity-legend-row">
      ${
        showNav
          ? `<button type="button" data-nav="prev" class="icon-btn">‹</button><span>${MONTH_NAMES[month]} ${year}</span><button type="button" data-nav="next" class="icon-btn">›</button>`
          : `<span style="margin:0 auto;">${MONTH_NAMES[month]} ${year}</span>`
      }
    </div>
    <div class="calendar-grid calendar-weekdays">${WEEKDAYS.map((w) => `<div>${w}</div>`).join('')}</div>
    <div class="calendar-grid">
      ${cells
        .map((c) => {
          if (!c.inMonth) return `<div class="calendar-cell out"></div>`;
          return `<div class="calendar-cell activity-b${bucket(c.iso)}" title="${countByDay[c.iso] || 0} занятий">${c.day}</div>`;
        })
        .join('')}
    </div>
    <div class="activity-legend">
      <span class="muted">Меньше</span>
      ${[0, 1, 2, 3].map((b) => `<span class="legend-swatch activity-b${b}"></span>`).join('')}
      <span class="muted">Больше</span>
    </div>`;
  if (showNav) {
    wrap.querySelector('[data-nav="prev"]')?.addEventListener('click', onPrev);
    wrap.querySelector('[data-nav="next"]')?.addEventListener('click', onNext);
  }
  return wrap;
}

// ── donut chart — one ring per metric, toggleable via legend ────────────
export function renderDonutChart(metrics) {
  // metrics: [{ key, label, color, pct (0-100), visible }]
  const size = 180;
  const center = size / 2;
  const baseR = 70;
  const step = 16;
  const visible = metrics.filter((m) => m.visible);

  const rings = visible
    .map((m, i) => {
      const r = baseR - i * step;
      const circumference = 2 * Math.PI * r;
      const offset = circumference * (1 - Math.min(100, m.pct) / 100);
      return `
        <circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="var(--track)" stroke-width="10" />
        <circle cx="${center}" cy="${center}" r="${r}" fill="none" stroke="${m.color}" stroke-width="10"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
          transform="rotate(-90 ${center} ${center})" />`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${rings}</svg>
    <div class="donut-legend">
      ${metrics
        .map(
          (m) => `
        <label class="donut-legend-item">
          <input type="checkbox" data-donut-toggle="${m.key}" ${m.visible ? 'checked' : ''} />
          <span class="legend-swatch" style="background:${m.color};"></span>
          ${m.label}
        </label>`
        )
        .join('')}
    </div>`;
}

// ── stepper (-/value/+) ───────────────────────────────────────────────
export function stepperHtml({ name, value, unit }) {
  return `
    <div class="stepper" data-stepper="${name}">
      <button type="button" data-step="-1">−</button>
      <span class="tabular">${value}</span>
      <button type="button" data-step="1">+</button>
      ${unit ? `<span class="muted" style="font-size:11px;">${unit}</span>` : ''}
    </div>`;
}

// ── toggle switch ────────────────────────────────────────────────────
export function toggleHtml({ name, checked }) {
  return `<button type="button" class="switch ${checked ? 'on' : ''}" data-toggle="${name}"><span class="switch-knob"></span></button>`;
}

// ── modal ─────────────────────────────────────────────────────────────
export function openModal(innerHtml) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${innerHtml}</div></div>`;
  root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) closeModal();
  });
  return root.querySelector('.modal');
}

export function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}
