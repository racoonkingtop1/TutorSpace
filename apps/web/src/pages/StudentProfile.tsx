import type { Lesson, Payment, Student, StudentDebtStatus } from '@tutor-service/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../api/client';

interface StudentProfileResponse {
  student: Student & { subjectName: string | null };
  debt: Partial<StudentDebtStatus>;
  lessons: Lesson[];
  payments: Payment[];
  subjectAverages: { subjectName: string; avgGrade: number }[];
}

export function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<StudentProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    get<StudentProfileResponse>(`/students/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div style={{ padding: 18, color: 'var(--danger)' }}>{error}</div>;
  if (!data) return <div style={{ padding: 18, color: 'var(--muted)' }}>Загрузка…</div>;

  const { student, debt, lessons, payments, subjectAverages } = data;
  const balance = debt.balance ?? 0;

  return (
    <div style={{ padding: '18px 18px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link to="/students" style={{ fontSize: 11.5, color: 'var(--muted)', textDecoration: 'none' }}>
        ← Ученики
      </Link>
      <div>
        <h2 style={{ marginBottom: 4 }}>{student.name}</h2>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{student.subjectName}</div>
      </div>

      <div style={{ border: '1px solid var(--divider)', borderRadius: 11, padding: 14 }}>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Баланс</div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            fontSize: 30,
            fontVariantNumeric: 'tabular-nums',
            color: balance >= 0 ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {balance >= 0 ? '+' : ''}
          {balance} ₽
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {debt.unpaidCount ? `${debt.unpaidCount} занятие не оплачено` : 'Все занятия оплачены'}
        </div>
      </div>

      <Link
        to={`/lessons/new?studentId=${student.id}`}
        style={{
          textAlign: 'center',
          border: '1px solid var(--accent)',
          borderRadius: 10,
          padding: 11,
          color: 'var(--accent)',
          textDecoration: 'none',
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
        }}
      >
        Добавить занятие
      </Link>

      {subjectAverages.length > 0 && (
        <section>
          <h3 style={{ marginBottom: 10, fontSize: 16 }}>Успеваемость</h3>
          {subjectAverages.map((sa) => (
            <div
              key={sa.subjectName}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                border: '1px solid var(--divider)',
                borderRadius: 11,
                padding: '11px 13px',
              }}
            >
              <span>{sa.subjectName}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20 }}>
                {sa.avgGrade}
              </span>
            </div>
          ))}
        </section>
      )}

      <section>
        <h3 style={{ marginBottom: 10, fontSize: 16 }}>История занятий</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {lessons
            .filter((l) => l.status === 'completed')
            .map((l) => (
              <div key={l.id} style={{ border: '1px solid var(--divider)', borderRadius: 11, padding: '11px 13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                  <span>{new Date(l.scheduledAt).toLocaleDateString('ru-RU')}</span>
                  <span>Оценка {l.grade}/10</span>
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5 }}>{l.topic}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.comment}</div>
              </div>
            ))}
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: 10, fontSize: 16 }}>Платежи</h3>
        <div>
          {payments.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--divider)',
              }}
            >
              <div>
                <div style={{ fontSize: 13 }}>{new Date(p.paidAt).toLocaleDateString('ru-RU')}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.method}</div>
              </div>
              <div style={{ color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>+{p.amount} ₽</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
