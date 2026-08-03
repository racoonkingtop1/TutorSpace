import { getDb, createLesson, completeLesson, cancelLesson } from '../data.js';
import { renderShell } from '../shell.js';
import { navigate } from '../router.js';
import { escapeHtml } from '../format.js';
import { createDatePicker, toggleHtml, openModal, closeModal } from '../widgets.js';

function gradeColor(grade) {
  if (grade <= 2) return 'var(--danger)';
  if (grade <= 5) return 'var(--accent)';
  if (grade <= 8) return 'var(--success)';
  return '#2f9e46';
}

export async function renderLessonForm({ params, query }) {
  renderShell('/today');
  const content = document.getElementById('content');
  const db = await getDb();

  const isNew = params.id === 'new';
  const existing = isNew ? null : db.lessons.find((l) => l.id === params.id);
  if (!isNew && !existing) {
    content.innerHTML = '<div class="error">Занятие не найдено.</div>';
    return;
  }
  const isLockedCompleted = existing?.status === 'completed';

  const students = [...db.students].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const initialStudentId = existing?.studentId ?? query.get('studentId') ?? students[0]?.id;

  // form state, mutated by the widgets below
  const state = {
    studentId: initialStudentId,
    subjectId: existing?.subjectId ?? students.find((s) => s.id === initialStudentId)?.subjectId ?? null,
    completed: isLockedCompleted,
    duration: existing?.actualDurationMin ?? 60,
    topic: existing?.topic ?? '',
    grade: existing?.grade ?? 8,
    comment: existing?.comment ?? '',
  };

  const now = new Date();
  const initialIso = existing ? existing.scheduledAt.slice(0, 10) : now.toISOString().slice(0, 10);
  const initialTime = existing ? existing.scheduledAt.slice(11, 16) : `${String(now.getHours()).padStart(2, '0')}:00`;
  const todayIso = db.anchorDate;

  content.innerHTML = `
    <div style="padding:18px;" class="stack">
      <a class="back-link" href="${existing ? `#/students/${existing.studentId}` : '#/today'}">← Назад</a>
      <h2>Занятие</h2>

      <div class="field">
        <label for="f-student">Ученик</label>
        <select class="input" id="f-student" ${isLockedCompleted ? 'disabled' : ''}>
          ${students.map((s) => `<option value="${s.id}" ${s.id === state.studentId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>

      <div class="row" style="align-items:flex-end;">
        <div class="field" style="flex:1;"><label>Дата</label><div id="f-date"></div></div>
        <div class="field" style="flex:1;"><label for="f-time">Время</label><input class="input" id="f-time" type="time" value="${initialTime}" ${isLockedCompleted ? 'disabled' : ''} /></div>
      </div>

      <div class="field">
        <label for="f-subject">Предмет</label>
        <select class="input" id="f-subject" ${isLockedCompleted ? 'disabled' : ''}>
          ${db.tutorSubjects.map((s) => `<option value="${s.id}" ${s.id === state.subjectId ? 'selected' : ''}>${escapeHtml(s.subjectName)}</option>`).join('')}
        </select>
        <div class="muted" style="font-size:10.5px;">Заполнено автоматически по предмету ученика — можно изменить</div>
      </div>

      <hr class="divider" />

      <div class="row">
        <span>Занятие проведено</span>
        ${isLockedCompleted ? `<span class="pill pill-success">Проведено</span>` : toggleHtml({ name: 'completed', checked: state.completed })}
      </div>

      <div id="post-lesson-fields"></div>

      ${
        !isLockedCompleted
          ? `<button type="button" class="btn btn-primary solid btn-block" id="save">Сохранить занятие</button>
             ${existing ? `<button type="button" class="btn btn-block" id="cancel-lesson" style="color:var(--danger);border-color:var(--danger-border);">Отменить занятие</button>` : ''}`
          : ''
      }
      <div class="error" id="err" style="display:none;"></div>
    </div>`;

  // date picker
  const dateSlot = document.getElementById('f-date');
  const datePicker = createDatePicker({ initialIso, todayIso, onChange: () => {} });
  if (isLockedCompleted) datePicker.querySelector('.datepicker-trigger').setAttribute('disabled', 'true');
  dateSlot.appendChild(datePicker);

  function renderPostLessonFields() {
    const box = document.getElementById('post-lesson-fields');
    if (!state.completed) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = `
      <div class="card" style="border-left:2px solid var(--accent);">
        <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent);">Отметка о занятии</div>
        <div class="field">
          <label for="f-duration">Фактическая продолжительность (мин)</label>
          <input class="input" id="f-duration" type="number" value="${state.duration}" ${isLockedCompleted ? 'disabled' : ''} />
        </div>
        <div class="field">
          <label for="f-topic">Тема занятия</label>
          <input class="input" id="f-topic" value="${escapeHtml(state.topic)}" ${isLockedCompleted ? 'disabled' : ''} />
        </div>
        <div class="field">
          <label>Оценка</label>
          ${
            isLockedCompleted
              ? `<span style="font-family:var(--font-heading);font-weight:600;font-size:18px;color:${gradeColor(state.grade)};">${state.grade}/10</span>`
              : `<div id="grade-stepper"></div>`
          }
        </div>
        <div class="field">
          <label for="f-comment">Комментарий</label>
          <textarea class="input" id="f-comment" ${isLockedCompleted ? 'disabled' : ''}>${escapeHtml(state.comment)}</textarea>
        </div>
        <div class="muted" style="font-size:11px;">Включение отметит занятие как проведённое и автоматически спишет его с баланса ученика.</div>
      </div>`;

    if (!isLockedCompleted) {
      const stepperBox = document.getElementById('grade-stepper');
      stepperBox.innerHTML = `
        <div class="stepper">
          <button type="button" data-grade="-1">−</button>
          <span class="tabular" style="color:${gradeColor(state.grade)};min-width:16px;text-align:center;">${state.grade}</span>
          <button type="button" data-grade="1">+</button>
          <span class="muted" style="font-size:11px;">из 10</span>
        </div>`;
      stepperBox.querySelectorAll('[data-grade]').forEach((btn) =>
        btn.addEventListener('click', () => {
          state.grade = Math.max(1, Math.min(10, state.grade + Number(btn.dataset.grade)));
          renderPostLessonFields();
        })
      );
      document.getElementById('f-duration').addEventListener('change', (e) => (state.duration = Number(e.target.value)));
      document.getElementById('f-topic').addEventListener('input', (e) => (state.topic = e.target.value));
      document.getElementById('f-comment').addEventListener('input', (e) => (state.comment = e.target.value));
    }
  }
  renderPostLessonFields();

  if (!isLockedCompleted) {
    const toggleBtn = document.querySelector('[data-toggle="completed"]');
    toggleBtn?.addEventListener('click', () => {
      state.completed = !state.completed;
      toggleBtn.classList.toggle('on', state.completed);
      renderPostLessonFields();
    });

    document.getElementById('f-student').addEventListener('change', (e) => {
      state.studentId = e.target.value;
      const s = db.students.find((x) => x.id === state.studentId);
      if (s?.subjectId) {
        state.subjectId = s.subjectId;
        document.getElementById('f-subject').value = s.subjectId;
      }
    });
    document.getElementById('f-subject').addEventListener('change', (e) => (state.subjectId = e.target.value));

    document.getElementById('save').addEventListener('click', async () => {
      const errEl = document.getElementById('err');
      errEl.style.display = 'none';
      if (state.completed && !state.topic.trim()) {
        errEl.textContent = 'Укажите тему занятия';
        errEl.style.display = 'block';
        return;
      }
      const dateIso = datePicker.getValue();
      const timeVal = document.getElementById('f-time').value || '00:00';
      const scheduledAt = new Date(`${dateIso}T${timeVal}:00`).toISOString();

      try {
        if (existing) {
          if (state.completed) {
            await completeLesson(db, existing.id, { actualDurationMin: state.duration, topic: state.topic, grade: state.grade, comment: state.comment });
          }
          navigate(`/students/${existing.studentId}`);
        } else {
          await createLesson(db, {
            studentId: state.studentId,
            scheduledAt,
            subjectId: state.subjectId,
            completedFields: state.completed
              ? { actualDurationMin: state.duration, topic: state.topic, grade: state.grade, comment: state.comment }
              : undefined,
          });
          navigate(`/students/${state.studentId}`);
        }
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    });

    document.getElementById('cancel-lesson')?.addEventListener('click', () => {
      const modal = openModal(`
        <h3>Отменить занятие?</h3>
        <div class="muted" style="font-size:12.5px;">Занятие пропадёт из списка на этот день.</div>
        <button type="button" class="btn" id="confirmCancel" style="background:var(--danger);color:#fff;border-color:var(--danger);">Да, отменить</button>
      `);
      modal.querySelector('#confirmCancel').addEventListener('click', async () => {
        await cancelLesson(db, existing.id);
        closeModal();
        navigate(`/students/${existing.studentId}`);
      });
    });
  }
}
