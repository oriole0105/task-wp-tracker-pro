import type { Task } from '../types';

/** 依 tasks 陣列順序計算 WBS 編號，回傳 taskId → 編號字串 的 Map */
export const computeTaskWbsNumbers = (tasks: Task[]): Map<string, string> => {
  const numbering = new Map<string, string>();
  // 以 parentId 分群，保留原始陣列順序
  const childrenMap = new Map<string | undefined, Task[]>();
  for (const task of tasks) {
    const key = task.parentId;
    const list = childrenMap.get(key);
    if (list) list.push(task);
    else childrenMap.set(key, [task]);
  }
  // 遞迴建構 WBS 編號
  const build = (parentId: string | undefined, prefix: string) => {
    const children = childrenMap.get(parentId);
    if (!children) return;
    children.forEach((child, i) => {
      const label = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      numbering.set(child.id, label);
      build(child.id, label);
    });
  };
  // 根任務：parentId 為 undefined 或其 parent 不存在於 tasks 中
  const taskIds = new Set(tasks.map(t => t.id));
  const orphanParents = new Set<string>();
  for (const task of tasks) {
    if (task.parentId && !taskIds.has(task.parentId)) {
      orphanParents.add(task.parentId);
    }
  }
  build(undefined, '');
  for (const orphanPid of orphanParents) {
    build(orphanPid, '');
  }
  return numbering;
};
