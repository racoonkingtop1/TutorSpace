import type { Tutor } from '@tutor-service/shared';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { post, setAuthToken } from '../api/client';

interface AuthState {
  tutor: Tutor | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; publicSlug: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    <AuthContext.Provider value={{ tutor, isLoading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
