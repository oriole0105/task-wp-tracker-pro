import type { MiddlewareHandler } from 'hono';
import { getToken } from '../store/fileStore.js';

let cachedToken: string | null = null;

async function resolveToken(): Promise<string> {
  if (!cachedToken) cachedToken = await getToken();
  return cachedToken;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // SSE endpoint allows token via query string
  const queryToken = c.req.query('token');
  const authHeader = c.req.header('Authorization');
  const token = await resolveToken();

  const provided = queryToken ?? authHeader?.replace('Bearer ', '');
  if (provided !== token) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } }, 401);
  }
  return next();
};
