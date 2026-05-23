import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getData, saveData } from '../store/fileStore.js';
import { emitEvent } from '../store/events.js';
import * as svc from '../services/taskService.js';
import type { TodoItem, AuthUser } from '@tt/shared/types';

const app = new Hono();
const ok = <T>(d: T) => ({ ok: true as const, data: d });
const notFound = () => ({ ok: false as const, error: { code: 'NOT_FOUND', message: 'Todo not found' } });
const forbidden = () => ({ ok: false as const, error: { code: 'FORBIDDEN', message: '無法操作他人的待辦事項' } });

function ownedByUser(todo: TodoItem, user: AuthUser | undefined): boolean {
  if (!user || user.id === 'local-admin') return true;
  if (!todo.ownerId) return true;
  return todo.ownerId === user.id;
}

// GET /todos — 只回傳自己的（本機/舊資料無 ownerId → 全部可見）
app.get('/', (c) => {
  const user = c.get('user');
  const todos = getData().todos.filter(t => ownedByUser(t, user));
  return c.json(ok(todos));
});

// POST /todos — 雲端模式自動設 ownerId
app.post('/', zValidator('json', z.object({ description: z.string().min(1), id: z.string().uuid().optional() })), async (c) => {
  const user = c.get('user');
  const { description, id } = c.req.valid('json');
  const isCloud = process.env.TT_RUNTIME === 'cloudflare';
  const ownerId = isCloud && user && user.id !== 'local-admin' ? user.id : undefined;
  const { data, todo } = svc.addTodo(getData(), description, id, ownerId);
  await saveData(() => data);
  emitEvent('todo.created', { id: todo.id });
  return c.json(ok(todo), 201);
});

app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const existing = getData().todos.find(t => t.id === id);
  if (!existing) return c.json(notFound(), 404);
  if (!ownedByUser(existing, user)) return c.json(forbidden(), 403);
  const updates = await c.req.json<Partial<Pick<TodoItem, 'description' | 'startDate' | 'doneDate'>>>();
  const newData = svc.updateTodo(getData(), id, updates);
  await saveData(() => newData);
  emitEvent('todo.updated', { id });
  return c.json(ok(newData.todos.find(t => t.id === id)));
});

app.post('/:id/toggle', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const existing = getData().todos.find(t => t.id === id);
  if (!existing) return c.json(notFound(), 404);
  if (!ownedByUser(existing, user)) return c.json(forbidden(), 403);
  const newData = svc.toggleTodo(getData(), id);
  await saveData(() => newData);
  emitEvent('todo.updated', { id });
  return c.json(ok(newData.todos.find(t => t.id === id)));
});

app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const existing = getData().todos.find(t => t.id === id);
  if (!existing) return c.json(notFound(), 404);
  if (!ownedByUser(existing, user)) return c.json(forbidden(), 403);
  const newData = svc.deleteTodo(getData(), id);
  await saveData(() => newData);
  emitEvent('todo.deleted', { id });
  return c.json(ok({ id }));
});

// clear-done 只清除自己的已完成待辦
app.post('/clear-done', async (c) => {
  const user = c.get('user');
  const before = getData().todos.filter(t => ownedByUser(t, user) && t.done).length;
  // 只刪自己的已完成 todo；其他人的不動
  const newData = { ...getData(), todos: getData().todos.filter(t => !(ownedByUser(t, user) && t.done)) };
  await saveData(() => newData);
  emitEvent('todos.updated');
  return c.json(ok({ cleared: before }));
});

app.post('/import', async (c) => {
  const user = c.get('user');
  const isCloud = process.env.TT_RUNTIME === 'cloudflare';
  const ownerId = isCloud && user && user.id !== 'local-admin' ? user.id : undefined;
  const incoming = await c.req.json<TodoItem[]>();
  const tagged = ownerId ? incoming.map(t => ({ ...t, ownerId })) : incoming;
  const { data, added, skipped } = svc.importTodos(getData(), tagged);
  await saveData(() => data);
  emitEvent('todos.updated');
  return c.json(ok({ added, skipped }));
});

export default app;
