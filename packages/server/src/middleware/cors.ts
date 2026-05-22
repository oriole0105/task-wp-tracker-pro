import { cors } from 'hono/cors';

const STATIC_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

function isAllowed(origin: string): boolean {
  if (STATIC_ORIGINS.includes(origin)) return true;
  // Cloudflare Pages / Workers deployments
  if (origin.endsWith('.pages.dev') || origin.endsWith('.workers.dev')) return true;
  // Custom domain via TT_CORS_ORIGIN (comma-separated)
  const extra = process.env.TT_CORS_ORIGIN;
  if (extra) return extra.split(',').map(s => s.trim()).includes(origin);
  return false;
}

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return STATIC_ORIGINS[0];
    return isAllowed(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type', 'X-Client-Id'],
  exposeHeaders: ['Content-Type'],
  credentials: true,
});
