import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/today', label: 'Сегодня' },
  { to: '/students', label: 'Ученики' },
  { to: '/plan', label: 'План' },
  { to: '/settings', label: 'Настройки' },
];

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

/** Mirrors the 380px phone-frame + bottom tab bar every authenticated screen in the prototype shares. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {DEMO_MODE && (
        <div
          style={{
            fontSize: 11.5,
            textAlign: 'center',
            padding: '6px 10px',
            background: 'var(--accent-tint)',
            color: 'var(--accent-text)',
          }}
        >
          Демо-режим · данные условны и сбрасываются при перезагрузке страницы
        </div>
      )}
      <main style={{ flex: 1, maxWidth: 480, margin: '0 auto', width: '100%', padding: '0 0 72px' }}>
        {children}
      </main>
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          borderTop: '1px solid var(--divider)',
          background: 'var(--bg)',
          padding: '8px 6px 12px',
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            style={({ isActive }) => ({
              flex: 1,
              textAlign: 'center',
              padding: '6px 2px',
              fontSize: 11,
              textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
