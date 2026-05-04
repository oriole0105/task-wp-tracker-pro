import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient, json, text, handleError } from '../client.js';

const FormatEnum = z.enum(['adoc', 'json']).optional().default('adoc');

export function registerReportTools(server: McpServer, api: ApiClient): void {

  server.tool(
    'report_weekly',
    '產生週報（AsciiDoc 格式或 JSON 摘要）。anchorDate 為報告所在週的任意日期，預設本週。',
    {
      anchorDate: z.string().optional().describe('報告所在週的任意日期 YYYY-MM-DD（預設今日）'),
      format: FormatEnum.describe('輸出格式：adoc（預設）或 json（回傳期間摘要）'),
      levels: z.string().optional().describe('顯示階層，逗號分隔，如 "1,2,3"（預設 1-5）'),
      excluded: z.string().optional().describe('排除的主分類，逗號分隔'),
      showTodayMark: z.boolean().optional().default(true).describe('甘特圖顯示今日標記'),
      groupByCategory: z.boolean().optional().default(false).describe('甘特圖依分類分組'),
    },
    async ({ anchorDate, format, levels, excluded, showTodayMark, groupByCategory }) => {
      try {
        const params: Record<string, string | undefined> = {
          anchorDate,
          format: format ?? 'adoc',
          levels,
          excluded,
          showTodayMark: showTodayMark === false ? 'false' : undefined,
          groupByCategory: groupByCategory ? 'true' : undefined,
        };
        if (format === 'adoc' || !format) {
          const adoc = await api.getText('/reports/weekly', params);
          return text(adoc);
        }
        const result = await api.get('/reports/weekly', params);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'report_bi_monthly',
    '產生雙月盤點報告。anchorDate 為報告所在雙月期的任意日期，預設今日。',
    {
      anchorDate: z.string().optional().describe('報告所在雙月期的任意日期 YYYY-MM-DD（預設今日）'),
      format: FormatEnum.describe('輸出格式：adoc（預設）或 json'),
      levels: z.string().optional().describe('顯示階層，逗號分隔'),
      excluded: z.string().optional().describe('排除的主分類，逗號分隔'),
    },
    async ({ anchorDate, format, levels, excluded }) => {
      try {
        const params: Record<string, string | undefined> = {
          anchorDate, format: format ?? 'adoc', levels, excluded,
        };
        if (format === 'adoc' || !format) {
          const adoc = await api.getText('/reports/bi-monthly', params);
          return text(adoc);
        }
        const result = await api.get('/reports/bi-monthly', params);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'report_half_year',
    '產生半年報。anchorDate 為報告所在半年期的任意日期，預設今日。',
    {
      anchorDate: z.string().optional().describe('報告所在半年期的任意日期 YYYY-MM-DD（預設今日）'),
      format: FormatEnum.describe('輸出格式：adoc（預設）或 json'),
      levels: z.string().optional().describe('顯示階層，逗號分隔'),
      excluded: z.string().optional().describe('排除的主分類，逗號分隔'),
      ganttScale: z.enum(['daily', 'weekly', 'monthly']).optional().default('weekly').describe('甘特圖時間刻度（半年報建議 weekly）'),
    },
    async ({ anchorDate, format, levels, excluded, ganttScale }) => {
      try {
        const params: Record<string, string | undefined> = {
          anchorDate, format: format ?? 'adoc', levels, excluded,
          ganttScale: ganttScale ?? 'weekly',
        };
        if (format === 'adoc' || !format) {
          const adoc = await api.getText('/reports/half-year', params);
          return text(adoc);
        }
        const result = await api.get('/reports/half-year', params);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'report_calendar_ics',
    '匯出指定日期範圍的時間紀錄為 ICS 格式（可匯入日曆）。回傳 ICS 文字內容。',
    {
      from: z.string().optional().describe('起始日期 YYYY-MM-DD'),
      to: z.string().optional().describe('結束日期 YYYY-MM-DD'),
    },
    async ({ from, to }) => {
      try {
        const ics = await api.getText('/reports/calendar.ics', { from, to });
        return text(ics);
      } catch (e) { return handleError(e); }
    },
  );
}
