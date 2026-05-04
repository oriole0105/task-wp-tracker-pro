type Params = Record<string, string | number | boolean | undefined>;

export class ApiClient {
  private readonly base: string;
  private readonly token: string;

  constructor() {
    this.base = (process.env.TT_API_URL ?? 'http://127.0.0.1:5174').replace(/\/$/, '');
    this.token = process.env.TT_TOKEN ?? '';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    };
  }

  private url(path: string, params?: Params): string {
    const u = new URL(`${this.base}/api/v1${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  async get(path: string, params?: Params): Promise<unknown> {
    const res = await fetch(this.url(path, params), { headers: this.headers() });
    return res.json();
  }

  async getText(path: string, params?: Params): Promise<string> {
    const res = await fetch(this.url(path, params), { headers: this.headers() });
    return res.text();
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(this.url(path), {
      method: 'POST',
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async patch(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(this.url(path), {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async delete(path: string): Promise<unknown> {
    const res = await fetch(this.url(path), {
      method: 'DELETE',
      headers: this.headers(),
    });
    return res.json();
  }
}

// ── Response helpers ──────────────────────────────────────────────────────────

export type ToolResult = { content: [{ type: 'text'; text: string }] };

export function text(s: string): ToolResult {
  return { content: [{ type: 'text', text: s }] };
}

export function json(d: unknown): ToolResult {
  return text(JSON.stringify(d, null, 2));
}

export function handleError(e: unknown): ToolResult {
  const msg = e instanceof Error ? e.message : String(e);
  const apiUrl = process.env.TT_API_URL ?? 'http://127.0.0.1:5174';
  if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('Failed to fetch')) {
    return text(`錯誤：無法連線到 task-time-tracker server（${apiUrl}）。\n請先執行：npm run dev:server`);
  }
  return text(`錯誤：${msg}`);
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' or ISO string → epoch ms, undefined if blank */
export function parseDate(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const ms = new Date(s).getTime();
  return isNaN(ms) ? undefined : ms;
}
