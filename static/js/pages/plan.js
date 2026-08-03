import { getDb, planProgress } from '../data.js';
import { renderShell } from '../shell.js';
import { renderDonutChart, renderActivityCalendar } from '../widgets.js';

const METRIC_DEFS = [
  { key: 'revenue', label: 'Доход', color: 'var(--accent)', unit: ' ₽' },
  { key: 'students', label: 'Ученики', color: '#5b8fb0', unit: '' },
  { key: 'lessons', label: 'Занятия', color: 'var(--success)', unit: '' },
  { key: 'rating', label: 'Рейтинг', color: '#a06fb0', unit: '' },
];

function fmt(n) {
  return Math.round(n).toLocaleString('ru-RU');
}

export async function renderPlan() {
  renderShell('/plan');
  const content = document.getElementById('content');
  const db = await getDb();

  const state = {
    periodType: 'month',
    subjectId: '',
    from: null,
    to: null,
    filtersOpen: false,
    donutVisible: { revenue: true, students: true, lessons: true, rating: true },
  };

  const today = new Date(db.anchorDate + 'T00:00:00');
  const activityMonth = { year: today.getFullYear(), month: today.getMonth() };

  function currentPlan() {
    const candidates = db.plans.filter((p) => p.periodType === state.periodType).sort((a, b) => b.periodStart.localeCompare(a.periodStart));
    return candidates[0] ?? null;
  }

  function render() {
    const plan = currentPlan();
    if (!plan) {
      content.innerHTML = `<div style="padding:20px 18px;"><h2>Статистика</h2><div class="empty">Планов пока нет.</div></div>`;
      return;
    }
    const periodStart = state.from || plan.periodStart;
    const periodEnd = state.to || plan.periodEnd;
    const prog = planProgress(db, { periodStart, periodEnd, subjectId: state.subjectId || null });

    const targets = { revenue: plan.targetRevenue, students: plan.targetStudents, lessons: plan.targetLessons, rating: plan.targetRating };
    const currents = { revenue: prog.currentRevenue, students: prog.currentStudents, lessons: prog.currentLessons, rating: prog.currentRating ?? 0 };

    const donutMetrics = METRIC_DEFS.map((m) => ({
      key: m.key,
      label: m.label,
      color: m.color,
      pct: targets[m.key] ? (currents[m.key] / targets[m.key]) * 100 : 0,
      visible: state.donutVisible[m.key],
    }));

    content.innerHTML = `
      <div style="padding:20px 18px 4px;"><h2>Статистика</h2></div>
      <div style="padding:14px 18px 4px;">
        <div class="segmented" id="period-tabs">
          ${['week', 'month', 'year']
            .map(
              (p) =>
                `<button type="button" data-period="${p}" class="${p === state.periodType ? 'active' : ''}">${p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Год'}</button>`
            )
            .join('')}
        </div>
      </div>

      <div style="padding:10px 18px;" class="donut-wrap" id="donut"></div>

      <div style="padding:6px 18px;" class="stack" id="metrics"></div>

      <div style="padding:10px 18px 4px;">
        <button type="button" class="btn btn-block" id="toggle-filters" style="justify-content:space-between;">
          <span>Фильтры</span><span>${state.filtersOpen ? '▲' : '▼'}</span>
        </button>
        ${
          state.filtersOpen
            ? `<div class="card" style="border-top:none;border-radius:0 0 10px 10px;margin-top:-1px;">
                <div class="field">
                  <label for="filter-subject">Предмет</label>
                  <select class="input" id="filter-subject">
                    <option value="">Все предметы</option>
                    ${db.tutorSubjects.map((s) => `<option value="${s.id}" ${s.id === state.subjectId ? 'selected' : ''}>${s.subjectName}</option>`).join('')}
                  </select>
                </div>
                <div class="row" style="margin-top:10px;">
                  <div class="field" style="flex:1;"><label for="from">С</label><input class="input" type="date" id="from" value="${periodStart}" /></div>
                  <div class="field" style="flex:1;"><label for="to">По</label><input class="input" type="date" id="to" value="${periodEnd}" /></div>
                </div>
              </div>`
            : ''
        }
      </div>

      <div style="padding:12px 18px 4px;">
        <button type="button" class="btn btn-block" id="ai-compare">✨ Сгенерировать AI-сравнение</button>
      </div>

      <div style="padding:14px 18px 20px;">
        <hr class="divider" style="margin:6px 0 14px;" />
        <h3 class="section-title">Ваша активность</h3>
        <div id="activity"></div>
      </div>`;

    content.querySelector('#donut').innerHTML = renderDonutChart(donutMetrics);
    content.querySelectorAll('[data-donut-toggle]').forEach((cb) =>
      cb.addEventListener('change', () => {
        state.donutVisible[cb.dataset.donutToggle] = cb.checked;
        render();
      })
    );

    content.querySelector('#metrics').innerHTML = METRIC_DEFS.map((m) => {
      const current = currents[m.key];
      const target = targets[m.key];
      if (target == null) return '';
      const pct = Math.min(100, (current / target) * 100);
      const decimals = m.key === 'rating' ? 1 : 0;
      const curLabel = decimals ? current.toFixed(decimals) : fmt(current);
      const tgtLabel = decimals ? target.toFixed(decimals) : fmt(target);
      const need = target - current;
      let helper;
      if (need <= 0) helper = 'Цель достигнута';
      else if (m.key === 'rating') helper = `Нужно ещё +${need.toFixed(1)} к рейтингу`;
      else helper = `Осталось ${fmt(need)}${m.unit}`;
      return `
        <div class="card">
          <div class="row" style="font-size:12.5px;">
            <span class="muted">${m.label}</span>
            <span class="tabular">${curLabel}${m.unit} / ${tgtLabel}${m.unit}</span>
          </div>
          <div class="progress-track" style="margin:6px 0;"><div class="progress-fill" style="width:${pct}%;background:${m.color};"></div></div>
          <div class="muted" style="font-size:11px;">${helper}</div>
        </div>`;
    }).join('');

    content.querySelector('#activity').appendChild(
      renderActivityCalendar({
        year: activityMonth.year,
        month: activityMonth.month,
        lessons: db.lessons,
        showNav: true,
        onPrev: () => {
          activityMonth.month === 0 ? ((activityMonth.month = 11), activityMonth.year--) : activityMonth.month--;
          render();
        },
        onNext: () => {
          activityMonth.month === 11 ? ((activityMonth.month = 0), activityMonth.year++) : activityMonth.month++;
          render();
        },
      })
    );

    content.querySelectorAll('[data-period]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.periodType = btn.dataset.period;
        state.from = null;
        state.to = null;
        render();
      })
    );
    document.getElementById('toggle-filters').addEventListener('click', () => {
      state.filtersOpen = !state.filtersOpen;
      render();
    });
    document.getElementById('filter-subject')?.addEventListener('change', (e) => {
      state.subjectId = e.target.value;
      render();
    });
    document.getElementById('from')?.addEventListener('change', (e) => {
      state.from = e.target.value;
      render();
    });
    document.getElementById('to')?.addEventListener('change', (e) => {
      state.to = e.target.value;
      render();
    });
    document.getElementById('ai-compare').addEventListener('click', () => {
      alert('AI-сравнение — недоступно в демо-версии.');
    });
  }

  render();
}
