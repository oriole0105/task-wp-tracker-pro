import type { Task, TaskStatus } from '../types';

/**
 * 遞迴取得某任務的所有後代 ID（不含自身）
 */
export const getAllDescendantIds = (tasks: Task[], rootId: string): string[] => {
  const children = tasks.filter(t => t.parentId === rootId);
  return children.flatMap(c => [c.id, ...getAllDescendantIds(tasks, c.id)]);
};

/**
 * 根據子任務狀態推導父任務應有的狀態。
 * 排除 CANCELLED 子任務後計算。
 * 若所有子任務都 CANCELLED，回傳 null（不自動更新）。
 */
export const deriveParentStatus = (children: Task[]): TaskStatus | null => {
  const effective = children.filter(c => c.status !== 'CANCELLED');
  if (effective.length === 0) return null; // 全部 CANCELLED，不自動推導

  const statuses = new Set(effective.map(c => c.status));

  // 任何一個 IN_PROGRESS → IN_PROGRESS
  if (statuses.has('IN_PROGRESS')) return 'IN_PROGRESS';

  // 全部 DONE → DONE
  if (statuses.size === 1 && statuses.has('DONE')) return 'DONE';

  // 全部 PAUSED → PAUSED
  if (statuses.size === 1 && statuses.has('PAUSED')) return 'PAUSED';

  // 全部 BACKLOG → BACKLOG
  if (statuses.size === 1 && statuses.has('BACKLOG')) return 'BACKLOG';

  // 全部 TODO（或混合 BACKLOG+TODO） → TODO
  if ([...statuses].every(s => s === 'TODO' || s === 'BACKLOG')) return 'TODO';

  // 有 PAUSED 且有 TODO/BACKLOG（無 IN_PROGRESS）→ IN_PROGRESS（工作已開始但部分暫停）
  if (statuses.has('PAUSED') && (statuses.has('TODO') || statuses.has('BACKLOG'))) return 'IN_PROGRESS';

  // 混合 DONE + TODO/BACKLOG（無 IN_PROGRESS/PAUSED） → IN_PROGRESS（工作已部分完成）
  if (statuses.has('DONE') && (statuses.has('TODO') || statuses.has('BACKLOG'))) return 'IN_PROGRESS';

  // 混合 DONE + PAUSED → PAUSED
  if (statuses.has('DONE') && statuses.has('PAUSED')) return 'PAUSED';

  // 其他未列舉情況 → IN_PROGRESS（安全預設）
  return 'IN_PROGRESS';
};

export interface StatusChangeInfo {
  taskTitle: string;
  newStatus: TaskStatus;
}

/**
 * 純函式：從某任務開始向上傳播狀態。
 * 直接操作 tasks 陣列（不依賴 store），回傳修改後的陣列與最後一次狀態變更資訊。
 */
export const propagateStatusToAncestors = (
  tasks: Task[],
  taskId: string,
): { tasks: Task[]; lastChange: StatusChangeInfo | null } => {
  let result = tasks;
  let lastChange: StatusChangeInfo | null = null;

  const task = result.find(t => t.id === taskId);
  if (!task?.parentId) return { tasks: result, lastChange };

  let currentParentId: string | undefined = task.parentId;
  while (currentParentId) {
    const pid: string = currentParentId;
    const parentTask: Task | undefined = result.find(t => t.id === pid);
    if (!parentTask) break;

    const children = result.filter(t => t.parentId === pid);
    if (children.length === 0) break;

    const derived = deriveParentStatus(children);
    if (derived === null || derived === parentTask.status) {
      currentParentId = parentTask.parentId;
      continue;
    }

    result = result.map(t => t.id === pid ? { ...t, status: derived } : t);
    lastChange = { taskTitle: parentTask.title, newStatus: derived };
    currentParentId = parentTask.parentId;
  }

  return { tasks: result, lastChange };
};
