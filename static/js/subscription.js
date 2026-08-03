import { getDb, checkoutSubscription } from './data.js';
import { renderShell } from './shell.js';
import { escapeHtml } from './format.js';

renderShell('settings');
const content = document.getElementById('content');

function planCard(p) {
  return `
    <div class="card">
      <div style="font-family:var(--font-heading);font-weight:600;font-size:17px;">${escapeHtml(p.name)}</div>
      <div style="font-family:var(--font-heading);font-weight:600;font-size:28px;">
        ${p.price.toLocaleString('ru-RU')} ₽<span class="muted" style="font-size:12.5px;">/${p.billingPeriod === 'year' ? 'год' : 'мес'}</span>
      </div>
      <ul style="font-size:12.5px;padding-left:18px;margin:10px 0;">
        ${p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
      </ul>
      <button class="btn btn-primary solid btn-block" data-plan="${p.key}">Выбрать план</button>
    </div>`;
}

async function render() {
  const db = await getDb();
  const plans = db.subscriptionPlans.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  content.innerHTML = `
    <div style="padding:20px 18px;" class="stack">
      <a class="back-link" href="settings.html">← Настройки</a>
      <h2>Подписка</h2>
      <div id="status"></div>
      <div class="list">${plans.map(planCard).join('')}</div>
    </div>`;

  content.querySelectorAll('button[data-plan]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await checkoutSubscription(db, btn.dataset.plan);
      document.getElementById('status').innerHTML = `<div style="color:var(--success);font-size:13px;">Подписка активирована</div>`;
    });
  });
}

render().catch((err) => {
  content.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
});
