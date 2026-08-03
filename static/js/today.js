import { getDb, enrichLesson } from './data.js';
import { renderShell } from './shell.js';
import { time, escapeHtml } from './format.js';

renderShell('today');
const content = document.getElementById('content');

function todayIso(db) {
  // The dataset was generated with an anchor "today" (see dataset.anchorDate);
  // using that instead of the visitor's real clock keeps the demo showing
  // lessons on the day the data was actually built around.
  return db.anchorDate;
}

function lessonCard(l) {
  const cls = l.blocked ? 'card danger' : 'card';
  return `
    <div class="${cls}">
      <div class="row" style="align-items:flex-start;">
        <div>
          <span class="muted tabular" style="margin-right:7px;">${time(l.scheduledAt)}</span>
          <strong style="font-family:var(--font-heading);">${escapeHtml(l.studentName)}</strong>
          <div class="muted" style="font-size:12px;margin-top:2px;">${escapeHtml(l.subjectName ?? '')}</div>
        </div>
        ${
          l.blocked
            ? `<span class="pill pill-danger">Долг</span>`
            : `<a class="btn btn-primary" href="lesson.html?id=${l.id}">Отметить</a>`
        }
      </div>
      ${l.blocked ? `<div class="muted" style="font-size:11.5px;margin-top:8px;padding-top:8px;border-top:1px solid var(--danger-border);">Занятие заблокировано до оплаты</div>` : ''}
    </div>`;
}

async function render() {
  const db = await getDb();
  const date = todayIso(db);
  const lessons = db.lessons
    .filter((l) => l.scheduledAt.slice(0, 10) === date)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((l) => enrichLesson(db, l));
  const unpaidCount = lessons.filter((l) => l.blocked).length;

  content.innerHTML = `
    <div style="padding:20px 18px;">
      <h2>Сегодня</h2>
      <div class="muted" style="font-size:13px;margin:4px 0 16px;">${lessons.length} занятий сегодня · ${unpaidCount} не оплачено</div>
      ${lessons.length === 0 ? '<div class="empty">На сегодня занятий нет.</div>' : `<div class="list">${lessons.map(lessonCard).join('')}</div>`}
    </div>`;
}

render().catch((err) => {
  content.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
});
