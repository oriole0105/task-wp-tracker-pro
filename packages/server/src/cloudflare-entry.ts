import { initStore, loadData } from './store/fileStore.js';
import { D1Store, type D1Database } from './store/d1Store.js';
import { resetTokenCache } from './middleware/auth.js';
import { createApp } from './app.js';

export interface Env {
  DB: D1Database;
  TT_TOKEN: string;
}

// 在 process.env 中標記 cloudflare runtime（讓 system.ts 的條件判斷生效）
// 注意：CF Workers 沒有真正的 process.env，這裡用全域變數替代
(globalThis as Record<string, unknown>)['process'] ??= { env: {} };
((globalThis as Record<string, unknown>)['process'] as Record<string, unknown>)['env'] = {
  TT_RUNTIME: 'cloudflare',
};

let _store: D1Store | null = null;
const app = createApp();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 每次 Worker instance 初始化時建立 store（不同 env 可能有不同 DB binding）
    if (!_store || (_store as D1Store).getDbRef() !== env.DB) {
      _store = new D1Store(env.DB, env.TT_TOKEN);
      initStore(_store);
      resetTokenCache();
    }
    // 每次 request 都 reload（確保多 Worker instance 間資料一致）
    await loadData();
    return app.fetch(request, env);
  },
};
