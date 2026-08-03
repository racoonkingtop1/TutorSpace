import type { PaymentPolicy } from '@tutor-service/shared';
import { useEffect, useState } from 'react';
import { get, put } from '../api/client';
import { useAuth } from '../state/AuthContext';

export function Settings() {
  const { tutor, logout } = useAuth();
  const [policy, setPolicy] = useState<PaymentPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<PaymentPolicy>('/settings/payment-policy')
      .then(setPolicy)
      .catch((e) => setError(e.message));
  }, []);

  async function savePolicy(next: PaymentPolicy) {
    setPolicy(next);
    try {
      await put('/settings/payment-policy', { maxUnpaidLessons: next.maxUnpaidLessons, blockEnabled: next.blockEnabled });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    }
  }

  return (
    <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2>Настройки</h2>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{tutor?.name}</div>

      {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {policy && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 16 }}>Политика оплаты</h3>
          <label style={{ fontSize: 12.5 }}>
            Блокировать после {policy.maxUnpaidLessons} неоплаченных занятий
            <input
              type="range"
              min={1}
              max={10}
              value={policy.maxUnpaidLessons}
              onChange={(e) => savePolicy({ ...policy, maxUnpaidLessons: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={policy.blockEnabled}
              onChange={(e) => savePolicy({ ...policy, blockEnabled: e.target.checked })}
            />
            Включить автоблокировку
          </label>
        </section>
      )}

      <button
        onClick={logout}
        style={{
          marginTop: 'auto',
          border: '1px solid var(--divider)',
          borderRadius: 10,
          padding: 11,
          background: 'transparent',
          color: 'var(--text)',
          cursor: 'pointer',
        }}
      >
        Выйти
      </button>
    </div>
  );
}
