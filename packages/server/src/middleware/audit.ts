import type { MiddlewareHandler } from 'hono';
import { getActiveStore } from '../store/fileStore.js';
import { D1Store } from '../store/d1Store.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function inferResource(pathname: string): string {
  const parts = pathname.replace(/^\/api\/v1\//, '').split('/');
  return parts[0] ?? 'unknown';
}

function inferAction(method: string): string {
  switch (method) {
    case 'POST':   return 'create';
    case 'PATCH':
    case 'PUT':    return 'update';
    case 'DELETE': return 'delete';
    default:       return method.toLowerCase();
  }
}

export const auditMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  // Only log successful write operations in cloud mode
  const isCloud = process.env.TT_RUNTIME === 'cloudflare';
  if (!isCloud) return;
  if (!WRITE_METHODS.has(c.req.method)) return;
  if (c.res.status >= 400) return;

  const store = getActiveStore();
  const d1 = store instanceof D1Store ? store : null;
  if (!d1) return;

  const user = c.get('user');
  const url = new URL(c.req.url);

  void d1.insertAuditLog({
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    action: inferAction(c.req.method),
    resource: inferResource(url.pathname),
    resourceId: null,
    metadata: null,
    createdAt: new Date().toISOString(),
  });
};
