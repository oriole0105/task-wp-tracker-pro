import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getData, saveData } from '../store/fileStore.js';
import { emitEvent } from '../store/events.js';
import * as svc from '../services/taskService.js';
import type { OutputType, Member } from '@tt/shared/types';

const app = new Hono();
const ok = <T>(d: T) => ({ ok: true as const, data: d });

// ── Global settings ───────────────────────────────────────────────
app.get('/settings', (c) => c.json(ok(getData().settings)));
app.patch('/settings', async (c) => {
  const updates = await c.req.json<Partial<{ darkMode: boolean; preventDuplicateTaskNames: boolean; quickAddAction: string }>>();
  const newData = await saveData(d => ({ ...d, settings: { ...d.settings, ...updates } }));
  emitEvent('settings.updated');
  return c.json(ok(newData.settings));
});

// ── Main categories ───────────────────────────────────────────────
app.get('/categories/main', (c) => c.json(ok(getData().mainCategories)));
app.post('/categories/main', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const { name } = c.req.valid('json');
  const newData = await saveData(d => svc.addMainCategory(d, name));
  emitEvent('settings.updated');
  return c.json(ok(newData.mainCategories), 201);
});
app.patch('/categories/main/:name', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const oldName = c.req.param('name');
  const { name: newName } = c.req.valid('json');
  const newData = await saveData(d => svc.updateMainCategory(d, oldName, newName));
  emitEvent('settings.updated');
  return c.json(ok(newData.mainCategories));
});
app.delete('/categories/main/:name', async (c) => {
  const name = c.req.param('name');
  const newData = await saveData(d => svc.deleteMainCategory(d, name));
  emitEvent('settings.updated');
  return c.json(ok(newData.mainCategories));
});

// ── Sub categories ────────────────────────────────────────────────
app.get('/categories/sub', (c) => c.json(ok(getData().subCategories)));
app.post('/categories/sub', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const { name } = c.req.valid('json');
  const newData = await saveData(d => svc.addSubCategory(d, name));
  emitEvent('settings.updated');
  return c.json(ok(newData.subCategories), 201);
});
app.patch('/categories/sub/:name', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const newData = await saveData(d => svc.updateSubCategory(d, c.req.param('name'), c.req.valid('json').name));
  emitEvent('settings.updated');
  return c.json(ok(newData.subCategories));
});
app.delete('/categories/sub/:name', async (c) => {
  const newData = await saveData(d => svc.deleteSubCategory(d, c.req.param('name')));
  emitEvent('settings.updated');
  return c.json(ok(newData.subCategories));
});

// ── Output types ──────────────────────────────────────────────────
app.get('/output-types', (c) => c.json(ok(getData().outputTypes)));
app.post('/output-types', async (c) => {
  const input = await c.req.json<Omit<OutputType, 'id'>>();
  const { data, outputType } = svc.addOutputType(getData(), input);
  await saveData(() => data);
  emitEvent('settings.updated');
  return c.json(ok(outputType), 201);
});
app.patch('/output-types/:id', async (c) => {
  const updates = await c.req.json<Partial<Omit<OutputType, 'id'>>>();
  const newData = await saveData(d => svc.updateOutputType(d, c.req.param('id'), updates));
  emitEvent('settings.updated');
  return c.json(ok(newData.outputTypes.find(ot => ot.id === c.req.param('id'))));
});
app.delete('/output-types/:id', async (c) => {
  const id = c.req.param('id');
  const newData = await saveData(d => svc.deleteOutputType(d, id));
  emitEvent('settings.updated');
  return c.json(ok({ id, remaining: newData.outputTypes.length }));
});

// ── Holidays ──────────────────────────────────────────────────────
app.get('/holidays', (c) => c.json(ok(getData().holidays)));
app.post('/holidays', zValidator('json', z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })), async (c) => {
  const { date } = c.req.valid('json');
  const newData = await saveData(d => svc.addHoliday(d, date));
  emitEvent('settings.updated');
  return c.json(ok(newData.holidays), 201);
});
app.delete('/holidays/:date', async (c) => {
  const newData = await saveData(d => svc.deleteHoliday(d, c.req.param('date')));
  emitEvent('settings.updated');
  return c.json(ok(newData.holidays));
});

// ── Members ───────────────────────────────────────────────────────
app.get('/members', (c) => c.json(ok(getData().members)));
app.post('/members', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const { name } = c.req.valid('json');
  const { data, member } = svc.addMember(getData(), name);
  await saveData(() => data);
  emitEvent('settings.updated');
  return c.json(ok(member), 201);
});
app.patch('/members/:id', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
  const id = c.req.param('id');
  const { name } = c.req.valid('json');
  const newData = await saveData(d => svc.updateMember(d, id, name));
  emitEvent('settings.updated');
  return c.json(ok(newData.members.find((m: Member) => m.id === id)));
});
app.delete('/members/:id', async (c) => {
  const id = c.req.param('id');
  const newData = await saveData(d => svc.deleteMember(d, id));
  emitEvent('settings.updated');
  return c.json(ok({ id, remaining: newData.members.length }));
});

export default app;
