import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { loadData, getToken, DATA_DIR } from './store/fileStore.js';
import { schedulePeriodicBackup } from './store/backup.js';
import tasksRouter from './routes/tasks.js';
import timeslotsRouter from './routes/timeslots.js';
import todosRouter from './routes/todos.js';
import settingsRouter from './routes/settings.js';
import dataRouter from './routes/data.js';
import reportsRouter from './routes/reports.js';
import systemRouter from './routes/system.js';

const PORT = Number(process.env.TT_PORT ?? 5174);

async function main() {
  await loadData();
  schedulePeriodicBackup();
  const token = await getToken();

  const app = new Hono();

  // Global middleware
  app.use('*', corsMiddleware);

  // Unauthenticated system routes (health, handshake, SSE)
  // Note: auth for /events and /system/handshake is handled at route level via query token
  app.route('/system', systemRouter);

  // Auth guard for all /api/v1/* routes
  const api = new Hono();
  api.use('*', authMiddleware);
  api.route('/tasks', tasksRouter);
  api.route('/timeslots', timeslotsRouter);
  api.route('/todos', todosRouter);
  api.route('/data', dataRouter);
  api.route('/reports', reportsRouter);
  api.route('', settingsRouter); // settings routes mount at root: /api/v1/settings, /categories/..., etc.

  app.route('/api/v1', api);

  // Root info
  app.get('/', (c) => c.json({ name: 'task-time-tracker', version: '1.0.0', apiBase: '/api/v1' }));

  serve({ fetch: app.fetch, hostname: '127.0.0.1', port: PORT }, () => {
    console.log(`\n🚀 task-time-tracker server running at http://127.0.0.1:${PORT}`);
    console.log(`   Data: ${DATA_DIR}/data.json`);
    console.log(`   Token: ${token.slice(0, 8)}...`);
    console.log(`   Health: http://127.0.0.1:${PORT}/system/health\n`);
  });
}

main().catch(console.error);
