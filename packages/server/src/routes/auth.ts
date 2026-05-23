import { Hono } from 'hono';
import { requireRole } from '../middleware/auth.js';
import { getActiveStore } from '../store/fileStore.js';
import { D1Store, dbUserToAuthUser } from '../store/d1Store.js';
import type { UserRole } from '@tt/shared/types';

const app = new Hono();

function getD1(): D1Store | null {
  const store = getActiveStore();
  return store instanceof D1Store ? store : null;
}

function ok<T>(data: T) { return { ok: true, data }; }
function err(msg: string, status = 400) {
  return Response.json({ ok: false, error: { message: msg } }, { status });
}

// GET /api/v1/auth/me — 回傳自己的 user info
app.get('/me', (c) => {
  const user = c.get('user');
  return c.json(ok(user));
});

// GET /api/v1/auth/users — 列出所有使用者（admin only）
app.get('/users', requireRole('admin'), async (c) => {
  const d1 = getD1();
  if (!d1) return err('只有雲端模式支援使用者管理', 501);
  const users = await d1.listUsers();
  return c.json(ok(users.map(dbUserToAuthUser)));
});

// POST /api/v1/auth/users — 建立使用者，token 只回傳一次（admin only）
app.post('/users', requireRole('admin'), async (c) => {
  const d1 = getD1();
  if (!d1) return err('只有雲端模式支援使用者管理', 501);

  const body = await c.req.json<{ name?: string; email?: string; role?: string }>();
  if (!body.name?.trim()) return err('name 為必填');
  const role = (body.role ?? 'member') as UserRole;
  if (!['admin', 'member', 'readonly'].includes(role)) return err('role 必須為 admin / member / readonly');

  const { user, rawToken } = await d1.createUser({
    name: body.name.trim(),
    email: body.email?.trim() || undefined,
    role,
  });

  return c.json(ok({ user, token: rawToken }), 201);
});

// PATCH /api/v1/auth/users/:id — 修改 name / role / is_active（admin only）
app.patch('/users/:id', requireRole('admin'), async (c) => {
  const d1 = getD1();
  if (!d1) return err('只有雲端模式支援使用者管理', 501);

  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; email?: string; role?: string; isActive?: boolean }>();

  const target = await d1.getUserById(id);
  if (!target) return err('找不到此使用者', 404);

  const updates: Parameters<typeof d1.updateUser>[1] = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.email !== undefined) updates.email = body.email.trim() || null;
  if (body.role !== undefined) {
    if (!['admin', 'member', 'readonly'].includes(body.role)) return err('無效的 role');
    updates.role = body.role;
  }
  if (body.isActive !== undefined) updates.is_active = body.isActive ? 1 : 0;

  await d1.updateUser(id, updates);
  const updated = await d1.getUserById(id);
  return c.json(ok(updated ? dbUserToAuthUser(updated) : null));
});

// POST /api/v1/auth/users/:id/rotate — 重新產生 token（admin 或自己）
app.post('/users/:id/rotate', async (c) => {
  const d1 = getD1();
  if (!d1) return err('只有雲端模式支援使用者管理', 501);

  const id = c.req.param('id');
  const me = c.get('user');

  if (me.role !== 'admin' && me.id !== id) {
    return err('只有 admin 或本人才能更新 token', 403);
  }

  const target = await d1.getUserById(id);
  if (!target) return err('找不到此使用者', 404);

  const rawToken = await d1.rotateUserToken(id, target.role as UserRole);
  return c.json(ok({ token: rawToken }));
});

// GET /api/v1/auth/audit — 查看稽核日誌（admin only）
app.get('/audit', requireRole('admin'), async (c) => {
  const d1 = getD1();
  if (!d1) return err('只有雲端模式支援稽核日誌', 501);

  const { limit, user_id, resource } = c.req.query() as {
    limit?: string; user_id?: string; resource?: string;
  };

  const logs = await d1.getAuditLog({
    limit: limit ? parseInt(limit, 10) : 100,
    userId: user_id,
    resource,
  });

  return c.json(ok(logs));
});

export default app;
