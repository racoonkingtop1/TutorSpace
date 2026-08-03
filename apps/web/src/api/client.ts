const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// GitHub Pages serves static files only — there's no Express/Postgres to
// call there, so the production build (`vite build`, which loads
// .env.production) runs entirely against the bundled demo dataset instead.
// See apps/web/src/demo/mockServer.ts and docs/demo-mode.md.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

let authToken: string | null = localStorage.getItem('token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (DEMO_MODE) {
    const { mockRequest, MockHttpError } = await import('../demo/mockServer');
    const method = (options.method ?? 'GET').toUpperCase();
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : undefined;
    try {
      return (await mockRequest(method, path, body)) as T;
    } catch (err) {
      if (err instanceof MockHttpError) throw new Error(err.message);
      throw err;
    }
  }

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
