import { getDb, updatePaymentPolicy, resetDb } from './data.js';
import { renderShell } from './shell.js';
import { escapeHtml } from './format.js';

renderShell('settings');
const content = document.getElementById('content');

async function render() {
  const db = await getDb();
  const p = db.paymentPolicy;

  content.innerHTML = `
    <div style="padding:20px 18px;" class="stack">
      <h2>Настройки</h2>
      <div class="muted" style="font-size:13px;">${escapeHtml(db.tutor.name)} · ${escapeHtml(db.tutor.publicSlug)}</div>

      <section class="stack">
        <h3>Политика оплаты</h3>
        <label style="font-size:12.5px;">
          Блокировать после <strong id="maxUnpaidLabel">${p.maxUnpaidLessons}</strong> неоплаченных занятий
          <input type="range" id="maxUnpaid" min="1" max="10" value="${p.maxUnpaidLessons}" style="width:100%;" />
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <input type="checkbox" id="blockEnabled" ${p.blockEnabled ? 'checked' : ''} />
          Включить автоблокировку
        </label>
      </section>

      <a class="btn" href="tutor-card.html?slug=${encodeURIComponent(db.tutor.publicSlug)}">Публичная карточка репетитора →</a>
      <a class="btn" href="subscription.html">Подписка →</a>

      <button class="btn" id="resetBtn" style="color:var(--danger);border-color:var(--danger-border);">Сбросить демо-данные</button>
    </div>`;

  const maxUnpaid = document.getElementById('maxUnpaid');
  const maxUnpaidLabel = document.getElementById('maxUnpaidLabel');
  const blockEnabled = document.getElementById('blockEnabled');

  async function save() {
    await updatePaymentPolicy(db, {
      maxUnpaidLessons: Number(maxUnpaid.value),
      blockEnabled: blockEnabled.checked,
    });
  }

  maxUnpaid.addEventListener('input', () => {
    maxUnpaidLabel.textContent = maxUnpaid.value;
  });
  maxUnpaid.addEventListener('change', save);
  blockEnabled.addEventListener('change', save);

  document.getElementById('resetBtn').addEventListener('click', () => {
    resetDb();
    location.reload();
  });
}

render().catch((err) => {
  content.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
});
