import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get } from '../api/client';

interface PublicTutorResponse {
  tutor: {
    name: string;
    age: number | null;
    totalExperienceYears: number | null;
    greetingText: string | null;
    rating: number | null;
    reviewCount: number;
    contactTelegram: string | null;
    contactWhatsapp: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  subjects: { subjectName: string; defaultPrice: number }[];
  reviews: { reviewerDisplayName: string | null; reviewerAge: number | null; rating: number; reviewText: string | null }[];
}

export function PublicTutorCard() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicTutorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    get<PublicTutorResponse>(`/public/tutors/${slug}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <div style={{ padding: 24, color: 'var(--danger)' }}>{error}</div>;
  if (!data) return <div style={{ padding: 24, color: 'var(--muted)' }}>Загрузка…</div>;

  const { tutor, subjects, reviews } = data;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 26px', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
      <h2>{tutor.name}</h2>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        {tutor.totalExperienceYears ? `${tutor.totalExperienceYears} лет опыта` : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 28, color: 'var(--accent)' }}>
          {tutor.rating ?? '—'}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>· {tutor.reviewCount} отзывов</span>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, textAlign: 'left' }}>{tutor.greetingText}</p>

      <section style={{ textAlign: 'left', marginTop: 12 }}>
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Предметы и цены</h3>
        {subjects.map((s) => (
          <div key={s.subjectName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
            <span>{s.subjectName}</span>
            <span>{s.defaultPrice} ₽/час</span>
          </div>
        ))}
      </section>

      <section style={{ textAlign: 'left', marginTop: 12 }}>
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Отзывы</h3>
        {reviews.map((r, i) => (
          <div key={i} style={{ border: '1px solid var(--divider)', borderRadius: 11, padding: '12px 13px', marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                {r.reviewerDisplayName ?? 'Аноним'}
                {r.reviewerAge ? `, ${r.reviewerAge}` : ''}
              </span>
              <span style={{ color: 'var(--accent)' }}>{r.rating}/10</span>
            </div>
            <p style={{ fontSize: 12.5, margin: '4px 0 0' }}>{r.reviewText}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
