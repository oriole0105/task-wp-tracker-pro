import type { Task } from '../types';

/** 依 tasks 陣列順序計算 WBS 編號，回傳 taskId → 編號字串 的 Map */
export const computeTaskWbsNumbers = (tasks: Task[]): Map<string, string> => {
  const numbering = new Map<string, string>();
  const counters = new Map<string | undefined, number>();
  for (const task of tasks) {
    const parentId = task.parentId;
    const count = (counters.get(parentId) || 0) + 1;
    counters.set(parentId, count);
    const parentLabel = parentId ? numbering.get(parentId) : undefined;
    numbering.set(task.id, parentLabel ? `${parentLabel}.${count}` : `${count}`);
  }
  return numbering;
};
