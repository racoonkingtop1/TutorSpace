import { getDb, tutorRating } from './data.js';
import { qs, escapeHtml } from './format.js';

const content = document.getElementById('content');
const slug = qs('slug');

async function render() {
  const db = await getDb();
  const t = db.tutor;
  if (!slug || t.publicSlug !== slug) {
    content.innerHTML = '<div class="error">Репетитор не найден.</div>';
    return;
  }

  const { rating, reviewCount } = tutorRating(db);
  const subjects = db.tutorSubjects.filter((s) => s.isActive);
  const reviews = db.reviews.filter((r) => !r.isHidden).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const contacts = [
    t.contactTelegram && ['Telegram', t.contactTelegram],
    t.contactWhatsapp && ['WhatsApp', t.contactWhatsapp],
    t.contactEmail && ['Email', t.contactEmail],
    t.contactPhone && ['Телефон', t.contactPhone],
  ].filter(Boolean);

  content.innerHTML = `
    <div class="stack" style="text-align:center;">
      <h2>${escapeHtml(t.name)}</h2>
      <div class="muted" style="font-size:13px;">${t.totalExperienceYears ? `${t.totalExperienceYears} лет опыта` : ''}</div>
      <div style="display:flex;align-items:baseline;gap:6px;justify-content:center;">
        <span style="font-family:var(--font-heading);font-weight:600;font-size:28px;color:var(--accent);">${rating ?? '—'}</span>
        <span class="muted" style="font-size:12.5px;">· ${reviewCount} отзывов</span>
      </div>
      <p style="font-size:13.5px;line-height:1.6;text-align:left;">${escapeHtml(t.greetingText ?? '')}</p>

      <section style="text-align:left;margin-top:12px;">
        <h3 class="section-title">Предметы и цены</h3>
        <div class="stack" style="gap:6px;">
          ${subjects
            .map(
              (s) => `<div class="row"><span>${escapeHtml(s.subjectName)}</span><span>${s.defaultPrice.toLocaleString('ru-RU')} ₽/час</span></div>`
            )
            .join('')}
        </div>
      </section>

      ${
        contacts.length
          ? `<section style="text-align:left;margin-top:12px;">
              <h3 class="section-title">Контакты</h3>
              <div class="stack" style="gap:6px;font-size:13px;">
                ${contacts.map(([label, value]) => `<div><span class="muted">${label}:</span> ${escapeHtml(value)}</div>`).join('')}
              </div>
            </section>`
          : ''
      }

      <section style="text-align:left;margin-top:12px;">
        <h3 class="section-title">Отзывы</h3>
        <div class="list">
          ${reviews
            .map(
              (r) => `
            <div class="card">
              <div class="row">
                <strong style="font-family:var(--font-heading);">${escapeHtml(r.reviewerDisplayName ?? 'Аноним')}${r.reviewerAge ? `, ${r.reviewerAge}` : ''}</strong>
                <span style="color:var(--accent);">${r.rating}/10</span>
              </div>
              <p style="font-size:12.5px;margin-top:4px;">${escapeHtml(r.reviewText ?? '')}</p>
            </div>`
            )
            .join('')}
        </div>
      </section>
    </div>`;
}

render().catch((err) => {
  content.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
});
