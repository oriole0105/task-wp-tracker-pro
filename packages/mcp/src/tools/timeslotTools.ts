import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient, json, text, handleError } from '../client.js';

export function registerTimeslotTools(server: McpServer, api: ApiClient): void {

  server.tool(
    'timeslot_list',
    '列出時間紀錄。可依任務 ID、時間範圍過濾，from/to 為 epoch 毫秒或 YYYY-MM-DD 字串。',
    {
      taskId: z.string().optional().describe('只看此任務的時間紀錄'),
      from: z.string().optional().describe('起始時間（epoch ms 或 YYYY-MM-DD）'),
      to: z.string().optional().describe('結束時間（epoch ms 或 YYYY-MM-DD）'),
    },
    async ({ taskId, from, to }) => {
      try {
        const params: Record<string, string | undefined> = { taskId };
        if (from) params.from = String(from.includes('-') ? new Date(from).getTime() : from);
        if (to) params.to = String(to.includes('-') ? new Date(to).getTime() : to);
        const result = await api.get('/timeslots', params);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'timeslot_create',
    '手動新增時間紀錄。startTime/endTime 可填 epoch ms 或 YYYY-MM-DDTHH:MM:SS 格式。',
    {
      taskId: z.string().optional().describe('關聯任務 ID（可不填）'),
      startTime: z.string().describe('開始時間（epoch ms 或 ISO 格式）'),
      endTime: z.string().optional().describe('結束時間（不填代表進行中）'),
      subCategory: z.string().optional().default('').describe('子分類'),
      note: z.string().optional().describe('備注'),
    },
    async ({ taskId, startTime, endTime, subCategory, note }) => {
      try {
        const toMs = (s: string) => /^\d+$/.test(s) ? parseInt(s) : new Date(s).getTime();
        const body = {
          taskId,
          startTime: toMs(startTime),
          endTime: endTime ? toMs(endTime) : undefined,
          subCategory: subCategory ?? '',
          note,
        };
        const result = await api.post('/timeslots', body);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'timeslot_clock_in',
    '開始計時（建立一筆無結束時間的時間紀錄，startTime = 現在）。如已有進行中的計時，新的計時會同時建立。',
    {
      taskId: z.string().optional().describe('要計時的任務 ID'),
      subCategory: z.string().optional().default('').describe('子分類'),
      note: z.string().optional().describe('備注'),
    },
    async ({ taskId, subCategory, note }) => {
      try {
        const body = {
          taskId,
          startTime: Date.now(),
          subCategory: subCategory ?? '',
          note,
        };
        const result = await api.post('/timeslots', body);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'timeslot_clock_out',
    '結束計時（找到最近一筆無結束時間的時間紀錄，設定 endTime = 現在）。',
    {
      taskId: z.string().optional().describe('指定任務 ID，只結束此任務的計時（不填則結束最近一筆）'),
    },
    async ({ taskId }) => {
      try {
        const all = await api.get('/timeslots') as { data?: Array<{ id: string; startTime: number; endTime?: number; taskId?: string }> };
        const timeslots = all?.data ?? [];
        // 找最近一筆沒有 endTime 的
        const open = timeslots
          .filter(ts => !ts.endTime && (taskId ? ts.taskId === taskId : true))
          .sort((a, b) => b.startTime - a.startTime);
        if (open.length === 0) {
          return text('找不到進行中的計時紀錄。');
        }
        const target = open[0];
        const endTime = Date.now();
        const result = await api.patch(`/timeslots/${target.id}`, { endTime });
        const durationMin = ((endTime - target.startTime) / 60000).toFixed(1);
        return text(`計時結束。時長：${durationMin} 分鐘\n\n${JSON.stringify(result, null, 2)}`);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'timeslot_update',
    '更新時間紀錄。只傳入要修改的欄位。',
    {
      id: z.string().describe('時間紀錄 ID'),
      taskId: z.string().optional().describe('重新關聯任務 ID'),
      startTime: z.string().optional().describe('新開始時間（epoch ms 或 ISO 格式）'),
      endTime: z.string().optional().describe('新結束時間（epoch ms 或 ISO 格式）'),
      subCategory: z.string().optional().describe('子分類'),
      note: z.string().optional().describe('備注'),
    },
    async ({ id, startTime, endTime, ...rest }) => {
      try {
        const toMs = (s: string) => /^\d+$/.test(s) ? parseInt(s) : new Date(s).getTime();
        const updates: Record<string, unknown> = { ...rest };
        if (startTime) updates.startTime = toMs(startTime);
        if (endTime) updates.endTime = toMs(endTime);
        const result = await api.patch(`/timeslots/${id}`, updates);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'timeslot_delete',
    '刪除時間紀錄。',
    { id: z.string().describe('時間紀錄 ID') },
    async ({ id }) => {
      try {
        const result = await api.delete(`/timeslots/${id}`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );
}
