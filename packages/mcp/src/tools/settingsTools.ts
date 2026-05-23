import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient, json, handleError } from '../client.js';

export function registerSettingsTools(server: McpServer, api: ApiClient): void {

  // ── 整體設定 ─────────────────────────────────────────────────────

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

  // ── 主分類 ──────────────────────────────────────────────────────

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
    'category_update_main',
    '修改主分類名稱。',
    {
      oldName: z.string().min(1).describe('目前的分類名稱'),
      newName: z.string().min(1).describe('新的分類名稱'),
    },
    async ({ oldName, newName }) => {
      try {
        const result = await api.patch(`/categories/main/${encodeURIComponent(oldName)}`, { name: newName });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'category_delete_main',
    '刪除主分類。注意：已使用此分類的任務不會自動清除分類欄位。',
    { name: z.string().min(1).describe('要刪除的分類名稱') },
    async ({ name }) => {
      try {
        const result = await api.delete(`/categories/main/${encodeURIComponent(name)}`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  // ── 子分類（時間分類） ───────────────────────────────────────────

  server.tool(
    'category_add_sub',
    '新增子分類（時間分類）。',
    { name: z.string().min(1).describe('分類名稱') },
    async ({ name }) => {
      try {
        const result = await api.post('/categories/sub', { name });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'category_update_sub',
    '修改子分類（時間分類）名稱。',
    {
      oldName: z.string().min(1).describe('目前的分類名稱'),
      newName: z.string().min(1).describe('新的分類名稱'),
    },
    async ({ oldName, newName }) => {
      try {
        const result = await api.patch(`/categories/sub/${encodeURIComponent(oldName)}`, { name: newName });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'category_delete_sub',
    '刪除子分類（時間分類）。',
    { name: z.string().min(1).describe('要刪除的分類名稱') },
    async ({ name }) => {
      try {
        const result = await api.delete(`/categories/sub/${encodeURIComponent(name)}`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  // ── 工作產出類型 ─────────────────────────────────────────────────

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

  server.tool(
    'output_type_add',
    '新增工作產出類型。',
    {
      name: z.string().min(1).describe('類型名稱'),
      isTangible: z.boolean().describe('是否為有形產出（true=有形，false=無形）'),
    },
    async ({ name, isTangible }) => {
      try {
        const result = await api.post('/output-types', { name, isTangible });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'output_type_update',
    '更新工作產出類型。',
    {
      id: z.string().describe('產出類型 ID'),
      name: z.string().optional().describe('新名稱'),
      isTangible: z.boolean().optional().describe('是否為有形產出'),
    },
    async ({ id, ...updates }) => {
      try {
        const result = await api.patch(`/output-types/${id}`, updates);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'output_type_delete',
    '刪除工作產出類型。',
    { id: z.string().describe('要刪除的產出類型 ID') },
    async ({ id }) => {
      try {
        const result = await api.delete(`/output-types/${id}`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  // ── 成員 ────────────────────────────────────────────────────────

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
    'member_add',
    '新增成員。',
    { name: z.string().min(1).describe('成員姓名') },
    async ({ name }) => {
      try {
        const result = await api.post('/members', { name });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'member_update',
    '更新成員姓名。',
    {
      id: z.string().describe('成員 ID（可從 members_list 取得）'),
      name: z.string().min(1).describe('新姓名'),
    },
    async ({ id, name }) => {
      try {
        const result = await api.patch(`/members/${id}`, { name });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'member_delete',
    '刪除成員。注意：isSelf 標記的成員（自己）無法刪除。',
    { id: z.string().describe('要刪除的成員 ID') },
    async ({ id }) => {
      try {
        const result = await api.delete(`/members/${id}`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  // ── 假日 ────────────────────────────────────────────────────────

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

  server.tool(
    'holiday_delete',
    '刪除假日日期。',
    { date: z.string().describe('要刪除的假日日期 YYYY-MM-DD') },
    async ({ date }) => {
      try {
        const result = await api.delete(`/holidays/${date}`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );
}
