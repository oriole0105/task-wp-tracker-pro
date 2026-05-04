import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient, json, text, handleError } from '../client.js';

export function registerTodoTools(server: McpServer, api: ApiClient): void {

  server.tool(
    'todo_list',
    '列出所有待辦事項。',
    {},
    async () => {
      try {
        const result = await api.get('/todos');
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'todo_create',
    '建立新待辦事項。',
    {
      description: z.string().min(1).describe('待辦事項內容'),
    },
    async ({ description }) => {
      try {
        const result = await api.post('/todos', { description });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'todo_toggle',
    '切換待辦事項完成/未完成狀態。',
    { id: z.string().describe('待辦事項 ID') },
    async ({ id }) => {
      try {
        const result = await api.post(`/todos/${id}/toggle`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'todo_update',
    '更新待辦事項的文字內容或日期，若只要切換完成狀態請用 todo_toggle。',
    {
      id: z.string().describe('待辦事項 ID'),
      description: z.string().optional().describe('新內容'),
      startDate: z.string().optional().describe('開始日期 YYYY-MM-DD'),
      doneDate: z.string().optional().describe('完成日期 YYYY-MM-DD'),
    },
    async ({ id, ...updates }) => {
      try {
        const result = await api.patch(`/todos/${id}`, updates);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'todo_delete',
    '刪除待辦事項。',
    { id: z.string().describe('待辦事項 ID') },
    async ({ id }) => {
      try {
        const result = await api.delete(`/todos/${id}`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'todo_clear_done',
    '清除所有已完成的待辦事項。',
    {},
    async () => {
      try {
        const result = await api.post('/todos/clear-done');
        return text(`已清除完成的待辦事項。${JSON.stringify(result)}`);
      } catch (e) { return handleError(e); }
    },
  );
}
