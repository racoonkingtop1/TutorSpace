import { useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export function Login() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/today');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 24 }}>Вход</h2>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={isLoading} style={buttonStyle}>
          {isLoading ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

export const inputStyle: CSSProperties = {
  border: '1px solid var(--divider)',
  borderRadius: 10,
  padding: '10px 12px',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  background: 'transparent',
  color: 'var(--text)',
};

export const buttonStyle: CSSProperties = {
  border: '1px solid var(--accent)',
  borderRadius: 10,
  padding: '11px',
  fontFamily: 'var(--font-heading)',
  fontWeight: 600,
  fontSize: 14,
  background: 'transparent',
  color: 'var(--accent)',
  cursor: 'pointer',
};
