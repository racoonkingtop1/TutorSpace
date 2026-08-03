import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { buttonStyle, inputStyle } from './Login';

export function Register() {
  const { register, isLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '', publicSlug: '' });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(form);
      navigate('/today');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось зарегистрироваться');
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: '0 16px' }}>
      <h2 style={{ marginBottom: 24 }}>Регистрация репетитора</h2>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          placeholder="Имя"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          placeholder="URL профиля (ivanov-matematika)"
          value={form.publicSlug}
          onChange={(e) => setForm({ ...form, publicSlug: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Пароль (мин. 8 символов)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          style={inputStyle}
        />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={isLoading} style={buttonStyle}>
          {isLoading ? 'Создаём…' : 'Создать аккаунт'}
        </button>
      </form>
    </div>
  );
}
