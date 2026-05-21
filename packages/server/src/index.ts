import { serve } from '@hono/node-server';
import { loadData, getToken, initStore } from './store/fileStore.js';
import { NodeFileStore, DATA_DIR } from './store/nodeFileStore.js';
import { schedulePeriodicBackup } from './store/backup.js';
import { createApp } from './app.js';

const PORT = Number(process.env.TT_PORT ?? 5174);

async function main() {
  initStore(new NodeFileStore());
  await loadData();
  schedulePeriodicBackup();
  const token = await getToken();
  const app = createApp();

  serve({ fetch: app.fetch, hostname: '127.0.0.1', port: PORT }, () => {
    console.log(`\n🚀 task-time-tracker server running at http://127.0.0.1:${PORT}`);
    console.log(`   Data: ${DATA_DIR}/data.json`);
    console.log(`   Token: ${token.slice(0, 8)}...`);
    console.log(`   Health: http://127.0.0.1:${PORT}/system/health\n`);
  });
}

main().catch(console.error);
