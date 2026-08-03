import { getDb, updatePaymentPolicy, updatePaymentReminderSettings, addReminder, deleteReminder, updateCustomReminder, reminderLabel, resetDb } from '../data.js';
import { renderShell } from '../shell.js';
import { navigate } from '../router.js';
import { escapeHtml } from '../format.js';
import { toggleHtml, stepperHtml } from '../widgets.js';
import { getTheme, setTheme } from '../theme.js';

const PRESETS = ['15 минут', '1 час', '2 часа', '1 день', 'Свой вариант'];

function splitOffset(mins) {
  return { days: Math.floor(mins / 1440), hours: Math.floor((mins % 1440) / 60), minutes: mins % 60 };
}

function reminderCard(r) {
  const { days, hours, minutes } = splitOffset(r.offsetMinutes);
  return `
    <div class="card" data-reminder="${r.id}">
      <div class="row">
        <span style="font-size:13px;">${escapeHtml(reminderLabel(r))}</span>
        <button type="button" class="icon-btn" data-delete-reminder="${r.id}" style="border:none;color:var(--muted);">✕</button>
      </div>
      ${
        r.custom
          ? `<div class="row" style="gap:16px;justify-content:flex-start;margin-top:6px;">
              ${['days', 'hours', 'minutes']
                .map(
                  (field, i) => `
                <div class="stack" style="gap:4px;align-items:center;">
                  <span class="muted" style="font-size:10.5px;">${['дн', 'ч', 'мин'][i]}</span>
                  ${stepperHtml({ name: `${r.id}-${field}`, value: { days, hours, minutes }[field] })}
                </div>`
                )
                .join('')}
            </div>`
          : ''
      }
    </div>`;
}

function addReminderControl(target) {
  return `
    <div class="dropdown" data-add-dropdown="${target}">
      <button type="button" class="btn" style="width:100%;border-style:dashed;color:var(--accent);" data-open-add="${target}">+ Добавить напоминание</button>
    </div>`;
}

