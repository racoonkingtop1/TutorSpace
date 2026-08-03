import { getDb, checkoutSubscription, cancelSubscription, acceptRetention, validatePromoCode } from '../data.js';
import { renderShell } from '../shell.js';
import { escapeHtml } from '../format.js';
import { openModal, closeModal } from '../widgets.js';

function fmt(n) {
  return Math.round(n).toLocaleString('ru-RU');
}

export async function renderSubscription() {
  renderShell('/subscription');
  const content = document.getElementById('content');
  const db = await getDb();

  const state = { screen: 'plans', selectedPlanKey: null, method: 'card', promo: '', promoResult: null };

  function currentSub() {
    const plan = db.subscriptionPlans.find((p) => p.id === db.tutorSubscription.planId);
    return { sub: db.tutorSubscription, plan };
  }

  function render() {
    if (state.screen === 'plans') return renderPlans();
    if (state.screen === 'payment') return renderPayment();
    if (state.screen === 'success') return renderSuccess();
    if (state.screen === 'fail') return renderFail();
    if (state.screen === 'account') return renderAccount();
    if (state.screen === 'retention') return renderRetention();
  }

  function planCardHtml(p) {
    const { plan: activePlan } = currentSub();
    const isCurrent = activePlan?.key === p.key;
    return `
      <div class="card" style="position:relative;${p.isPopular ? 'border-color:var(--accent);' : ''}">
        ${isCurrent ? `<span class="pill pill-success" style="position:absolute;top:-10px;left:12px;">Текущий план</span>` : ''}
        ${!isCurrent && p.isPopular ? `<span class="pill" style="position:absolute;top:-10px;right:12px;background:var(--accent-tint);color:var(--accent-text);">Популярный</span>` : ''}
        <div style="font-family:var(--font-heading);font-weight:600;font-size:17px;">${escapeHtml(p.name)}</div>
        <div style="font-family:var(--font-heading);font-weight:600;font-size:28px;">
          ${fmt(p.price)} ₽<span class="muted" style="font-size:12.5px;">/${p.billingPeriod === 'year' ? 'год' : 'мес'}</span>
        </div>
        <ul style="font-size:12.5px;padding-left:18px;margin:10px 0;">${p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
        <button type="button" class="btn ${isCurrent ? '' : 'btn-primary solid'} btn-block" data-select-plan="${p.key}" ${isCurrent ? 'disabled' : ''}>
          ${isCurrent ? 'Текущий план' : 'Выбрать план'}
        </button>
      </div>`;
  }

  function renderPlans() {
    const plans = db.subscriptionPlans.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    content.innerHTML = `
      <div style="padding:20px 18px;" class="stack">
        <h2>Подписка</h2>
        <div class="muted" style="font-size:12.5px;">Выберите план, чтобы продолжить работу без ограничений</div>
        <div class="list">${plans.map(planCardHtml).join('')}</div>
        <div class="muted" style="font-size:11px;text-align:center;">Отменить подписку можно в любой момент в настройках</div>
        <a href="javascript:void(0)" id="go-account" style="text-align:center;color:var(--accent);font-size:12.5px;">Управление текущей подпиской →</a>
      </div>`;
    content.querySelectorAll('[data-select-plan]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.selectedPlanKey = btn.dataset.selectPlan;
        state.promo = '';
        state.promoResult = null;
        state.screen = 'payment';
        render();
      })
    );
    document.getElementById('go-account').addEventListener('click', () => {
      state.screen = 'account';
      render();
    });
  }

  function renderPayment() {
    const plan = db.subscriptionPlans.find((p) => p.key === state.selectedPlanKey);
    const discount = state.promoResult?.valid ? state.promoResult.discountPercent : 0;
    const total = Math.round(plan.price * (1 - discount / 100));

    content.innerHTML = `
      <div style="padding:18px;" class="stack">
        <a class="back-link" href="javascript:void(0)" id="back-plans">← Подписка</a>
        <h2>Оплата</h2>
        <div class="card row">
          <div>
            <div style="font-family:var(--font-heading);font-weight:600;">${escapeHtml(plan.name)}</div>
            <div class="muted" style="font-size:11.5px;">${plan.billingPeriod === 'year' ? 'Ежегодное' : 'Ежемесячное'} списание</div>
          </div>
          <div style="font-family:var(--font-heading);font-weight:600;font-size:16px;">${fmt(plan.price)} ₽</div>
        </div>

        <div class="muted" style="font-size:12px;">Способ оплаты</div>
        <div class="stack" style="gap:8px;">
          <button type="button" class="radio-card ${state.method === 'card' ? 'selected' : ''}" data-method="card">
            <span style="display:flex;align-items:center;gap:10px;"><span class="radio-dot">${state.method === 'card' ? '<span class="radio-dot-fill"></span>' : ''}</span>Банковская карта</span>
          </button>
          <button type="button" class="radio-card ${state.method === 'sbp' ? 'selected' : ''}" data-method="sbp">
            <span style="display:flex;align-items:center;gap:10px;"><span class="radio-dot">${state.method === 'sbp' ? '<span class="radio-dot-fill"></span>' : ''}</span>Оплата по СБП</span>
          </button>
        </div>

        ${
          state.method === 'card'
            ? `<div class="stack">
                <div class="field"><label>Номер карты</label><input class="input" value="4242 4242 4242 4242" readonly /></div>
                <div class="row"><div class="field" style="flex:1;"><label>Срок действия</label><input class="input" value="08/28" readonly /></div><div class="field" style="flex:1;"><label>CVV</label><input class="input" value="•••" readonly /></div></div>
                <div class="muted" style="font-size:10px;">Тестовые данные</div>
              </div>`
            : `<div class="muted" style="font-size:12.5px;border:1px dashed var(--divider);border-radius:10px;padding:14px;text-align:center;">После нажатия «Оплатить» откроется приложение банка для подтверждения через СБП</div>`
        }

        <div class="row" style="gap:8px;">
          <input class="input" id="promo" placeholder="Промокод" value="${escapeHtml(state.promo)}" />
          <button type="button" class="btn" id="apply-promo">Применить</button>
        </div>
        ${state.promoResult?.valid ? `<div style="color:var(--success);font-size:11.5px;">Промокод применён — скидка ${state.promoResult.discountPercent}%</div>` : ''}
        ${state.promoResult && !state.promoResult.valid ? `<div style="color:var(--danger);font-size:11.5px;">Промокод не найден</div>` : ''}

        <hr class="divider" />
        <div class="row"><span class="muted">Итого сегодня</span><span style="font-family:var(--font-heading);font-weight:600;font-size:19px;">${fmt(total)} ₽</span></div>

        <button type="button" class="btn btn-primary solid btn-block" id="pay">Оплатить ${fmt(total)} ₽</button>
        <button type="button" class="btn" id="pay-fail" style="color:var(--muted);border:none;font-size:11px;">Смоделировать ошибку оплаты (демо)</button>
      </div>`;

    document.getElementById('back-plans').addEventListener('click', () => {
      state.screen = 'plans';
      render();
    });
    content.querySelectorAll('[data-method]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.method = btn.dataset.method;
        render();
      })
    );
    document.getElementById('apply-promo').addEventListener('click', () => {
      state.promo = document.getElementById('promo').value;
      state.promoResult = state.promo.trim() ? validatePromoCode(db, state.promo) : null;
      render();
    });
    document.getElementById('pay').addEventListener('click', async () => {
      await checkoutSubscription(db, {
        planKey: plan.key,
        method: state.method,
        discountPercent: discount,
        promoCode: state.promoResult?.valid ? state.promo.toUpperCase() : null,
      });
      state.screen = 'success';
      render();
    });
    document.getElementById('pay-fail').addEventListener('click', () => {
      state.screen = 'fail';
      render();
    });
  }

  function renderSuccess() {
    const { plan } = currentSub();
    content.innerHTML = `
      <div style="padding:40px 26px;text-align:center;" class="stack">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--success-tint);color:var(--success);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:26px;">✓</div>
        <h2>Подписка активирована</h2>
        <div class="muted" style="font-size:13px;">План «${escapeHtml(plan.name)}» подключён.</div>
        <button type="button" class="btn btn-primary btn-block" id="done">Готово</button>
      </div>`;
    document.getElementById('done').addEventListener('click', () => {
      state.screen = 'plans';
      render();
    });
  }

  function renderFail() {
    content.innerHTML = `
      <div style="padding:40px 26px;text-align:center;" class="stack">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--danger-tint);color:var(--danger);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:26px;">✕</div>
        <h2>Не удалось провести оплату</h2>
        <div class="muted" style="font-size:13px;">Банк отклонил операцию. Проверьте данные карты или выберите другой способ оплаты.</div>
        <button type="button" class="btn btn-primary solid btn-block" id="retry">Попробовать снова</button>
        <button type="button" class="btn" id="back" style="border:none;color:var(--muted);">Выбрать другой план</button>
      </div>`;
    document.getElementById('retry').addEventListener('click', () => {
      state.screen = 'payment';
      render();
    });
    document.getElementById('back').addEventListener('click', () => {
      state.screen = 'plans';
      render();
    });
  }

  function renderAccount() {
    const { sub, plan } = currentSub();
    const cancelled = sub.cancelAtPeriodEnd;
    const price = sub.discountPercent ? Math.round(plan.price * (1 - sub.discountPercent / 100)) : plan.price;
    content.innerHTML = `
      <div style="padding:18px;" class="stack">
        <a class="back-link" href="javascript:void(0)" id="back-plans">← Подписка</a>
        <h2>Управление подпиской</h2>
        <div class="card stack">
          <div class="row">
            <div style="font-family:var(--font-heading);font-weight:600;font-size:16px;">${escapeHtml(plan.name)}</div>
            <span class="pill ${cancelled ? 'pill-danger' : 'pill-success'}">${cancelled ? 'Отменена' : sub.discountPercent ? `Скидка ${sub.discountPercent}%` : 'Активна'}</span>
          </div>
          <div style="font-family:var(--font-heading);font-weight:600;font-size:22px;">${fmt(price)} ₽/${plan.billingPeriod === 'year' ? 'год' : 'мес'}</div>
          <hr class="divider" />
          <div class="muted" style="font-size:12px;">${cancelled ? 'Доступ действует до' : 'Следующее списание'}</div>
          <div style="font-family:var(--font-heading);font-weight:600;">${new Date(sub.currentPeriodEnd).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        ${
          cancelled
            ? `<div class="muted" style="font-size:12px;">Доступ ко всем функциям плана сохранится до конца оплаченного периода.</div>`
            : `<button type="button" class="btn btn-block" id="go-cancel" style="color:var(--danger);border-color:var(--danger-border);">Отменить подписку</button>`
        }
      </div>`;
    document.getElementById('back-plans').addEventListener('click', () => {
      state.screen = 'plans';
      render();
    });
    document.getElementById('go-cancel')?.addEventListener('click', () => {
      state.screen = 'retention';
      render();
    });
  }

  function renderRetention() {
    const { sub, plan } = currentSub();
    const retentionPrice = Math.round(plan.price * 0.7);
    content.innerHTML = `
      <div style="padding:18px;" class="stack">
        <a class="back-link" href="javascript:void(0)" id="back-account">← Управление подпиской</a>
        <h2>Прежде чем уйти</h2>
        <div style="text-align:center;" class="stack">
          <div style="width:52px;height:52px;border-radius:50%;background:var(--accent-tint);color:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:24px;">✨</div>
          <h3>Скидка 30% на 3 месяца</h3>
          <div class="muted" style="font-size:13px;">Останьтесь с планом «${escapeHtml(plan.name)}» и платите ${fmt(retentionPrice)} ₽ вместо ${fmt(plan.price)} ₽ следующие 3 месяца.</div>
        </div>
        <button type="button" class="btn btn-primary solid btn-block" id="accept">Забрать скидку 30%</button>
        <button type="button" class="btn" id="still-cancel" style="border:none;color:var(--muted);">Всё равно отменить подписку</button>
      </div>`;
    document.getElementById('back-account').addEventListener('click', () => {
      state.screen = 'account';
      render();
    });
    document.getElementById('accept').addEventListener('click', async () => {
      await acceptRetention(db);
      state.screen = 'account';
      render();
    });
    document.getElementById('still-cancel').addEventListener('click', () => {
      const modal = openModal(`
        <h3>Отменить подписку?</h3>
        <div class="muted" style="font-size:12.5px;">Доступ к плану «${escapeHtml(plan.name)}» сохранится до конца периода, затем аккаунт перейдёт на бесплатные ограничения.</div>
        <button type="button" class="btn" id="confirm-cancel" style="background:var(--danger);color:#fff;border-color:var(--danger);">Да, отменить</button>
        <button type="button" class="btn" id="keep">Оставить подписку</button>
      `);
      modal.querySelector('#confirm-cancel').addEventListener('click', async () => {
        await cancelSubscription(db);
        closeModal();
        state.screen = 'account';
        render();
      });
      modal.querySelector('#keep').addEventListener('click', closeModal);
    });
  }

  render();
}
