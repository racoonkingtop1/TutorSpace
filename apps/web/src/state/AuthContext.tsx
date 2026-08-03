import type { Tutor } from '@tutor-service/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { post, setAuthToken } from '../api/client';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

interface AuthState {
  tutor: Tutor | null;
  isLoading: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; publicSlug: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Starts true only in demo mode, where we auto-sign-in as the seeded demo
  // tutor so a GitHub Pages visitor lands straight in a "used" app instead
  // of an empty login screen.
  const [isBootstrapping, setIsBootstrapping] = useState(DEMO_MODE);

  useEffect(() => {
    if (!DEMO_MODE) return;
    post<{ token: string; tutor: Tutor }>('/auth/login', { email: 'demo@tutorspace.app', password: 'demo' })
      .then(({ token, tutor }) => {
        setAuthToken(token);
        setTutor(tutor);
      })
      .finally(() => setIsBootstrapping(false));
  }, []);

  async function login(email: string, password: string) {
    setIsLoading(true);
    try {
      const { token, tutor } = await post<{ token: string; tutor: Tutor }>('/auth/login', { email, password });
      setAuthToken(token);
      setTutor(tutor);
    } finally {
      setIsLoading(false);
    }
  }

  async function register(input: { email: string; password: string; name: string; publicSlug: string }) {
    setIsLoading(true);
    try {
      const { token, tutor } = await post<{ token: string; tutor: Tutor }>('/auth/register', input);
      setAuthToken(token);
      setTutor(tutor);
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    setAuthToken(null);
    setTutor(null);
  }

  return (
    <AuthContext.Provider value={{ tutor, isLoading, isBootstrapping, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
