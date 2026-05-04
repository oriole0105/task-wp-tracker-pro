import type { Timeslot, Task } from '../types';
import { format } from 'date-fns';

export interface OverlapInfo {
  id: string;
  startTime: number;
  endTime: number;
  taskTitle: string;
  overlapMinutes: number;
}

/**
 * 找出與指定時段重疊的既有 timeslot。
 * 僅檢查有 endTime 的 timeslot（進行中的計時不檢查）。
 */
export function findOverlappingTimeslots(
  timeslots: Timeslot[],
  tasks: Task[],
  startTime: number,
  endTime: number,
  excludeId?: string,
): OverlapInfo[] {
  const results: OverlapInfo[] = [];

  for (const ts of timeslots) {
    if (!ts.endTime) continue;
    if (excludeId && ts.id === excludeId) continue;

    const overlapStart = Math.max(ts.startTime, startTime);
    const overlapEnd = Math.min(ts.endTime, endTime);

    if (overlapStart < overlapEnd) {
      const task = ts.taskId ? tasks.find(t => t.id === ts.taskId) : undefined;
      results.push({
        id: ts.id,
        startTime: ts.startTime,
        endTime: ts.endTime,
        taskTitle: task?.title || '（未連結任務）',
        overlapMinutes: Math.round((overlapEnd - overlapStart) / 60000),
      });
    }
  }

  return results;
}

/** 將重疊資訊格式化為使用者可讀的錯誤訊息 */
export function formatOverlapMessage(overlaps: OverlapInfo[]): string {
  const details = overlaps.map(o =>
    `「${o.taskTitle}」(${format(o.startTime, 'HH:mm')}-${format(o.endTime, 'HH:mm')})`
  ).join('、');
  return `時間與${details}重疊，請調整時間範圍。`;
}
