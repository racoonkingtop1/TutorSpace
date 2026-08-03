import { getDb, enrichStudent } from './data.js';
import { renderShell } from './shell.js';
import { escapeHtml } from './format.js';

renderShell('students');
const content = document.getElementById('content');

function studentRow(s) {
  const balanceClass = s.isBlocked ? 'balance-negative' : s.balance >= 0 ? 'balance-positive' : 'balance-negative';
  const balanceLabel = `${s.balance > 0 ? '+' : ''}${Math.round(s.balance).toLocaleString('ru-RU')} ₽`;
  return `
    <a class="list-link" href="student.html?id=${s.id}">
      <div>
        <div style="font-family:var(--font-heading);font-weight:600;">${escapeHtml(s.name)}${s.age ? `, ${s.age}` : ''}</div>
        <div class="muted" style="font-size:11.5px;">${escapeHtml(s.subjectName ?? '')}</div>
      </div>
      <span class="tabular ${balanceClass}">${balanceLabel}</span>
    </a>`;
}

async function render() {
  const db = await getDb();
  const students = db.students.map((s) => enrichStudent(db, s)).sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  content.innerHTML = `
    <div style="padding:20px 18px;">
      <div class="row" style="justify-content:flex-start;gap:8px;margin-bottom:12px;">
        <h2>Ученики</h2>
        <span class="muted" style="font-size:12.5px;">${students.length}</span>
      </div>
      <input class="input" id="search" placeholder="Поиск по имени" style="margin-bottom:14px;" />
      <div class="muted" id="count" style="font-size:11px;margin-bottom:10px;"></div>
      <div class="list" id="list"></div>
    </div>`;

  const listEl = document.getElementById('list');
  const countEl = document.getElementById('count');
  const searchEl = document.getElementById('search');

  function renderList() {
    const q = searchEl.value.trim().toLowerCase();
    const filtered = q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;
    countEl.textContent = `Найдено: ${filtered.length}`;
    listEl.innerHTML = filtered.map(studentRow).join('') || '<div class="empty">Никого не найдено.</div>';
  }

  searchEl.addEventListener('input', renderList);
  renderList();
}

render().catch((err) => {
  content.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
});
