import type { MiddlewareHandler } from 'hono';
import { getToken } from '../store/fileStore.js';

let cachedToken: string | null = null;

// CF Workers 可能每次 request 都重新初始化 store，所以不能永遠 cache
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const queryToken = c.req.query('token');
  const authHeader = c.req.header('Authorization');

  if (!cachedToken) cachedToken = await getToken();
  const provided = queryToken ?? authHeader?.replace('Bearer ', '');
  if (provided !== cachedToken) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } }, 401);
  }
  return next();
};

export function resetTokenCache(): void {
  cachedToken = null;
}
