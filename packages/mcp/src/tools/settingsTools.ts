import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient, json, handleError } from '../client.js';

export function registerSettingsTools(server: McpServer, api: ApiClient): void {

  server.tool(
    'output_type_list',
    '列出所有已設定的工作產出類型（含 id、name、isTangible）。新增產出時若需指定 outputTypeId，先呼叫此工具取得對應 id。',
    {},
    async () => {
      try {
        const result = await api.get('/output-types');
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );
}
