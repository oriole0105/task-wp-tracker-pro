// Typed HTTP client for the task-time-tracker server.
// Token is fetched once from /system/handshake and cached in sessionStorage.

const BASE = '/api/v1';
const SESSION_KEY = 'tt-token';
const CLOUD_TOKEN_KEY = 'tt-cloud-token';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class TokenRequiredError extends Error {
  constructor() {
    super('Cloud token required');
    this.name = 'TokenRequiredError';
  }
}

async function fetchToken(): Promise<string> {
  const cached = sessionStorage.getItem(SESSION_KEY);
  if (cached) return cached;

  // 嘗試自動取得 token（本機模式）
  const res = await fetch('/system/handshake');
  if (res.ok) {
    const { data } = await res.json() as { data: { token: string } };
    sessionStorage.setItem(SESSION_KEY, data.token);
    return data.token;
  }

  // handshake 回 403 → 雲端模式，需要使用者提供 token
  if (res.status === 403) {
    const cloudToken = localStorage.getItem(CLOUD_TOKEN_KEY);
    if (cloudToken) {
      sessionStorage.setItem(SESSION_KEY, cloudToken);
      return cloudToken;
    }
    throw new TokenRequiredError();
  }

  throw new Error('Failed to reach server handshake');
}

export function setCloudToken(token: string): void {
  localStorage.setItem(CLOUD_TOKEN_KEY, token);
  sessionStorage.setItem(SESSION_KEY, token);
}

export function clearCloudToken(): void {
  localStorage.removeItem(CLOUD_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
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

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  async get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const res = await fetch(buildUrl(path, params), { headers: await headers() });
    return parseResponse<T>(res);
  },

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: await headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return parseResponse<T>(res);
  },

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(buildUrl(path), {
      method: 'PATCH',
      headers: await headers(),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  },

  async delete<T = unknown>(path: string): Promise<T> {
    const res = await fetch(buildUrl(path), {
      method: 'DELETE',
      headers: await headers(),
    });
    return parseResponse<T>(res);
  },

  async getText(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<string> {
    const res = await fetch(buildUrl(path, params), { headers: await headers() });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.text();
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
