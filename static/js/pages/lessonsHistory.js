import { getDb, enrichLesson } from '../data.js';
import { renderShell } from '../shell.js';
import { date, escapeHtml } from '../format.js';

export async function renderLessonsHistory() {
  renderShell('/students');
  const content = document.getElementById('content');
  const db = await getDb();

  const lessons = db.lessons
    .filter((l) => l.status === 'completed')
    .map((l) => enrichLesson(db, l))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  content.innerHTML = `
    <div style="padding:18px;">
      <a class="back-link" href="#/students">← Ученики</a>
      <h2 style="margin-bottom:14px;">История занятий</h2>
      <div class="muted" style="font-size:11px;margin-bottom:10px;">Всего проведено: ${lessons.length}</div>
      <div class="list">
        ${lessons
          .map(
            (l) => `
          <a class="card" href="#/students/${l.studentId}" style="text-decoration:none;color:inherit;display:block;">
            <div class="row" style="font-size:12px;">
              <span class="muted">${date(l.scheduledAt)} · ${escapeHtml(l.subjectName ?? '')}</span>
              <span class="muted">Оценка ${l.grade}/10</span>
            </div>
            <div style="font-family:var(--font-heading);font-weight:600;font-size:14.5px;">${escapeHtml(l.studentName)} · ${escapeHtml(l.topic ?? '')}</div>
            <div class="muted" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(l.comment ?? '')}</div>
          </a>`
          )
          .join('')}
      </div>
    </div>`;
}