export async function renderSettings() {
  renderShell('/settings');
  const content = document.getElementById('content');
  const db = await getDb();

  const state = { addOpen: { student: false, tutor: false } };

  function render() {
    const p = db.paymentPolicy;
    const pr = db.paymentReminderSettings;
    const studentReminders = db.reminderSettings.filter((r) => r.target === 'student');
    const tutorReminders = db.reminderSettings.filter((r) => r.target === 'tutor');
    const theme = getTheme();

    content.innerHTML = `
      <div style="padding:20px 18px;" class="stack">
        <h2>Настройки</h2>
        <div class="muted" style="font-size:13px;">${escapeHtml(db.tutor.name)} · ${escapeHtml(db.tutor.publicSlug)}</div>

        <section class="stack">
          <div class="muted" style="font-size:12.5px;">Тема</div>
          <div class="segmented" id="theme-tabs">
            ${['light', 'dark', 'system']
              .map((t) => `<button type="button" data-theme="${t}" class="${t === theme ? 'active' : ''}">${t === 'light' ? 'Светлая' : t === 'dark' ? 'Тёмная' : 'Системная'}</button>`)
              .join('')}
          </div>
        </section>

        <hr class="divider" />

        <section class="stack">
          <h3>Напоминания о занятиях</h3>
          <div class="muted" style="font-size:12px;">Напомнить ученику</div>
          <div class="list">${studentReminders.map(reminderCard).join('') || '<div class="empty">Нет напоминаний</div>'}</div>
          ${addReminderControl('student')}
          ${
            state.addOpen.student
              ? `<div class="dropdown-panel" style="position:static;">${PRESETS.map((label) => `<button type="button" data-preset="student|${label}">${label}</button>`).join('')}</div>`
              : ''
          }

          <div class="muted" style="font-size:12px;margin-top:6px;">Напомнить мне</div>
          <div class="list">${tutorReminders.map(reminderCard).join('') || '<div class="empty">Нет напоминаний</div>'}</div>
          ${addReminderControl('tutor')}
          ${
            state.addOpen.tutor
              ? `<div class="dropdown-panel" style="position:static;">${PRESETS.map((label) => `<button type="button" data-preset="tutor|${label}">${label}</button>`).join('')}</div>`
              : ''
          }
        </section>

        <hr class="divider" />

        <section class="stack">
          <h3>Политика оплаты</h3>
          <div class="row">
            <label style="font-size:12.5px;">Блокировать после N неоплаченных занятий</label>
            ${stepperHtml({ name: 'maxUnpaid', value: p.maxUnpaidLessons })}
          </div>
          <div class="row">
            <span style="font-size:13px;">Включить автоблокировку</span>
            ${toggleHtml({ name: 'blockEnabled', checked: p.blockEnabled })}
          </div>
        </section>

        <hr class="divider" />

        <section class="stack">
          <h3>Напоминания о просрочке</h3>
          <div class="row"><label style="font-size:12.5px;">Начинать через (дней)</label>${stepperHtml({ name: 'startAfter', value: pr.startAfterDays })}</div>
          <div class="row"><label style="font-size:12.5px;">Повторять каждые (дней)</label>${stepperHtml({ name: 'repeatEvery', value: pr.repeatEveryDays })}</div>
          <div class="row"><label style="font-size:12.5px;">Максимум напоминаний</label>${stepperHtml({ name: 'maxReminders', value: pr.maxReminders })}</div>
          <div class="row">
            <span style="font-size:13px;">Включить напоминания о просрочке</span>
            ${toggleHtml({ name: 'remindersEnabled', checked: pr.isEnabled })}
          </div>
        </section>

        <hr class="divider" />

        <a class="btn" href="#/t/${encodeURIComponent(db.tutor.publicSlug)}">Публичная карточка репетитора →</a>
        <a class="btn" href="#/subscription">Подписка →</a>
        <button type="button" class="btn" id="reset-demo" style="color:var(--danger);border-color:var(--danger-border);">Сбросить демо-данные</button>
      </div>`;

    // theme
    content.querySelectorAll('[data-theme]').forEach((btn) =>
      btn.addEventListener('click', () => {
        setTheme(btn.dataset.theme);
        render();
      })
    );

    // reminders: delete
    content.querySelectorAll('[data-delete-reminder]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        await deleteReminder(db, btn.dataset.deleteReminder);
        render();
      })
    );
    // reminders: custom steppers
    content.querySelectorAll('[data-stepper]').forEach((box) => {
      const name = box.dataset.stepper;
      box.querySelectorAll('[data-step]').forEach((btn) =>
        btn.addEventListener('click', async () => {
          const delta = Number(btn.dataset.step);
          if (name === 'maxUnpaid') {
            await updatePaymentPolicy(db, { maxUnpaidLessons: Math.max(1, p.maxUnpaidLessons + delta), blockEnabled: p.blockEnabled });
          } else if (name === 'startAfter') {
            await updatePaymentReminderSettings(db, { ...pr, startAfterDays: Math.max(0, pr.startAfterDays + delta) });
          } else if (name === 'repeatEvery') {
            await updatePaymentReminderSettings(db, { ...pr, repeatEveryDays: Math.max(1, pr.repeatEveryDays + delta) });
          } else if (name === 'maxReminders') {
            await updatePaymentReminderSettings(db, { ...pr, maxReminders: Math.max(1, pr.maxReminders + delta) });
          } else {
            // reminder custom field: "<reminderId>-<field>"
            const idx = name.lastIndexOf('-');
            const reminderId = name.slice(0, idx);
            const field = name.slice(idx + 1);
            const reminder = db.reminderSettings.find((r) => r.id === reminderId);
            if (reminder) {
              const cur = splitOffset(reminder.offsetMinutes);
              cur[field] = Math.max(0, cur[field] + delta);
              await updateCustomReminder(db, reminderId, cur);
            }
          }
          render();
        })
      );
    });

    // toggles
    content.querySelectorAll('[data-toggle]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const name = btn.dataset.toggle;
        if (name === 'blockEnabled') await updatePaymentPolicy(db, { maxUnpaidLessons: p.maxUnpaidLessons, blockEnabled: !p.blockEnabled });
        if (name === 'remindersEnabled') await updatePaymentReminderSettings(db, { ...pr, isEnabled: !pr.isEnabled });
        render();
      })
    );

    // add-reminder dropdowns
    content.querySelectorAll('[data-open-add]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const t = btn.dataset.openAdd;
        state.addOpen[t] = !state.addOpen[t];
        render();
      })
    );
    content.querySelectorAll('[data-preset]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const [target, label] = btn.dataset.preset.split('|');
        await addReminder(db, { target, presetLabel: label, days: 0, hours: 2, minutes: 0 });
        state.addOpen[target] = false;
        render();
      })
    );

    document.getElementById('reset-demo').addEventListener('click', () => {
      resetDb();
      navigate('/today');
      location.reload();
    });
  }

  render();
}
