import type { Task } from '../types';

/**
 * 依階層結構計算 WBS 編號，並回傳按階層排序的任務清單。
 * 同層任務的順序依原始陣列順序決定。
 */
export const computeTaskWbsMap = (tasks: Task[]): { wbsNumbers: Map<string, string>; sorted: Task[] } => {
  const wbsNumbers = new Map<string, string>();
  const sorted: Task[] = [];

  // 以 parentId 分群，保留原始陣列順序
  const childrenMap = new Map<string | undefined, Task[]>();
  for (const task of tasks) {
    const key = task.parentId;
    const list = childrenMap.get(key);
    if (list) list.push(task);
    else childrenMap.set(key, [task]);
  }

  // 遞迴建構 WBS 編號並收集排序結果
  const build = (parentId: string | undefined, prefix: string) => {
    const children = childrenMap.get(parentId);
    if (!children) return;
    children.forEach((child, i) => {
      const label = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      wbsNumbers.set(child.id, label);
      sorted.push(child);
      build(child.id, label);
    });
  };

  // 找出孤兒任務（parent 已封存/不存在），將其視為根任務一併編號
  const taskIds = new Set(tasks.map(t => t.id));
  const rootKeys: (string | undefined)[] = [undefined];
  for (const task of tasks) {
    if (task.parentId && !taskIds.has(task.parentId)) {
      if (!rootKeys.includes(task.parentId)) rootKeys.push(task.parentId);
    }
  }

  // 所有根群組合併編號（孤兒任務接續根任務的編號，而非重置為 1）
  let rootCounter = 0;
  for (const key of rootKeys) {
    const children = childrenMap.get(key);
    if (!children) continue;
    children.forEach((child) => {
      rootCounter++;
      const label = `${rootCounter}`;
      wbsNumbers.set(child.id, label);
      sorted.push(child);
      build(child.id, label);
    });
  }

  return { wbsNumbers, sorted };
};

/** 向後相容：僅回傳 WBS 編號 Map */
export const computeTaskWbsNumbers = (tasks: Task[]): Map<string, string> =>
  computeTaskWbsMap(tasks).wbsNumbers;
