import type { Task, Timeslot } from '../types';
import { getAllDescendantIds } from './taskHierarchy';

/**
 * 取得任務及所有後代的實際開始時間（最早 timeslot 的 startTime）。
 * 若無任何 timeslot，回傳 undefined。
 */
export const getTaskActualStart = (
  taskId: string,
  tasks: Task[],
  timeslots: Timeslot[],
): number | undefined => {
  const allIds = [taskId, ...getAllDescendantIds(tasks, taskId)];
  const relevantTs = timeslots.filter(ts => ts.taskId && allIds.includes(ts.taskId));
  if (relevantTs.length === 0) return undefined;
  return Math.min(...relevantTs.map(ts => ts.startTime));
};

/**
 * 取得任務及所有後代的實際結束時間（最晚 timeslot 的 endTime）。
 * 若有任何進行中（無 endTime）的 timeslot，回傳 undefined。
 * 若無任何 timeslot，回傳 undefined。
 */
export const getTaskActualEnd = (
  taskId: string,
  tasks: Task[],
  timeslots: Timeslot[],
): number | undefined => {
  const allIds = [taskId, ...getAllDescendantIds(tasks, taskId)];
  const relevantTs = timeslots.filter(ts => ts.taskId && allIds.includes(ts.taskId));
  if (relevantTs.length === 0) return undefined;
  // 若有進行中的 timeslot，表示尚未結束
  if (relevantTs.some(ts => !ts.endTime)) return undefined;
  return Math.max(...relevantTs.map(ts => ts.endTime!));
};
