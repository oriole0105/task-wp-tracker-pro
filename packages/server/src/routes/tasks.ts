import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getData, saveData } from '../store/fileStore.js';
import { emitEvent } from '../store/events.js';
import * as svc from '../services/taskService.js';
import type { Task, WeeklySnapshot, WorkOutput, JsonImportTask } from '@tt/shared/types';
import { computeTaskWbsMap } from '@tt/shared/utils/wbs';

const app = new Hono();

const ok = <T>(data: T) => ({ ok: true as const, data });
const notFound = (msg = 'Not found') => ({ ok: false as const, error: { code: 'NOT_FOUND', message: msg } });

// GET /tasks
app.get('/', (c) => {
  const { archived, parentId } = c.req.query() as { archived?: string; parentId?: string };
  let tasks = getData().tasks;
  if (archived !== undefined) tasks = tasks.filter(t => !!t.archived === (archived === 'true'));
  if (parentId !== undefined) tasks = tasks.filter(t => (t.parentId ?? '') === parentId);
  return c.json(ok(tasks));
});

// GET /tasks/wbs-map — 回傳未封存任務清單，每筆附帶 wbsNumber 欄位，依 WBS 順序排列
app.get('/wbs-map', (c) => {
  const tasks = getData().tasks.filter(t => !t.archived);
  const { wbsNumbers, sorted } = computeTaskWbsMap(tasks);
  const result = sorted.map(t => ({ ...t, wbsNumber: wbsNumbers.get(t.id) ?? '' }));
  return c.json(ok(result));
});

// GET /tasks/:id
app.get('/:id', (c) => {
  const task = getData().tasks.find(t => t.id === c.req.param('id'));
  if (!task) return c.json(notFound(), 404);
  return c.json(ok(task));
});

// GET /tasks/:id/subtasks
app.get('/:id/subtasks', (c) => {
  const id = c.req.param('id');
  return c.json(ok(getData().tasks.filter(t => t.parentId === id)));
});

// GET /tasks/:id/total-time
app.get('/:id/total-time', (c) => {
  return c.json(ok({ ms: svc.getTaskTotalTime(getData(), c.req.param('id')) }));
});

// POST /tasks
app.post('/', async (c) => {
  const input = await c.req.json<Omit<Task, 'id'> & { id?: string }>();
  const { data, task } = svc.addTask(getData(), input);
  await saveData(() => data);
  emitEvent('task.created', { id: task.id });
  return c.json(ok(task), 201);
});

// PATCH /tasks/:id
app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json<Partial<Task>>();
  const { data, task } = svc.updateTask(getData(), id, updates);
  if (!task) return c.json(notFound(), 404);
  await saveData(() => data);
  emitEvent('task.updated', { id });
  return c.json(ok(task));
});

// DELETE /tasks/:id
app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (!getData().tasks.find(t => t.id === id)) return c.json(notFound(), 404);
  const { data, deletedIds } = svc.deleteTask(getData(), id);
  await saveData(() => data);
  emitEvent('task.deleted', { ids: deletedIds });
  return c.json(ok({ deletedIds }));
});

// POST /tasks/:id/duplicate
app.post('/:id/duplicate', async (c) => {
  const { data, task } = svc.duplicateTask(getData(), c.req.param('id'));
  if (!task) return c.json(notFound(), 404);
  await saveData(() => data);
  emitEvent('task.created', { id: task.id });
  return c.json(ok(task), 201);
});

// POST /tasks/:id/duplicate-subtree
app.post('/:id/duplicate-subtree', zValidator('json', z.object({
  prefix: z.string().default(''),
  postfix: z.string().default(''),
  search: z.string().optional(),
  replace: z.string().optional(),
})), async (c) => {
  const { prefix, postfix, search, replace } = c.req.valid('json');
  const { data, tasks } = svc.duplicateSubtree(getData(), c.req.param('id'), prefix, postfix, search, replace);
  if (tasks.length === 0) return c.json(notFound(), 404);
  await saveData(() => data);
  emitEvent('tasks.updated');
  return c.json(ok(tasks), 201);
});

// POST /tasks/:id/reorder
app.post('/:id/reorder', zValidator('json', z.object({
  direction: z.enum(['up', 'down', 'promote', 'demote']),
})), async (c) => {
  const { direction } = c.req.valid('json');
  const newData = svc.reorderTask(getData(), c.req.param('id'), direction);
  await saveData(() => newData);
  emitEvent('tasks.updated');
  return c.json(ok(newData.tasks));
});

// POST /tasks/:id/archive
app.post('/:id/archive', async (c) => {
  const id = c.req.param('id');
  if (!getData().tasks.find(t => t.id === id)) return c.json(notFound(), 404);
  const newData = svc.archiveTask(getData(), id);
  await saveData(() => newData);
  emitEvent('task.updated', { id });
  return c.json(ok(newData.tasks.find(t => t.id === id)));
});

// POST /tasks/:id/unarchive
app.post('/:id/unarchive', async (c) => {
  const id = c.req.param('id');
  if (!getData().tasks.find(t => t.id === id)) return c.json(notFound(), 404);
  const newData = svc.unarchiveTask(getData(), id);
  await saveData(() => newData);
  emitEvent('task.updated', { id });
  return c.json(ok(newData.tasks.find(t => t.id === id)));
});

// POST /tasks/archive-all-done
app.post('/archive-all-done', async (c) => {
  const { data, archived } = svc.archiveAllDone(getData());
  await saveData(() => data);
  emitEvent('tasks.updated');
  return c.json(ok({ archived }));
});

// PATCH /tasks/:id/snapshots
app.patch('/:id/snapshots', async (c) => {
  const id = c.req.param('id');
  const snapshots = await c.req.json<WeeklySnapshot[]>();
  const newData = svc.updateTaskSnapshots(getData(), id, snapshots);
  await saveData(() => newData);
  emitEvent('task.updated', { id });
  return c.json(ok(newData.tasks.find(t => t.id === id)));
});

// PATCH /tasks/:id/weekly-note
app.patch('/:id/weekly-note', zValidator('json', z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string(),
})), async (c) => {
  const id = c.req.param('id');
  const { weekStart, note } = c.req.valid('json');
  const newData = svc.updateTaskWeeklyNote(getData(), id, weekStart, note);
  await saveData(() => newData);
  emitEvent('task.updated', { id });
  return c.json(ok(newData.tasks.find(t => t.id === id)));
});

// PATCH /tasks/:taskId/outputs/:outputId
app.patch('/:taskId/outputs/:outputId', async (c) => {
  const { taskId, outputId } = c.req.param();
  const updates = await c.req.json<Partial<WorkOutput>>();
  const newData = svc.updateWorkOutput(getData(), taskId, outputId, updates);
  await saveData(() => newData);
  emitEvent('task.updated', { id: taskId });
  return c.json(ok(newData.tasks.find(t => t.id === taskId)));
});

// POST /tasks/import
app.post('/import', zValidator('json', z.object({
  tasks: z.array(z.unknown()),
  parentId: z.string().optional(),
})), async (c) => {
  const { tasks: jsonTasks, parentId } = c.req.valid('json');
  const { data, tasks } = svc.importTasksFromJson(getData(), jsonTasks as JsonImportTask[], parentId);
  await saveData(() => data);
  emitEvent('tasks.updated');
  return c.json(ok(tasks), 201);
});

export default app;
