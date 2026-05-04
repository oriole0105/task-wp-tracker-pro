import { Hono } from 'hono';
import { getData, saveData } from '../store/fileStore.js';
import { emitEvent } from '../store/events.js';
import * as svc from '../services/taskService.js';
import type { Timeslot } from '@tt/shared/types';

const app = new Hono();
const ok = <T>(d: T) => ({ ok: true as const, data: d });
const notFound = () => ({ ok: false as const, error: { code: 'NOT_FOUND', message: 'Timeslot not found' } });

// GET /timeslots
app.get('/', (c) => {
  const { taskId, from, to } = c.req.query() as { taskId?: string; from?: string; to?: string };
  let ts = getData().timeslots;
  if (taskId) ts = ts.filter(t => t.taskId === taskId);
  if (from) ts = ts.filter(t => t.startTime >= Number(from));
  if (to) ts = ts.filter(t => t.startTime <= Number(to));
  return c.json(ok(ts));
});

// GET /timeslots/:id
app.get('/:id', (c) => {
  const t = getData().timeslots.find(ts => ts.id === c.req.param('id'));
  if (!t) return c.json(notFound(), 404);
  return c.json(ok(t));
});

// POST /timeslots
app.post('/', async (c) => {
  const input = await c.req.json<Omit<Timeslot, 'id'> & { id?: string }>();
  const { data, timeslot } = svc.addTimeslot(getData(), input);
  await saveData(() => data);
  emitEvent('timeslot.created', { id: timeslot.id });
  return c.json(ok(timeslot), 201);
});

// PATCH /timeslots/:id
app.patch('/:id', async (c) => {
  const id = c.req.param('id');
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
  if (!getData().timeslots.find(ts => ts.id === id)) return c.json(notFound(), 404);
  const newData = svc.deleteTimeslot(getData(), id);
  await saveData(() => newData);
  emitEvent('timeslot.deleted', { id });
  return c.json(ok({ id }));
});

export default app;
