import type { MiddlewareHandler } from 'hono';
import { getToken, getActiveStore } from '../store/fileStore.js';
import { D1Store, hashToken, dbUserToAuthUser } from '../store/d1Store.js';
import type { AuthUser, UserRole } from '@tt/shared/types';

// Extend Hono's ContextVariableMap so all routes get typed c.get('user')
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

let cachedToken: string | null = null;

const LOCAL_ADMIN: AuthUser = {
  id: 'local-admin',
  email: null,
  name: 'Admin',
  role: 'admin',
  tokenPrefix: 'local',
  lastUsedAt: null,
  isActive: true,
};

const unauthorized = (msg = 'Invalid or missing token') =>
  Response.json({ ok: false, error: { code: 'UNAUTHORIZED', message: msg } }, { status: 401 });

const forbidden = (msg = '權限不足') =>
  Response.json({ ok: false, error: { code: 'FORBIDDEN', message: msg } }, { status: 403 });

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const isCloud = process.env.TT_RUNTIME === 'cloudflare';

  if (!isCloud) {
    // ── Local mode: single-token comparison (unchanged behaviour) ──────────
    if (!cachedToken) cachedToken = await getToken();
    const provided =
      c.req.query('token') ?? c.req.header('Authorization')?.replace('Bearer ', '');
    if (provided !== cachedToken) return unauthorized();
    c.set('user', LOCAL_ADMIN);
    return next();
  }

  // ── Cloud mode: CF Access email or per-user token ─────────────────────────
  const store = getActiveStore();
  const d1 = store instanceof D1Store ? store : null;
  if (!d1) {
    return Response.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Store not available' } }, { status: 500 });
  }

  // (1) Cloudflare Access: check email header injected by CF
  const cfEmail = c.req.header('Cf-Access-Authenticated-User-Email');
  if (cfEmail) {
    const dbUser = await d1.getUserByEmail(cfEmail);
    if (!dbUser || !dbUser.is_active) {
      return unauthorized('此 email 尚未被授權存取，請聯繫管理員。');
    }
    c.set('user', dbUserToAuthUser(dbUser));
    return next();
  }

  // (2) Bearer token
  const rawToken =
    c.req.query('token') ?? c.req.header('Authorization')?.replace('Bearer ', '');
  if (!rawToken) return unauthorized();

  const hash = await hashToken(rawToken);
  const dbUser = await d1.getUserByTokenHash(hash);
  if (!dbUser || !dbUser.is_active) return unauthorized();

  // Update last_used_at fire-and-forget
  void d1.updateUser(dbUser.id, { last_used_at: new Date().toISOString() });

  c.set('user', dbUserToAuthUser(dbUser));
  return next();
};

export function requireRole(...roles: UserRole[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) return forbidden();
    return next();
  };
}

export function resetTokenCache(): void {
  cachedToken = null;
}
