const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

let authToken: string | null = localStorage.getItem('token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
export const patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
export const put = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
