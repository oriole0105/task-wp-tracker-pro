import { Hono } from 'hono';
import { getData, saveData, emptyData } from '../store/fileStore.js';
import { emitEvent } from '../store/events.js';
import * as svc from '../services/taskService.js';
import type { Task, Timeslot, OutputType, Member } from '@tt/shared/types';

const app = new Hono();
const ok = <T>(d: T) => ({ ok: true as const, data: d });

// GET /data/export — full JSON snapshot
app.get('/export', (c) => {
  return c.json(ok(getData()));
});

// POST /data/import — full replace
app.post('/import', async (c) => {
  const body = await c.req.json<{
    tasks?: Task[];
    timeslots?: Timeslot[];
    mainCategories?: string[];
    subCategories?: string[];
    outputTypes?: OutputType[];
    holidays?: string[];
    members?: Member[];
  }>();
  const base = emptyData();
  const newData = await saveData(() => ({
    ...base,
    tasks: body.tasks ?? base.tasks,
    timeslots: body.timeslots ?? base.timeslots,
    mainCategories: body.mainCategories ?? base.mainCategories,
    subCategories: body.subCategories ?? base.subCategories,
    outputTypes: body.outputTypes ?? base.outputTypes,
    holidays: body.holidays ?? base.holidays,
    members: body.members ?? base.members,
    settings: base.settings,
  }));
  emitEvent('data.imported');
  return c.json(ok({ tasks: newData.tasks.length, timeslots: newData.timeslots.length }));
});

// POST /data/merge — smart merge by id + updatedAt
app.post('/merge', async (c) => {
  const body = await c.req.json<{ tasks?: Task[]; timeslots?: Timeslot[] }>();
  const result = svc.mergeImport(getData(), body);
  await saveData(() => result.data);
  emitEvent('data.merged');
  const { data: _, ...stats } = result;
  return c.json(ok(stats));
});

// POST /data/import-settings
app.post('/import-settings', async (c) => {
  const body = await c.req.json<{
    mainCategories?: string[];
    subCategories?: string[];
    outputTypes?: OutputType[];
    holidays?: string[];
    members?: Member[];
  }>();
  await saveData(d => ({
    ...d,
    mainCategories: body.mainCategories ?? d.mainCategories,
    subCategories: body.subCategories ?? d.subCategories,
    outputTypes: body.outputTypes ?? d.outputTypes,
    holidays: body.holidays ?? d.holidays,
    members: body.members ?? d.members,
  }));
  emitEvent('settings.updated');
  return c.json(ok({ ok: true }));
});

export default app;
