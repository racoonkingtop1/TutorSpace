import { getDb, enrichLesson, cancelLesson } from '../data.js';
import { renderShell } from '../shell.js';
import { navigate } from '../router.js';
import { time, escapeHtml } from '../format.js';
import { renderActivityCalendar, openModal, closeModal } from '../widgets.js';

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
        <div style="display:flex;gap:8px;align-items:center;">
          ${
            l.blocked
              ? `<span class="pill pill-danger">Долг</span>`
              : `<a class="btn btn-primary" href="#/lesson/${l.id}">Отметить</a>`
          }
        </div>
      </div>
      ${
        l.blocked
          ? `<div class="muted" style="font-size:11.5px;margin-top:8px;padding-top:8px;border-top:1px solid var(--danger-border);">Занятие заблокировано до оплаты</div>`
          : `<div style="text-align:right;margin-top:6px;"><button type="button" class="btn" data-cancel="${l.id}" style="padding:5px 10px;font-size:11.5px;color:var(--muted);">Отменить занятие</button></div>`
      }
    </div>`;
}

function completedCard(l) {
  return `
    <div class="card">
      <div class="row" style="font-size:12px;">
        <span class="muted">${time(l.scheduledAt)} · ${escapeHtml(l.subjectName ?? '')}</span>
        <span class="muted">Оценка ${l.grade}/10</span>
      </div>
      <div style="font-family:var(--font-heading);font-weight:600;font-size:14.5px;">${escapeHtml(l.studentName)} · ${escapeHtml(l.topic ?? '')}</div>
      <div class="muted" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(l.comment ?? '')}</div>
    </div>`;
}

function emptyState() {
  return `
    <div style="padding:28px 0;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;">
      <svg width="64" height="64" viewBox="0 0 72 72" fill="none">
        <rect x="10" y="14" width="52" height="46" rx="8" fill="var(--accent-tint)"/>
        <rect x="10" y="14" width="52" height="14" rx="8" fill="var(--accent)" opacity="0.35"/>
        <path d="M25 42l8 8 14-16" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
      <div class="muted" style="font-size:13px;max-width:220px;">На сегодня занятий нет — самое время запланировать новое.</div>
    </div>`;
}

export async function renderToday() {
  renderShell('/today');
  const content = document.getElementById('content');
  const db = await getDb();
  const date_ = db.anchorDate;

  const dayLessons = db.lessons.filter((l) => l.scheduledAt.slice(0, 10) === date_).map((l) => enrichLesson(db, l));
  const upcoming = dayLessons.filter((l) => l.status === 'planned' || l.status === 'on_hold').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const completed = dayLessons.filter((l) => l.status === 'completed').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const unpaidCount = upcoming.filter((l) => l.blocked).length;

  const headerDate = new Date(date_ + 'T00:00:00');
  const weekday = headerDate.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dateLabel = headerDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

  const [y, m] = date_.split('-').map(Number);

  content.innerHTML = `
    <div style="padding:20px 18px 6px;">
      <div class="row">
        <h6 class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:0.04em;font-weight:400;">${escapeHtml(weekday)}, ${escapeHtml(dateLabel)}</h6>
        <a class="btn btn-primary" href="#/lesson/new" style="padding:6px 10px;font-size:11px;">+ Запланировать</a>
      </div>
      <h2 style="margin-top:10px;">Сегодня${dayLessons.length ? ` · ${dayLessons.length}` : ''}</h2>
      ${dayLessons.length ? `<div class="muted" style="font-size:12.5px;">Оплачено: ${dayLessons.length - unpaidCount} из ${dayLessons.length}</div>` : ''}
    </div>

    ${
      dayLessons.length === 0
        ? `<div style="padding:0 18px;">${emptyState()}</div>`
        : `
        ${upcoming.length ? `<div style="padding:16px 18px 6px;"><h3>Ближайшие занятия</h3></div><div style="padding:0 18px 6px;" class="list">${upcoming.map(lessonCard).join('')}</div>` : ''}
        ${completed.length ? `<div style="padding:10px 18px 6px;"><h3>Завершённые занятия</h3></div><div style="padding:0 18px 6px;" class="list">${completed.map(completedCard).join('')}</div>` : ''}
      `
    }

    <div style="padding:16px 18px 20px;">
      <h3 class="section-title">Ваша активность</h3>
      <div id="activity"></div>
    </div>`;

  content.querySelector('#activity').appendChild(renderActivityCalendar({ year: y, month: m - 1, lessons: db.lessons, showNav: false }));

  content.querySelectorAll('[data-cancel]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.cancel;
      const modal = openModal(`
        <h3>Отменить занятие?</h3>
        <div class="muted" style="font-size:12.5px;">Занятие пропадёт из списка на этот день.</div>
        <button type="button" class="btn" id="confirmCancel" style="background:var(--danger);color:#fff;border-color:var(--danger);">Да, отменить</button>
      `);
      modal.querySelector('#confirmCancel').addEventListener('click', async () => {
        await cancelLesson(db, id);
        closeModal();
        navigate('/today');
        renderToday();
      });
    })
  );
}
