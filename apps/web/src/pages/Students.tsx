import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/client';

interface StudentRow {
  id: string;
  name: string;
  age: number | null;
  subjectName: string | null;
  balance: number | null;
  isBlocked: boolean | null;
}

export function Students() {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    get<StudentRow[]>(`/students?${params}`)
      .then(setStudents)
      .catch((err) => setError(err.message));
  }, [search]);

  return (
    <div style={{ padding: '20px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Ученики</h2>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{students?.length ?? ''}</span>
      </div>
      <input
        placeholder="Поиск по имени"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          border: '1px solid var(--divider)',
          borderRadius: 10,
          padding: '9px 12px',
          fontSize: 13,
          background: 'transparent',
          color: 'var(--text)',
          marginBottom: 14,
        }}
      />
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {students?.map((s) => (
          <Link
            key={s.id}
            to={`/students/${s.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid var(--divider)',
              borderRadius: 10,
              padding: '10px 12px',
              textDecoration: 'none',
              color: 'var(--text)',
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                {s.name}
                {s.age ? `, ${s.age}` : ''}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.subjectName}</div>
            </div>
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontSize: 13,
                color: s.isBlocked ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {s.balance != null ? `${s.balance > 0 ? '+' : ''}${s.balance} ₽` : ''}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
