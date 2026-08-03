import type { SubscriptionPlan } from '@tutor-service/shared';
import { useEffect, useState } from 'react';
import { get, post } from '../api/client';

export function Subscription() {
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    get<SubscriptionPlan[]>('/subscriptions/plans')
      .then(setPlans)
      .catch((e) => setError(e.message));
  }, []);

  async function choose(planKey: string) {
    setStatus(null);
    try {
      await post('/subscriptions/checkout', { planKey, method: 'card' });
      setStatus('Подписка активирована');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось оформить подписку');
    }
  }

  return (
    <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2>Подписка</h2>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      {status && <div style={{ color: 'var(--success)', fontSize: 13 }}>{status}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {plans?.map((p) => (
          <div key={p.id} style={{ border: '1px solid var(--divider)', borderRadius: 12, padding: 18 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17 }}>{p.name}</div>
            <div style={{ fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
              {p.price} ₽<span style={{ fontSize: 12.5, color: 'var(--muted)' }}>/{p.billingPeriod}</span>
            </div>
            <ul style={{ fontSize: 12.5, paddingLeft: 18, margin: '10px 0' }}>
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button
              onClick={() => choose(p.key)}
              style={{
                width: '100%',
                border: '1px solid var(--accent)',
                borderRadius: 10,
                padding: 10,
                background: 'var(--accent)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Выбрать план
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
