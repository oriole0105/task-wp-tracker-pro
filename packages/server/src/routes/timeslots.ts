import { Hono } from 'hono';
import { getData, saveData } from '../store/fileStore.js';
import { emitEvent } from '../store/events.js';
import * as svc from '../services/taskService.js';
import type { Timeslot, AuthUser } from '@tt/shared/types';

const app = new Hono();
const ok = <T>(d: T) => ({ ok: true as const, data: d });
const notFound = () => ({ ok: false as const, error: { code: 'NOT_FOUND', message: 'Timeslot not found' } });
const forbidden = () => ({ ok: false as const, error: { code: 'FORBIDDEN', message: '無法操作他人的工時記錄' } });

function visibleToUser(timeslot: Timeslot, user: AuthUser | undefined): boolean {
  if (!user || user.id === 'local-admin') return true; // 本機模式全部可見
  if (user.role === 'admin') return true;              // admin 看所有人的
  if (!timeslot.ownerId) return true;                  // 舊資料無 ownerId → 可見
  return timeslot.ownerId === user.id;
}

// GET /timeslots
app.get('/', (c) => {
  const { taskId, from, to } = c.req.query() as { taskId?: string; from?: string; to?: string };
  const user = c.get('user');
  let ts = getData().timeslots.filter(t => visibleToUser(t, user));
  if (taskId) ts = ts.filter(t => t.taskId === taskId);
  if (from) ts = ts.filter(t => t.startTime >= Number(from));
  if (to) ts = ts.filter(t => t.startTime <= Number(to));
  return c.json(ok(ts));
});

// GET /timeslots/:id
app.get('/:id', (c) => {
  const user = c.get('user');
  const t = getData().timeslots.find(ts => ts.id === c.req.param('id'));
  if (!t) return c.json(notFound(), 404);
  if (!visibleToUser(t, user)) return c.json(forbidden(), 403);
  return c.json(ok(t));
});

// POST /timeslots
app.post('/', async (c) => {
  const user = c.get('user');
  const input = await c.req.json<Omit<Timeslot, 'id'> & { id?: string }>();
  // 雲端模式：自動掛上 ownerId
  const isCloud = process.env.TT_RUNTIME === 'cloudflare';
  if (isCloud && user && user.id !== 'local-admin') {
    (input as Timeslot).ownerId = user.id;
  }
  const { data, timeslot } = svc.addTimeslot(getData(), input);
  await saveData(() => data);
  emitEvent('timeslot.created', { id: timeslot.id });
  return c.json(ok(timeslot), 201);
});

// PATCH /timeslots/:id
app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const existing = getData().timeslots.find(ts => ts.id === id);
  if (!existing) return c.json(notFound(), 404);
  if (!visibleToUser(existing, user)) return c.json(forbidden(), 403);
  const updates = await c.req.json<Partial<Timeslot>>();
  const { data, timeslot } = svc.updateTimeslot(getData(), id, updates);
  if (!timeslot) return c.json(notFound(), 404);
  await saveData(() => data);
  emitEvent('timeslot.updated', { id });
  return c.json(ok(timeslot));
});

// DELETE /timeslots/:id
app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const existing = getData().timeslots.find(ts => ts.id === id);
  if (!existing) return c.json(notFound(), 404);
  if (!visibleToUser(existing, user)) return c.json(forbidden(), 403);
  const newData = svc.deleteTimeslot(getData(), id);
  await saveData(() => newData);
  emitEvent('timeslot.deleted', { id });
  return c.json(ok({ id }));
});

export default app;
