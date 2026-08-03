import { getDb, tutorRating } from '../data.js';
import { renderShell } from '../shell.js';
import { escapeHtml } from '../format.js';
import { openModal, closeModal } from '../widgets.js';

const CONTACT_META = {
  telegram: { label: 'Telegram', href: (v) => `https://t.me/${v.replace('@', '')}` },
  whatsapp: { label: 'WhatsApp', href: (v) => `https://wa.me/${v.replace(/\D/g, '')}` },
  email: { label: 'Email', href: (v) => `mailto:${v}` },
  phone: { label: 'Позвонить', href: (v) => `tel:${v.replace(/\s/g, '')}` },
};

export async function renderTutorCard({ params }) {
  renderShell('/t', { hasChrome: false }); // public page, no app navigation — matches the original design
  const content = document.getElementById('content');
  content.style.maxWidth = '480px';
  content.style.margin = '0 auto';
  content.style.padding = '0';

  const db = await getDb();
  const t = db.tutor;
  if (t.publicSlug !== params.slug) {
    content.innerHTML = '<div class="error" style="padding:24px;">Репетитор не найден.</div>';
    return;
  }

  const { rating, reviewCount } = tutorRating(db);
  const subjects = db.tutorSubjects.filter((s) => s.isActive);
  const reviews = db.reviews.filter((r) => !r.isHidden).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const contactEntries = [
    t.contactTelegram && ['telegram', t.contactTelegram],
    t.contactWhatsapp && ['whatsapp', t.contactWhatsapp],
    t.contactEmail && ['email', t.contactEmail],
    t.contactPhone && ['phone', t.contactPhone],
  ].filter(Boolean);

  content.innerHTML = `
    <div style="padding:26px 26px 20px;text-align:center;" class="stack">
      <div class="avatar-box">Фото</div>
      <h2 style="margin-top:6px;">${escapeHtml(t.name)}</h2>
      <div class="muted" style="font-size:13px;">${t.totalExperienceYears ? `${t.totalExperienceYears} лет опыта` : ''}</div>
      <div style="display:flex;align-items:baseline;gap:6px;justify-content:center;">
        <span style="font-family:var(--font-heading);font-weight:600;font-size:28px;color:var(--accent);">${rating ?? '—'}</span>
        <span class="muted" style="font-size:12.5px;">· ${reviewCount} отзывов</span>
      </div>
    </div>

    <div style="padding:0 26px 22px;">
      <p style="font-size:13.5px;line-height:1.65;text-align:justify;">${escapeHtml(t.greetingText ?? '')}</p>
    </div>

    <hr class="divider" style="margin:0 26px;" />

    <div style="padding:20px 26px;">
      <h3 class="section-title">Предметы и цены</h3>
      <div class="stack" style="gap:10px;">
        ${subjects.map((s) => `<div class="row"><span style="font-size:13.5px;">${escapeHtml(s.subjectName)}</span><span class="tabular" style="font-size:13.5px;">${s.defaultPrice.toLocaleString('ru-RU')} ₽/час</span></div>`).join('')}
      </div>
    </div>

    <hr class="divider" style="margin:0 26px;" />

    <div style="padding:20px 26px;">
      <h3 class="section-title">Отзывы</h3>
      <div class="list">
        ${reviews
          .map(
            (r) => `
          <div class="card">
            <div class="row">
              <strong style="font-family:var(--font-heading);font-size:14px;">${escapeHtml(r.reviewerDisplayName ?? 'Аноним')}${r.reviewerAge ? `, ${r.reviewerAge}` : ''}</strong>
              <span class="tabular" style="color:var(--accent);font-size:12.5px;">${r.rating}/10</span>
            </div>
            <div class="muted" style="font-size:11px;">${escapeHtml(r.subjectName ?? '')}</div>
            <p style="font-size:12.5px;margin-top:4px;">${escapeHtml(r.reviewText ?? '')}</p>
          </div>`
          )
          .join('')}
      </div>
    </div>

    <div style="padding:6px 26px 30px;">
      <button type="button" class="btn btn-primary btn-block" id="write-tutor">✉ Написать репетитору</button>
    </div>`;

  document.getElementById('write-tutor').addEventListener('click', () => {
    const modal = openModal(`
      <div class="row"><h3>Способ связи</h3><button type="button" class="icon-btn" id="close-modal" style="border:none;">✕</button></div>
      ${
        contactEntries.length
          ? `<div class="stack">
              ${contactEntries
                .map(([key, value]) => {
                  const meta = CONTACT_META[key];
                  return `<a href="${meta.href(value)}" style="display:flex;flex-direction:column;gap:2px;border:1px solid var(--divider);border-radius:10px;padding:9px 11px;text-decoration:none;color:var(--text);">
                    <span style="font-size:13px;">${meta.label}</span>
                    <span class="muted" style="font-size:11px;">${escapeHtml(value)}</span>
                  </a>`;
                })
                .join('')}
            </div>`
          : `<div class="muted" style="font-size:12.5px;">Репетитор пока не указал способы связи.</div>`
      }
    `);
    modal.querySelector('#close-modal').addEventListener('click', closeModal);
  });
}
