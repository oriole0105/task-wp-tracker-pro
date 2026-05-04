import { Hono } from 'hono';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { dataFileExists, importBootstrap, getToken } from '../store/fileStore.js';
import { subscribeToEvents } from '../store/events.js';
import type { AppData } from '../store/fileStore.js';

const app = new Hono();

/** Allow only loopback connections — defence-in-depth for sensitive unauthenticated endpoints. */
function isLocalRequest(c: Context): boolean {
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } };
  const addr = env.incoming?.socket?.remoteAddress ?? '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

// GET /system/health
app.get('/health', (c) => {
  return c.json({ ok: true, data: { status: 'ok', schemaVersion: 3, bootstrapRequired: !dataFileExists() } });
});

// GET /system/handshake — web UI fetches the token on startup; restricted to loopback
app.get('/handshake', async (c) => {
  if (!isLocalRequest(c)) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'This endpoint is only accessible from localhost.' } }, 403);
  }
  const token = await getToken();
  return c.json({ ok: true, data: { token } });
});

// POST /system/import-localstorage — first-boot migration; restricted to loopback
app.post('/import-localstorage', async (c) => {
  if (!isLocalRequest(c)) {
    return c.json({ ok: false, error: { code: 'FORBIDDEN', message: 'This endpoint is only accessible from localhost.' } }, 403);
  }
  if (dataFileExists()) {
    return c.json({ ok: false, error: { code: 'ALREADY_BOOTSTRAPPED', message: 'Data file already exists. Use /data/merge to import additional data.' } }, 409);
  }
  const body = await c.req.json<{ state?: Partial<AppData> } | Partial<AppData>>();
  const state = ('state' in body && body.state) ? body.state : (body as Partial<AppData>);
  await importBootstrap(state);
  return c.json({ ok: true, data: { tasks: state.tasks?.length ?? 0, timeslots: state.timeslots?.length ?? 0 } });
});

// GET /events — SSE stream
app.get('/events', (c) => {
  return streamSSE(c, async (stream) => {
    const unsub = subscribeToEvents(async (event) => {
      try {
        await stream.writeSSE({ data: JSON.stringify(event), event: event.type });
      } catch {
        // client disconnected
      }
    });
    // Send initial ping
    await stream.writeSSE({ data: JSON.stringify({ type: 'connected' }), event: 'connected' });
    // Keep alive until client disconnects
    await new Promise<void>((resolve) => {
      stream.onAbort(() => { unsub(); resolve(); });
    });
  });
});

export default app;
