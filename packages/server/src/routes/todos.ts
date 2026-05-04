import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getData, saveData } from '../store/fileStore.js';
import { emitEvent } from '../store/events.js';
import * as svc from '../services/taskService.js';
import type { TodoItem } from '@tt/shared/types';

const app = new Hono();
const ok = <T>(d: T) => ({ ok: true as const, data: d });

app.get('/', (c) => c.json(ok(getData().todos)));

app.post('/', zValidator('json', z.object({ description: z.string().min(1), id: z.string().uuid().optional() })), async (c) => {
  const { description, id } = c.req.valid('json');
  const { data, todo } = svc.addTodo(getData(), description, id);
  await saveData(() => data);
  emitEvent('todo.created', { id: todo.id });
  return c.json(ok(todo), 201);
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json<Partial<Pick<TodoItem, 'description' | 'startDate' | 'doneDate'>>>();
  const newData = svc.updateTodo(getData(), id, updates);
  await saveData(() => newData);
  emitEvent('todo.updated', { id });
  return c.json(ok(newData.todos.find(t => t.id === id)));
});

app.post('/:id/toggle', async (c) => {
  const id = c.req.param('id');
  const newData = svc.toggleTodo(getData(), id);
  await saveData(() => newData);
  emitEvent('todo.updated', { id });
  return c.json(ok(newData.todos.find(t => t.id === id)));
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const newData = svc.deleteTodo(getData(), id);
  await saveData(() => newData);
  emitEvent('todo.deleted', { id });
  return c.json(ok({ id }));
});

app.post('/clear-done', async (c) => {
  const newData = svc.clearDoneTodos(getData());
  await saveData(() => newData);
  emitEvent('todos.updated');
  return c.json(ok({ cleared: getData().todos.length - newData.todos.length }));
});

app.post('/import', async (c) => {
  const incoming = await c.req.json<TodoItem[]>();
  const { data, added, skipped } = svc.importTodos(getData(), incoming);
  await saveData(() => data);
  emitEvent('todos.updated');
  return c.json(ok({ added, skipped }));
});

export default app;
