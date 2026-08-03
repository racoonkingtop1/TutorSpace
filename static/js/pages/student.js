import { getDb, enrichStudent, studentDebtStatus } from '../data.js';
import { renderShell } from '../shell.js';
import { money, date, escapeHtml } from '../format.js';

export async function renderStudentProfile({ params }) {
  renderShell('/students');
  const content = document.getElementById('content');
  const db = await getDb();
  const id = params.id;
  const student = db.students.find((s) => s.id === id);
  if (!student) {
    content.innerHTML = '<div class="error">Ученик не найден.</div>';
    return;
  }
  const enriched = enrichStudent(db, student);
  const debt = studentDebtStatus(db, id);

  const lessons = db.lessons.filter((l) => l.studentId === id).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const completedLessons = lessons.filter((l) => l.status === 'completed');
  const payments = db.payments.filter((p) => p.studentId === id).sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  const grades = completedLessons.filter((l) => l.grade != null);
  const subjAvg = grades.length ? Math.round((grades.reduce((sum, l) => sum + l.grade, 0) / grades.length) * 10) / 10 : null;

  const balanceClass = debt.balance >= 0 ? 'balance-positive' : 'balance-negative';
  const balanceLabel = money(debt.balance);

  content.innerHTML = `
    <div style="padding:18px 18px 40px;" class="stack">
      <a class="back-link" href="#/students">← Ученики</a>
      <div>
        <h2>${escapeHtml(student.name)}</h2>
        <div class="muted" style="font-size:12.5px;">${escapeHtml(enriched.subjectName ?? '')}</div>
      </div>

      <div class="card">
        <div class="muted" style="font-size:11.5px;">Баланс</div>
        <div class="tabular ${balanceClass}" style="font-family:var(--font-heading);font-weight:600;font-size:30px;">${balanceLabel}</div>
        <div class="muted" style="font-size:11.5px;">${debt.unpaidCount ? `${debt.unpaidCount} занятие не оплачено` : 'Все занятия оплачены'}</div>
      </div>

      <a class="btn btn-primary btn-block" href="#/lesson/new?studentId=${student.id}">Добавить занятие</a>
      <button type="button" class="btn btn-block" id="ai-analysis">✨ Анализ успеваемости</button>

      ${
        subjAvg != null
          ? `<section>
              <h3 class="section-title">Успеваемость</h3>
              <div class="row card">
                <span>${escapeHtml(enriched.subjectName ?? '')}</span>
                <span style="font-family:var(--font-heading);font-weight:600;font-size:20px;">${subjAvg}</span>
              </div>
            </section>`
          : ''
      }

      <section>
        <h3 class="section-title">История занятий</h3>
        <div class="list">
          ${
            completedLessons.length
              ? completedLessons
                  .map(
                    (l) => `
              <div class="card">
                <div class="row" style="font-size:12px;">
                  <span class="muted">${date(l.scheduledAt)}</span>
                  <span class="muted">Оценка ${l.grade}/10</span>
                </div>
                <div style="font-family:var(--font-heading);font-weight:600;font-size:14.5px;">${escapeHtml(l.topic ?? '')}</div>
                <div class="muted" style="font-size:12px;">${escapeHtml(l.comment ?? '')}</div>
              </div>`
                  )
                  .join('')
              : '<div class="empty">Пока нет проведённых занятий.</div>'
          }
        </div>
      </section>

      <section>
        <h3 class="section-title">Платежи</h3>
        <div class="stack" style="gap:0;">
          ${
            payments.length
              ? payments
                  .map(
                    (p) => `
              <div class="row" style="padding:10px 0;border-bottom:1px solid var(--divider);">
                <div>
                  <div style="font-size:13px;">${date(p.paidAt)}</div>
                  <div class="muted" style="font-size:11px;">${escapeHtml(p.method ?? '')}</div>
                </div>
                <div class="tabular" style="color:var(--success);">${money(p.amount)}</div>
              </div>`
                  )
                  .join('')
              : '<div class="empty">Платежей пока нет.</div>'
          }
        </div>
      </section>
    </div>`;

  document.getElementById('ai-analysis').addEventListener('click', () => {
    alert('AI-анализ успеваемости — недоступно в демо-версии.');
  });
}
