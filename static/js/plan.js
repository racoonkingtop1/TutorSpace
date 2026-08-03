import { getDb, tutorRating } from './data.js';
import { renderShell } from './shell.js';
import { escapeHtml } from './format.js';

renderShell('plan');
const content = document.getElementById('content');

function progressFor(db, plan) {
  const inRange = (iso) => iso.slice(0, 10) >= plan.periodStart && iso.slice(0, 10) <= plan.periodEnd;
  const currentStudents = db.students.filter((s) => inRange(s.createdAt)).length;
  const completed = db.lessons.filter((l) => l.status === 'completed' && inRange(l.scheduledAt));
  const currentRevenue = completed.reduce((sum, l) => sum + (l.priceCharged ?? 0), 0);
  const { rating } = tutorRating(db);
  return { currentStudents, currentRevenue, currentLessons: completed.length, currentRating: rating };
}

function metricRow(label, current, target, unit, decimals = 0) {
  if (target == null) return '';
  const pct = Math.min(100, (current / target) * 100);
  const fmt = (n) => (decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString('ru-RU'));
  return `
    <div>
      <div class="row" style="font-size:12.5px;margin-bottom:4px;">
        <span class="muted">${label}</span>
        <span class="tabular">${fmt(current)}${unit} / ${fmt(target)}${unit}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>
    </div>`;
}

async function render() {
  const db = await getDb();
  const plans = [...db.plans].sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  if (plans.length === 0) {
    content.innerHTML = `<div style="padding:20px 18px;"><h2>Статистика</h2><div class="empty">Планов пока нет.</div></div>`;
    return;
  }

  const cards = plans
    .map((p) => {
      const prog = progressFor(db, p);
      return `
      <div class="card stack">
        <div class="muted" style="font-size:12.5px;">${p.periodType} · ${p.periodStart} — ${p.periodEnd}</div>
        ${metricRow('Доход', prog.currentRevenue, p.targetRevenue, ' ₽')}
        ${metricRow('Ученики', prog.currentStudents, p.targetStudents, '')}
        ${metricRow('Занятия', prog.currentLessons, p.targetLessons, '')}
        ${metricRow('Рейтинг', prog.currentRating ?? 0, p.targetRating, '', 1)}
      </div>`;
    })
    .join('');

  content.innerHTML = `
    <div style="padding:20px 18px;">
      <h2 style="margin-bottom:16px;">Статистика</h2>
      <div class="list">${cards}</div>
    </div>`;
}

render().catch((err) => {
  content.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
});
