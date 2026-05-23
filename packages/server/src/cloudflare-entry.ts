import { initStore, loadData } from './store/fileStore.js';
import { D1Store, type D1Database } from './store/d1Store.js';
import { resetTokenCache } from './middleware/auth.js';
import { createApp } from './app.js';
import { handleMcpRequest } from './mcp.js';

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
let _adminEnsured = false;
const app = createApp();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 每次 Worker instance 初始化時建立 store（不同 env 可能有不同 DB binding）
    if (!_store || (_store as D1Store).getDbRef() !== env.DB) {
      _store = new D1Store(env.DB, env.TT_TOKEN);
      initStore(_store);
      resetTokenCache();
      _adminEnsured = false;
    }
    // 每次 request 都 reload（確保多 Worker instance 間資料一致）
    await loadData();

    // 確保 admin user 存在（首次部署時從 TT_TOKEN 建立）
    if (!_adminEnsured) {
      await _store.ensureAdminUser(env.TT_TOKEN);
      _adminEnsured = true;
    }

    // MCP over HTTP — handle before passing to Hono to avoid circular routing
    const url = new URL(request.url);
    if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id',
          },
        });
      }
      // Token auth
      const token =
        request.headers.get('Authorization')?.replace('Bearer ', '') ??
        url.searchParams.get('token');
      if (token !== env.TT_TOKEN) {
        return Response.json(
          { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } },
          { status: 401 },
        );
      }
      const mcpResponse = await handleMcpRequest(app, { TT_TOKEN: env.TT_TOKEN }, request);
      // Attach CORS headers so CLI tools on other machines can reach the endpoint
      const headers = new Headers(mcpResponse.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(mcpResponse.body, { status: mcpResponse.status, headers });
    }

    return app.fetch(request, env);
  },
};
