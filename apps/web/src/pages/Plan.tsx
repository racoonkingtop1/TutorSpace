import type { Plan as PlanEntity, PlanProgress } from '@tutor-service/shared';
import { useEffect, useState } from 'react';
import { get } from '../api/client';

export function Plan() {
  const [plans, setPlans] = useState<PlanEntity[] | null>(null);
  const [progress, setProgress] = useState<Record<string, PlanProgress>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<PlanEntity[]>('/plans')
      .then(async (list) => {
        setPlans(list);
        const entries = await Promise.all(
          list.map(async (p) => [p.id, await get<PlanProgress>(`/plans/${p.id}/progress`)] as const)
        );
        setProgress(Object.fromEntries(entries));
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ padding: 18, color: 'var(--danger)' }}>{error}</div>;

  return (
    <div style={{ padding: '20px 18px' }}>
      <h2 style={{ marginBottom: 16 }}>Статистика</h2>
      {plans?.length === 0 && (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>
          Планов пока нет. Создайте план на неделю/месяц/год, чтобы отслеживать прогресс по доходу, ученикам,
          занятиям и рейтингу.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plans?.map((p) => {
          const prog = progress[p.id];
          return (
            <div key={p.id} style={{ border: '1px solid var(--divider)', borderRadius: 11, padding: 14 }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>
                {p.periodType} · {p.periodStart} — {p.periodEnd}
              </div>
              {prog && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div>
                    Доход: {prog.currentRevenue} {p.targetRevenue ? `/ ${p.targetRevenue} ₽` : '₽'}
                  </div>
                  <div>
                    Ученики: {prog.currentStudents}
                    {p.targetStudents ? ` / ${p.targetStudents}` : ''}
                  </div>
                  <div>
                    Занятия: {prog.currentLessons}
                    {p.targetLessons ? ` / ${p.targetLessons}` : ''}
                  </div>
                  <div>
                    Рейтинг: {prog.currentRating ?? '—'}
                    {p.targetRating ? ` / ${p.targetRating}` : ''}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
