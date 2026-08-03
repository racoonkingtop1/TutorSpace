import type { Lesson } from '@tutor-service/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/client';

type LessonRow = Lesson & { studentName: string; subjectName: string | null; blocked: boolean };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function Today() {
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const date = todayIso();

  useEffect(() => {
    get<LessonRow[]>(`/lessons?date=${date}`)
      .then(setLessons)
      .catch((err) => setError(err.message));
  }, [date]);

  const unpaidCount = lessons?.filter((l) => l.blocked).length ?? 0;

  return (
    <div style={{ padding: '20px 18px' }}>
      <h2 style={{ marginBottom: 4 }}>Сегодня</h2>
      {lessons && (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          {lessons.length} занятий сегодня · {unpaidCount} не оплачено
        </div>
      )}
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {!lessons && !error && <div style={{ color: 'var(--muted)' }}>Загрузка…</div>}
      {lessons?.length === 0 && <div style={{ color: 'var(--muted)' }}>На сегодня занятий нет.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lessons?.map((l) => (
          <div
            key={l.id}
            style={{
              border: `1px solid ${l.blocked ? 'var(--danger-border)' : 'var(--divider)'}`,
              borderRadius: 11,
              padding: 13,
              background: l.blocked ? 'var(--danger-tint)' : 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginRight: 8 }}>
                  {new Date(l.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{l.studentName}</span>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{l.subjectName}</div>
              </div>
              {l.blocked ? (
                <span style={{ fontSize: 12.5, color: 'var(--danger)' }}>Долг</span>
              ) : (
                <Link to={`/lessons/${l.id}`} style={{ fontSize: 12.5, color: 'var(--accent)' }}>
                  Отметить
                </Link>
              )}
            </div>
            {l.blocked && (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--danger-text)',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid var(--danger-border)',
                }}
              >
                Занятие заблокировано до оплаты
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
