// Typed HTTP client for the task-time-tracker server.
// Token is fetched once from /system/handshake and cached in sessionStorage.

const BASE = '/api/v1';
const SESSION_KEY = 'tt-token';

async function fetchToken(): Promise<string> {
  const cached = sessionStorage.getItem(SESSION_KEY);
  if (cached) return cached;
  const res = await fetch('/system/handshake');
  if (!res.ok) throw new Error('Failed to reach server handshake');
  const { data } = await res.json();
  sessionStorage.setItem(SESSION_KEY, data.token);
  return data.token;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function headers(): Promise<HeadersInit> {
  const token = await fetchToken();
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

export const api = {
  async get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const res = await fetch(buildUrl(path, params), { headers: await headers() });
    return res.json() as Promise<T>;
  },

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: await headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return res.json() as Promise<T>;
  },

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(buildUrl(path), {
      method: 'PATCH',
      headers: await headers(),
      body: JSON.stringify(body),
    });
    return res.json() as Promise<T>;
  },

  async delete<T = unknown>(path: string): Promise<T> {
    const res = await fetch(buildUrl(path), {
      method: 'DELETE',
      headers: await headers(),
    });
    return res.json() as Promise<T>;
  },

  /** Build SSE URL with token (token must already be cached). */
  async sseUrl(): Promise<string> {
    const token = await fetchToken();
    const url = new URL('/system/events', window.location.origin);
    url.searchParams.set('token', token);
    return url.toString();
  },
};

/** Fire-and-forget sync: logs error, does not throw. */
export function fireSync(promise: Promise<unknown>): void {
  promise.catch(err => {
    console.warn('[api-sync]', err instanceof Error ? err.message : err);
  });
}
