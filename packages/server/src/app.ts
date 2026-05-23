import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { auditMiddleware } from './middleware/audit.js';
import tasksRouter from './routes/tasks.js';
import timeslotsRouter from './routes/timeslots.js';
import todosRouter from './routes/todos.js';
import settingsRouter from './routes/settings.js';
import dataRouter from './routes/data.js';
import reportsRouter from './routes/reports.js';
import systemRouter from './routes/system.js';
import authRouter from './routes/auth.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', corsMiddleware);
  app.route('/system', systemRouter);

  const api = new Hono();
  api.use('*', authMiddleware);
  api.use('*', auditMiddleware);
  api.route('/auth', authRouter);
  api.route('/tasks', tasksRouter);
  api.route('/timeslots', timeslotsRouter);
  api.route('/todos', todosRouter);
  api.route('/data', dataRouter);
  api.route('/reports', reportsRouter);
  api.route('', settingsRouter);

  app.route('/api/v1', api);
  app.get('/', (c) => c.json({ name: 'task-time-tracker', version: '1.0.0', apiBase: '/api/v1' }));

  return app;
}
