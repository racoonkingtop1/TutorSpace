import { getDb, createLesson, completeLesson, enrichLesson } from './data.js';
import { renderShell } from './shell.js';
import { qs, escapeHtml } from './format.js';

renderShell('today');
const content = document.getElementById('content');

const lessonId = qs('id');
const newForStudentId = qs('studentId');

async function renderNew(db) {
  const students = [...db.students].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  content.innerHTML = `
    <div style="padding:18px;" class="stack">
      <h2>Новое занятие</h2>
      <div class="field">
        <label for="student">Ученик</label>
        <select class="input" id="student">
          ${students.map((s) => `<option value="${s.id}" ${s.id === newForStudentId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="when">Дата и время</label>
        <input class="input" id="when" type="datetime-local" />
      </div>
      <div class="error" id="err" style="display:none;"></div>
      <button class="btn btn-primary btn-block" id="save">Сохранить занятие</button>
    </div>`;

  const whenEl = document.getElementById('when');
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  whenEl.value = now.toISOString().slice(0, 16);

  document.getElementById('save').addEventListener('click', async () => {
    const studentId = document.getElementById('student').value;
    const scheduledAt = new Date(whenEl.value).toISOString();
    try {
      await createLesson(db, { studentId, scheduledAt });
      location.href = `student.html?id=${studentId}`;
    } catch (err) {
      const errEl = document.getElementById('err');
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}

async function renderComplete(db) {
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    content.innerHTML = '<div class="error">Занятие не найдено.</div>';
    return;
  }
  const enriched = enrichLesson(db, lesson);

  if (lesson.status === 'completed') {
    content.innerHTML = `
      <div style="padding:18px;" class="stack">
        <h2>Занятие</h2>
        <div class="muted" style="font-size:11.5px;">${escapeHtml(enriched.studentName)} · ${escapeHtml(enriched.subjectName ?? '')}</div>
        <div class="muted" style="font-size:13px;">Уже отмечено проведённым. Оценка ${lesson.grade}/10 · ${escapeHtml(lesson.topic ?? '')}</div>
        <a class="btn" href="student.html?id=${lesson.studentId}">К профилю ученика</a>
      </div>`;
    return;
  }

  content.innerHTML = `
    <div style="padding:18px;" class="stack">
      <h2>Занятие</h2>
      <div class="muted" style="font-size:11.5px;">${escapeHtml(enriched.studentName)} · ${escapeHtml(enriched.subjectName ?? '')}</div>
      <div class="field">
        <label for="duration">Фактическая продолжительность (мин)</label>
        <input class="input" id="duration" type="number" value="60" />
      </div>
      <div class="field">
        <label for="topic">Тема занятия</label>
        <input class="input" id="topic" />
      </div>
      <div class="field">
        <label for="grade">Оценка (1–10)</label>
        <input class="input" id="grade" type="number" min="1" max="10" value="8" />
      </div>
      <div class="field">
        <label for="comment">Комментарий</label>
        <textarea class="input" id="comment"></textarea>
      </div>
      <div class="error" id="err" style="display:none;"></div>
      <button class="btn btn-primary btn-block" id="save">Сохранить занятие</button>
    </div>`;

  document.getElementById('save').addEventListener('click', async () => {
    const topic = document.getElementById('topic').value.trim();
    if (!topic) {
      const errEl = document.getElementById('err');
      errEl.textContent = 'Укажите тему занятия';
      errEl.style.display = 'block';
      return;
    }
    await completeLesson(db, lesson.id, {
      actualDurationMin: Number(document.getElementById('duration').value),
      topic,
      grade: Number(document.getElementById('grade').value),
      comment: document.getElementById('comment').value.trim(),
    });
    location.href = `student.html?id=${lesson.studentId}`;
  });
}

async function render() {
  const db = await getDb();
  if (lessonId) await renderComplete(db);
  else await renderNew(db);
}

render().catch((err) => {
  content.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
});
