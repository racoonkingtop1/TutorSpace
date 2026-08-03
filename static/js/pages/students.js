import { getDb, enrichStudent, createStudent } from '../data.js';
import { renderShell } from '../shell.js';
import { money, escapeHtml } from '../format.js';
import { openModal, closeModal } from '../widgets.js';

function studentRow(s) {
  const balanceClass = s.balance >= 0 ? 'balance-positive' : 'balance-negative';
  const balanceLabel = money(s.balance);
  return `
    <a class="list-link" href="#/students/${s.id}">
      <div style="display:flex;align-items:center;gap:9px;min-width:0;">
        <span class="legend-swatch" style="background:${s.isBlocked ? 'var(--danger)' : s.status === 'paused' ? 'var(--muted)' : 'var(--success)'};border-radius:50%;flex:none;"></span>
        <div style="min-width:0;">
          <div style="font-family:var(--font-heading);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.name)}${s.age ? `, ${s.age}` : ''}</div>
          <div class="muted" style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.subjectName ?? '')}</div>
        </div>
      </div>
      <span class="tabular ${balanceClass}" style="flex:none;">${balanceLabel}</span>
    </a>`;
}

function openAddStudentModal(db, onCreated) {
  const subjects = db.tutorSubjects.filter((s) => s.isActive);
  const modal = openModal(`
    <h3>Новый ученик</h3>
    <div class="field"><label for="add-name">Имя</label><input class="input" id="add-name" /></div>
    <div class="field"><label for="add-age">Возраст</label><input class="input" id="add-age" type="number" min="3" max="100" /></div>
    <div class="field"><label for="add-subject">Предмет</label>
      <select class="input" id="add-subject">${subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.subjectName)}</option>`).join('')}</select>
    </div>
    <div class="error" id="add-err" style="display:none;"></div>
    <button type="button" class="btn btn-primary solid btn-block" id="add-save">Добавить</button>
  `);
  modal.querySelector('#add-save').addEventListener('click', async () => {
    const name = modal.querySelector('#add-name').value.trim();
    if (!name) {
      const err = modal.querySelector('#add-err');
      err.textContent = 'Укажите имя ученика';
      err.style.display = 'block';
      return;
    }
    await createStudent(db, {
      name,
      age: Number(modal.querySelector('#add-age').value) || null,
      subjectId: modal.querySelector('#add-subject').value,
    });
    closeModal();
    onCreated();
  });
}

export async function renderStudents() {
  renderShell('/students');
  const content = document.getElementById('content');
  const db = await getDb();
  const students = db.students.map((s) => enrichStudent(db, s)).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const subjects = db.tutorSubjects;

  content.innerHTML = `
    <div style="padding:20px 18px 6px;">
      <div class="row">
        <div style="display:flex;align-items:center;gap:8px;">
          <h2>Ученики</h2>
          <span class="muted" style="font-size:12.5px;">${students.length}</span>
          <button type="button" class="icon-btn" id="add-student" style="border-radius:50%;background:var(--accent-tint);color:var(--accent);border:none;">+</button>
        </div>
        <a href="#/lessons-history" class="muted" style="font-size:12px;text-decoration:none;color:var(--accent);">История занятий ›</a>
      </div>
    </div>

    <div style="padding:6px 18px 4px;" class="stack">
      <div class="row" style="gap:8px;">
        <select class="input" id="filter-subject" style="flex:1;">
          <option value="">Все предметы</option>
          ${subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.subjectName)}</option>`).join('')}
        </select>
        <label style="display:flex;align-items:center;gap:6px;border:1px solid var(--divider);border-radius:10px;padding:9px;font-size:11px;white-space:nowrap;flex:none;">
          <input type="checkbox" id="filter-debt" /> Долг
        </label>
      </div>
      <input class="input" id="search" placeholder="Поиск по имени" />
      <div class="muted" id="count" style="font-size:11px;"></div>
    </div>

    <div style="padding:6px 18px 8px;" class="list" id="list"></div>

    <div style="padding:0 18px 20px;" class="stack">
      <button type="button" class="btn btn-block" id="ai-analysis">✨ Анализ успеваемости</button>
    </div>`;

  const listEl = document.getElementById('list');
  const countEl = document.getElementById('count');
  const searchEl = document.getElementById('search');
  const subjectEl = document.getElementById('filter-subject');
  const debtEl = document.getElementById('filter-debt');

  function renderList() {
    const q = searchEl.value.trim().toLowerCase();
    const subjectId = subjectEl.value;
    const onlyDebt = debtEl.checked;
    const filtered = students
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
      .filter((s) => (subjectId ? s.subjectId === subjectId : true))
      .filter((s) => (onlyDebt ? s.isBlocked : true));
    countEl.textContent = `Найдено: ${filtered.length}`;
    listEl.innerHTML = filtered.map(studentRow).join('') || '<div class="empty">Никого не найдено.</div>';
  }

  searchEl.addEventListener('input', renderList);
  subjectEl.addEventListener('change', renderList);
  debtEl.addEventListener('change', renderList);
  renderList();

  document.getElementById('add-student').addEventListener('click', () => {
    openAddStudentModal(db, () => {
      renderStudents();
    });
  });
  document.getElementById('ai-analysis').addEventListener('click', () => {
    alert('AI-анализ успеваемости — недоступно в демо-версии.');
  });
}
