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
        const result = await api.get('/data/export') as {
          data?: {
            tasks?: unknown[];
            timeslots?: unknown[];
            todos?: unknown[];
            mainCategories?: unknown[];
            members?: unknown[];
          }
        };
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
    'settings_get',
    '取得目前的設定（darkMode、preventDuplicateTaskNames 等）及所有分類、產出類型清單。',
    {},
    async () => {
      try {
        const [settings, mainCats, subCats, outputTypes, members] = await Promise.all([
          api.get('/settings'),
          api.get('/categories/main'),
          api.get('/categories/sub'),
          api.get('/output-types'),
          api.get('/members'),
        ]);
        return json({ settings, mainCats, subCats, outputTypes, members });
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'settings_update',
    '更新設定。',
    {
      darkMode: z.boolean().optional().describe('深色模式'),
      preventDuplicateTaskNames: z.boolean().optional().describe('防止重複任務名稱'),
      quickAddAction: z.string().optional().describe('快速新增動作（timeslot 或 task）'),
    },
    async (updates) => {
      try {
        const result = await api.patch('/settings', updates);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'category_add',
    '新增主分類。',
    { name: z.string().min(1).describe('分類名稱') },
    async ({ name }) => {
      try {
        const result = await api.post('/categories/main', { name });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'output_type_list',
    '列出所有工作產出類型。',
    {},
    async () => {
      try {
        const result = await api.get('/output-types');
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'members_list',
    '列出所有成員。',
    {},
    async () => {
      try {
        const result = await api.get('/members');
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'holidays_list',
    '列出設定的假日日期清單。',
    {},
    async () => {
      try {
        const result = await api.get('/holidays');
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'holidays_add',
    '新增假日日期。',
    { date: z.string().describe('假日日期 YYYY-MM-DD') },
    async ({ date }) => {
      try {
        const result = await api.post('/holidays', { date });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );
}
