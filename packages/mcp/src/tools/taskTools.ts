import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiClient, json, text, handleError, parseDate } from '../client.js';

const TaskStatusEnum = z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED']);

export function registerTaskTools(server: McpServer, api: ApiClient): void {

  server.tool(
    'task_list',
    '列出任務清單。不傳任何參數時回傳所有未封存任務，每筆附帶 wbsNumber 欄位並依 WBS 階層順序排列，方便後續用 task_find_by_wbs 操作。指定 parentId 時回傳該任務的直接子任務（不含 WBS 編號）。',
    {
      archived: z.boolean().optional().describe('true=只看封存任務；省略=只看未封存（附 WBS 編號）'),
      parentId: z.string().optional().describe('只回傳此父任務的直接子任務'),
    },
    async ({ archived, parentId }) => {
      try {
        // 未指定篩選條件時呼叫 wbs-map，回傳含 WBS 編號的排序清單
        if (archived === undefined && parentId === undefined) {
          const result = await api.get('/tasks/wbs-map');
          return json(result);
        }
        const result = await api.get('/tasks', { archived, parentId });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_find_by_wbs',
    '依 WBS 編號查找任務（如 "1"、"2.3"、"1.4.2"），回傳任務完整資料與 ID。WBS 編號可從 task_list 的結果 wbsNumber 欄位取得。找到任務後可直接用 task_update 的 id 欄位操作。',
    {
      wbs: z.string().describe('WBS 編號，例如 "1"、"2.3"、"1.4.2"'),
    },
    async ({ wbs }) => {
      try {
        const result = await api.get('/tasks/wbs-map') as { ok: boolean; data: Array<{ wbsNumber: string; id: string; title: string; status: string }> };
        if (!result.ok || !Array.isArray(result.data)) return text('無法取得任務清單');
        const task = result.data.find(t => t.wbsNumber === wbs.trim());
        if (!task) return text(`找不到 WBS "${wbs}" 的任務。請先執行 task_list 確認正確的 WBS 編號。`);
        return json({ ok: true, data: task });
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_get',
    '依 ID 取得單一任務的完整資料，包含 outputs、weeklySnapshots 等欄位。',
    { id: z.string().describe('任務 ID') },
    async ({ id }) => {
      try {
        const result = await api.get(`/tasks/${id}`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_get_subtasks',
    '取得指定任務的所有直接子任務。',
    { id: z.string().describe('父任務 ID') },
    async ({ id }) => {
      try {
        const result = await api.get(`/tasks/${id}/subtasks`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_get_total_time',
    '取得任務（含所有後代子任務）的總花費時間（毫秒）。',
    { id: z.string().describe('任務 ID') },
    async ({ id }) => {
      try {
        const result = await api.get(`/tasks/${id}/total-time`) as { data: { ms: number } };
        const ms = (result as { data?: { ms?: number } }).data?.ms ?? 0;
        const hours = (ms / 3_600_000).toFixed(2);
        return text(`任務總工時：${hours} 小時（${ms} ms）`);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_create',
    '建立新任務。',
    {
      title: z.string().min(1).describe('任務標題（必填）'),
      description: z.string().optional().describe('詳細說明'),
      mainCategory: z.string().optional().describe('主分類（需與現有分類一致）'),
      status: TaskStatusEnum.optional().describe('初始狀態（預設 TODO）'),
      parentId: z.string().optional().describe('父任務 ID（建立子任務時填入）'),
      estimatedStartDate: z.string().optional().describe('預計開始日期 YYYY-MM-DD'),
      estimatedEndDate: z.string().optional().describe('預計完成日期 YYYY-MM-DD'),
      completeness: z.number().min(0).max(100).optional().describe('初始完成度 0-100'),
    },
    async ({ title, description, mainCategory, status, parentId, estimatedStartDate, estimatedEndDate, completeness }) => {
      try {
        const body = {
          title,
          aliasTitle: '',
          description: description ?? '',
          mainCategory: mainCategory ?? '',
          status: status ?? 'TODO',
          parentId,
          estimatedStartDate: parseDate(estimatedStartDate),
          estimatedEndDate: parseDate(estimatedEndDate),
          completeness,
          outputs: [],
          assignee: '',
          reporter: '',
          showInReport: true,
          showInWbs: true,
          archived: false,
        };
        const result = await api.post('/tasks', body);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_update',
    '更新任務欄位。只需傳入要修改的欄位，其餘保持不變。',
    {
      id: z.string().describe('任務 ID'),
      title: z.string().optional().describe('新標題'),
      description: z.string().optional().describe('新說明'),
      mainCategory: z.string().optional().describe('主分類'),
      status: TaskStatusEnum.optional().describe('新狀態'),
      estimatedStartDate: z.string().optional().describe('預計開始日期 YYYY-MM-DD'),
      estimatedEndDate: z.string().optional().describe('預計完成日期 YYYY-MM-DD'),
      completeness: z.number().min(0).max(100).optional().describe('完成度 0-100'),
      completenessType: z.enum(['real', 'confidence']).optional().describe('完成度類型'),
      pauseReason: z.string().optional().describe('暫停原因（status=PAUSED 時填入）'),
    },
    async ({ id, estimatedStartDate, estimatedEndDate, ...rest }) => {
      try {
        const updates: Record<string, unknown> = { ...rest };
        if (estimatedStartDate !== undefined) updates.estimatedStartDate = parseDate(estimatedStartDate);
        if (estimatedEndDate !== undefined) updates.estimatedEndDate = parseDate(estimatedEndDate);
        const result = await api.patch(`/tasks/${id}`, updates);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_delete',
    '刪除任務（同時刪除所有子任務）。此操作不可逆，請確認後執行。',
    { id: z.string().describe('任務 ID') },
    async ({ id }) => {
      try {
        const result = await api.delete(`/tasks/${id}`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_archive',
    '封存任務（從主視圖隱藏但保留資料）。',
    { id: z.string().describe('任務 ID') },
    async ({ id }) => {
      try {
        const result = await api.post(`/tasks/${id}/archive`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_unarchive',
    '取消封存任務（重新顯示於主視圖）。',
    { id: z.string().describe('任務 ID') },
    async ({ id }) => {
      try {
        const result = await api.post(`/tasks/${id}/unarchive`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_archive_all_done',
    '將所有狀態為 DONE 的任務批次封存。',
    {},
    async () => {
      try {
        const result = await api.post('/tasks/archive-all-done');
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_update_snapshot',
    '為任務新增或更新週進度快照（完成度記錄）。weekStart 格式為 YYYY-MM-DD（週日）。',
    {
      id: z.string().describe('任務 ID'),
      weekStart: z.string().describe('週起始日 YYYY-MM-DD（建議填當週週日）'),
      completeness: z.number().min(0).max(100).describe('本週完成度 0-100'),
      note: z.string().optional().describe('本週進度說明'),
    },
    async ({ id, weekStart, completeness, note }) => {
      try {
        const result = await api.patch(`/tasks/${id}/snapshots`, { weekStart, completeness, note });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  // ── 批次匯入 ────────────────────────────────────────────────────

  server.tool(
    'task_batch_import',
    '批次匯入任務（支援多層巢狀結構）。tasks 為 JSON 陣列，每筆可含 children 欄位定義子任務。可選擇掛載到指定父任務下。',
    {
      tasks: z.array(z.record(z.unknown())).describe('任務陣列，每筆可含 title（必填）、description、mainCategory、status、estimatedStartDate、estimatedEndDate、children 等欄位'),
      parentId: z.string().optional().describe('掛載的父任務 ID（留空則加入頂層）'),
    },
    async ({ tasks, parentId }) => {
      try {
        const result = await api.post('/tasks/import', { tasks, parentId });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_duplicate',
    '複製任務（不含子任務、里程碑、完成度）。',
    { id: z.string().describe('要複製的任務 ID') },
    async ({ id }) => {
      try {
        const result = await api.post(`/tasks/${id}/duplicate`);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_reorder',
    '調整任務在清單中的位置或層級。',
    {
      id: z.string().describe('任務 ID'),
      direction: z.enum(['up', 'down', 'promote', 'demote']).describe('up=上移, down=下移, promote=提升層級, demote=降低層級'),
    },
    async ({ id, direction }) => {
      try {
        const result = await api.post(`/tasks/${id}/reorder`, { direction });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  // ── 里程碑 ──────────────────────────────────────────────────────

  server.tool(
    'task_milestone_list',
    '列出任務的所有里程碑。',
    { id: z.string().describe('任務 ID') },
    async ({ id }) => {
      try {
        const result = await api.get(`/tasks/${id}`) as { data?: { milestones?: unknown[] } };
        const milestones = result?.data?.milestones ?? [];
        return json({ ok: true, data: milestones });
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_milestone_upsert',
    '新增或更新任務的里程碑。傳入 milestoneId 時更新現有里程碑，否則新增一筆。',
    {
      taskId: z.string().describe('任務 ID'),
      milestoneId: z.string().optional().describe('要更新的里程碑 ID（留空則新增）'),
      title: z.string().min(1).describe('里程碑名稱'),
      date: z.string().describe('里程碑日期 YYYY-MM-DD'),
      showInGantt: z.boolean().optional().default(true).describe('是否顯示於甘特圖'),
      color: z.string().optional().describe('顏色名稱，如 Red、Gold、Blue、Green、Purple（PlantUML 顏色名）'),
      note: z.string().optional().describe('備註'),
    },
    async ({ taskId, milestoneId, title, date, showInGantt, color, note }) => {
      try {
        const task = await api.get(`/tasks/${taskId}`) as { data?: { milestones?: Array<{ id: string; [k: string]: unknown }> } };
        if (!task?.data) return text(`找不到任務 ${taskId}`);
        const milestones = task.data.milestones ?? [];
        const newMs = { id: milestoneId ?? crypto.randomUUID(), title, date, showInGantt: showInGantt ?? true, color, note };
        const updated = milestoneId
          ? milestones.map(m => m.id === milestoneId ? { ...m, ...newMs } : m)
          : [...milestones, newMs];
        const result = await api.patch(`/tasks/${taskId}`, { milestones: updated });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_milestone_delete',
    '刪除任務的指定里程碑。',
    {
      taskId: z.string().describe('任務 ID'),
      milestoneId: z.string().describe('要刪除的里程碑 ID'),
    },
    async ({ taskId, milestoneId }) => {
      try {
        const task = await api.get(`/tasks/${taskId}`) as { data?: { milestones?: Array<{ id: string }> } };
        if (!task?.data) return text(`找不到任務 ${taskId}`);
        const milestones = (task.data.milestones ?? []).filter(m => m.id !== milestoneId);
        const result = await api.patch(`/tasks/${taskId}`, { milestones });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  // ── 工作產出 ────────────────────────────────────────────────────

  server.tool(
    'task_output_list',
    '列出任務的所有工作產出。',
    { taskId: z.string().describe('任務 ID') },
    async ({ taskId }) => {
      try {
        const result = await api.get(`/tasks/${taskId}`) as { data?: { outputs?: unknown[] } };
        return json({ ok: true, data: result?.data?.outputs ?? [] });
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_output_add',
    '為任務新增工作產出。',
    {
      taskId: z.string().describe('任務 ID'),
      name: z.string().min(1).describe('產出名稱'),
      outputTypeId: z.string().optional().describe('產出類型 ID（可從 output_type_list 取得）'),
      completeness: z.string().optional().describe('完成度，如 "80%"'),
      effectiveDate: z.string().optional().describe('歸屬期間日期 YYYY-MM-DD（週期型產出填入，持續型留空）'),
      link: z.string().optional().describe('有形產出的連結'),
      summary: z.string().optional().describe('無形產出的摘要'),
    },
    async ({ taskId, name, outputTypeId, completeness, effectiveDate, link, summary }) => {
      try {
        const task = await api.get(`/tasks/${taskId}`) as { data?: { outputs?: unknown[] } };
        if (!task?.data) return text(`找不到任務 ${taskId}`);
        const outputs = task.data.outputs ?? [];
        const newOutput = { id: crypto.randomUUID(), name, outputTypeId, completeness, effectiveDate, link, summary, weeklySnapshots: [] };
        const result = await api.patch(`/tasks/${taskId}`, { outputs: [...outputs, newOutput] });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_output_update',
    '更新任務的指定工作產出。只需傳入要修改的欄位。',
    {
      taskId: z.string().describe('任務 ID'),
      outputId: z.string().describe('產出 ID'),
      name: z.string().optional().describe('產出名稱'),
      outputTypeId: z.string().optional().describe('產出類型 ID'),
      completeness: z.string().optional().describe('完成度，如 "80%"'),
      effectiveDate: z.string().optional().describe('歸屬期間日期 YYYY-MM-DD'),
      link: z.string().optional().describe('有形產出的連結'),
      summary: z.string().optional().describe('無形產出的摘要'),
    },
    async ({ taskId, outputId, ...updates }) => {
      try {
        const result = await api.patch(`/tasks/${taskId}/outputs/${outputId}`, updates);
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );

  server.tool(
    'task_output_delete',
    '刪除任務的指定工作產出。',
    {
      taskId: z.string().describe('任務 ID'),
      outputId: z.string().describe('要刪除的產出 ID'),
    },
    async ({ taskId, outputId }) => {
      try {
        const task = await api.get(`/tasks/${taskId}`) as { data?: { outputs?: Array<{ id: string }> } };
        if (!task?.data) return text(`找不到任務 ${taskId}`);
        const outputs = (task.data.outputs ?? []).filter(o => o.id !== outputId);
        const result = await api.patch(`/tasks/${taskId}`, { outputs });
        return json(result);
      } catch (e) { return handleError(e); }
    },
  );
}
