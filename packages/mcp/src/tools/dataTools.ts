import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient, json, text, handleError } from '../client.js';

export function registerDataTools(server: McpServer, api: ApiClient): void {

  server.tool(
    'data_export',
    '匯出完整的任務資料（tasks、timeslots、todos、categories、settings 等）為 JSON。',
    {},
    async () => {
      try {
        const result = await api.get('/data/export');
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'data_summary',
    '取得資料統計摘要（任務數、時間紀錄數、待辦數等）。',
    {},
    async () => {
      try {
        const result = await api.get<{
          data?: {
            tasks?: unknown[];
            timeslots?: unknown[];
            todos?: unknown[];
            mainCategories?: unknown[];
            members?: unknown[];
          }
        }>('/data/export');
        const d = result?.data ?? {};
        const summary = {
          tasks: (d.tasks ?? []).length,
          timeslots: (d.timeslots ?? []).length,
          todos: (d.todos ?? []).length,
          mainCategories: d.mainCategories ?? [],
          members: (d.members ?? []).length,
        };
        return text(
          `任務：${summary.tasks} 筆\n` +
          `時間紀錄：${summary.timeslots} 筆\n` +
          `待辦：${summary.todos} 筆\n` +
          `主分類：${(summary.mainCategories as string[]).join(', ')}\n` +
          `成員：${summary.members} 位`
        );
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'data_import',
    '完整資料匯入（取代現有所有資料）。適用於從備份還原。傳入的 JSON 格式與 data_export 相同。',
    {
      tasks: z.array(z.record(z.unknown())).optional().describe('任務陣列'),
      timeslots: z.array(z.record(z.unknown())).optional().describe('時間紀錄陣列'),
      mainCategories: z.array(z.string()).optional().describe('主分類清單'),
      subCategories: z.array(z.string()).optional().describe('子分類清單'),
    },
    async (body) => {
      try {
        const result = await api.post('/data/import', body);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'data_merge',
    '智慧合併匯入（依 ID 比對 updatedAt，取較新版本，不影響未包含的資料）。適用於跨裝置同步。',
    {
      tasks: z.array(z.record(z.unknown())).optional().describe('要合併的任務陣列'),
      timeslots: z.array(z.record(z.unknown())).optional().describe('要合併的時間紀錄陣列'),
    },
    async (body) => {
      try {
        const result = await api.post('/data/merge', body);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );
}
