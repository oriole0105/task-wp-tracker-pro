import {
  startOfDay, endOfDay, addDays, subMonths, subDays, subWeeks, startOfWeek, format,
} from 'date-fns';
import type { Task, TaskStatus, Timeslot, WeeklySnapshot } from '../types/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type ReportType = 'weekly' | 'bimonthly' | 'semiannual';
export type GanttMode = 'weekly' | 'workReview';

export interface Period {
  start: Date;
  end: Date;
}

export interface PeriodLabels {
  prevShort: string;
  currShort: string;
  deltaLabel: string;
  rangeDisplay: string;
}

// ── Period computation ────────────────────────────────────────────────────────

export function computeGanttPeriod(reportType: ReportType, anchorDate: Date): Period {
  if (reportType === 'weekly') {
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
    return { start: startOfDay(weekStart), end: endOfDay(addDays(weekStart, 6)) };
  }
  if (reportType === 'bimonthly') {
    const month = anchorDate.getMonth();
    const year = anchorDate.getFullYear();
    const pairStart = month % 2 === 0 ? month : month - 1;
    return {
      start: startOfDay(new Date(year, pairStart, 1)),
      end: endOfDay(new Date(year, pairStart + 2, 0)),
    };
  }
  // semiannual: 12-5月 / 6-11月
  const month = anchorDate.getMonth();
  const year = anchorDate.getFullYear();
  if (month >= 5 && month <= 10) {
    return { start: startOfDay(new Date(year, 5, 1)), end: endOfDay(new Date(year, 11, 0)) };
  }
  if (month === 11) {
    return { start: startOfDay(new Date(year, 11, 1)), end: endOfDay(new Date(year + 1, 5, 0)) };
  }
  return { start: startOfDay(new Date(year - 1, 11, 1)), end: endOfDay(new Date(year, 5, 0)) };
}

export function computeProgressPeriod(reportType: ReportType, anchorDate: Date, ganttPeriod: Period): Period {
  if (reportType !== 'bimonthly') return ganttPeriod;
  const month = anchorDate.getMonth();
  const year = anchorDate.getFullYear();
  const currPairStart = month % 2 === 0 ? month : month - 1;
  return {
    start: startOfDay(new Date(year, currPairStart - 2, 1)),
    end: endOfDay(new Date(year, currPairStart, 0)),
  };
}

export function computePrevPeriod(reportType: ReportType, progressPeriod: Period): Period {
  if (reportType === 'weekly') {
    const prevStart = subWeeks(progressPeriod.start, 1);
    return { start: startOfDay(prevStart), end: endOfDay(addDays(prevStart, 6)) };
  }
  if (reportType === 'bimonthly') {
    return {
      start: startOfDay(subMonths(progressPeriod.start, 2)),
      end: endOfDay(subDays(progressPeriod.start, 1)),
    };
  }
  return {
    start: startOfDay(subMonths(progressPeriod.start, 6)),
    end: endOfDay(subDays(progressPeriod.start, 1)),
  };
}

export function computePeriodLabels(reportType: ReportType, progressPeriod: Period, prevPeriod: Period): PeriodLabels {
  const pStart = format(prevPeriod.start, 'yyyy-MM-dd');
  const pEnd = format(prevPeriod.end, 'yyyy-MM-dd');
  const cStart = format(progressPeriod.start, 'yyyy-MM-dd');
  const cEnd = format(progressPeriod.end, 'yyyy-MM-dd');
  if (reportType === 'weekly') {
    return {
      prevShort: '上週%', currShort: '本週%', deltaLabel: '週間△',
      rangeDisplay: `上週：${pStart}　→　本週：${cStart}`,
    };
  }
  return {
    prevShort: '前期%', currShort: '本期%', deltaLabel: '期間△',
    rangeDisplay: `前期：${pStart}～${pEnd}　→　本期：${cStart}～${cEnd}`,
  };
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

export function getSnapshotAtOrBefore(
  snapshots: WeeklySnapshot[] | undefined,
  dateStr: string,
): number | undefined {
  if (!snapshots?.length) return undefined;
  const valid = snapshots
    .filter(s => s.weekStart <= dateStr)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return valid.length > 0 ? valid[valid.length - 1].completeness : undefined;
}

export function getSnapshotInPeriod(
  snapshots: WeeklySnapshot[] | undefined,
  startStr: string,
  endStr: string,
): number | undefined {
  if (!snapshots?.length) return undefined;
  const valid = snapshots
    .filter(s => s.weekStart >= startStr && s.weekStart <= endStr)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return valid.length > 0 ? valid[valid.length - 1].completeness : undefined;
}

export function getSnapshotNoteInPeriod(
  snapshots: WeeklySnapshot[] | undefined,
  startStr: string,
  endStr: string,
): string | undefined {
  if (!snapshots?.length) return undefined;
  const valid = snapshots
    .filter(s => s.weekStart >= startStr && s.weekStart <= endStr)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return valid.length > 0 ? valid[valid.length - 1].note : undefined;
}

// ── SPI ───────────────────────────────────────────────────────────────────────

export function calcSPI(task: Task, now = Date.now()): { planned: number; spi: number } | null {
  if (!task.estimatedEndDate) return null;
  const start = task.estimatedStartDate ?? task.estimatedEndDate;
  const end = task.estimatedEndDate;
  if (now <= start) return null;
  const plannedPct = now >= end ? 100 : ((now - start) / (end - start)) * 100;
  if (plannedPct === 0) return null;
  const actualPct = task.completeness ?? 0;
  return { planned: Math.round(plannedPct), spi: Math.round((actualPct / plannedPct) * 100) / 100 };
}

// ── Hierarchy ────────────────────────────────────────────────────────────────

export function getTaskDepth(task: Task, tasks: Task[]): number {
  let depth = 1;
  let current = task;
  while (current.parentId) {
    const parent = tasks.find(t => t.id === current.parentId);
    if (!parent) break;
    current = parent;
    depth++;
  }
  return depth;
}

// ── Task filtering ────────────────────────────────────────────────────────────

export function computeActiveTasks(
  tasks: Task[],
  timeslots: Timeslot[],
  ganttPeriod: Period,
  selectedLevels: number[],
): Task[] {
  const startTs = ganttPeriod.start.getTime();
  const endTs = ganttPeriod.end.getTime();
  return tasks.filter(task => {
    if (task.archived) return false;
    if (!selectedLevels.includes(getTaskDepth(task, tasks))) return false;
    const hasEstimated = task.estimatedStartDate && task.estimatedStartDate <= endTs &&
      (!task.estimatedEndDate || task.estimatedEndDate >= startTs);
    const hasActual = timeslots.some(ts => {
      if (ts.taskId !== task.id) return false;
      const logEnd = ts.endTime || Date.now();
      return ts.startTime <= endTs && logEnd >= startTs;
    });
    return hasEstimated || hasActual;
  });
}

export function computeProgressTasks(
  tasks: Task[],
  timeslots: Timeslot[],
  progressPeriod: Period,
  selectedLevels: number[],
): Task[] {
  const startTs = progressPeriod.start.getTime();
  const endTs = progressPeriod.end.getTime();
  const currStartStr = format(progressPeriod.start, 'yyyy-MM-dd');
  const currEndStr = format(progressPeriod.end, 'yyyy-MM-dd');
  return tasks.filter(task => {
    if (task.archived) return false;
    if (!selectedLevels.includes(getTaskDepth(task, tasks))) return false;
    const hasEstimated = task.estimatedStartDate && task.estimatedStartDate <= endTs &&
      (!task.estimatedEndDate || task.estimatedEndDate >= startTs);
    const hasActual = timeslots.some(ts => {
      if (ts.taskId !== task.id) return false;
      const logEnd = ts.endTime || Date.now();
      return ts.startTime <= endTs && logEnd >= startTs;
    });
    const hasOutput = task.outputs.some(o =>
      o.effectiveDate && o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr
    );
    return hasEstimated || hasActual || hasOutput;
  });
}

export interface ProgressSplit {
  withProgress: Task[];
  withoutProgress: Task[];
  prevEndStr: string;
  currStartStr: string;
  currEndStr: string;
}

export function computeProgressSplit(
  progressTasks: Task[],
  timeslots: Timeslot[],
  prevPeriod: Period,
  progressPeriod: Period,
  excludedMainCats: string[],
): ProgressSplit {
  const prevEndStr = format(prevPeriod.end, 'yyyy-MM-dd');
  const currStartStr = format(progressPeriod.start, 'yyyy-MM-dd');
  const currEndStr = format(progressPeriod.end, 'yyyy-MM-dd');
  const periodStartMs = progressPeriod.start.getTime();
  const periodEndMs = progressPeriod.end.getTime();

  const hasActivity = (task: Task): boolean => {
    const hasTimeslot = timeslots.some(ts =>
      ts.taskId === task.id &&
      ts.startTime < periodEndMs &&
      (ts.endTime ?? Date.now()) > periodStartMs
    );
    if (hasTimeslot) return true;
    return task.outputs.some(o =>
      o.effectiveDate && o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr
    );
  };

  const filtered = progressTasks.filter(
    t => !t.archived && t.showInReport !== false && !excludedMainCats.includes(t.mainCategory || '其他')
  );

  const withProgress: Task[] = [];
  const withoutProgress: Task[] = [];

  filtered.forEach(task => {
    if (task.status === 'PAUSED') { withoutProgress.push(task); return; }
    if (task.status === 'DONE') { withProgress.push(task); return; }
    if (task.trackCompleteness === false) {
      (hasActivity(task) ? withProgress : withoutProgress).push(task);
      return;
    }
    const prevSnap = getSnapshotAtOrBefore(task.weeklySnapshots, prevEndStr);
    const currSnap = getSnapshotInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
    const curr = currSnap ?? task.completeness;
    const delta = prevSnap !== undefined && curr !== undefined ? curr - prevSnap : undefined;
    ((delta !== undefined && delta !== 0) || hasActivity(task) ? withProgress : withoutProgress).push(task);
  });

  return { withProgress, withoutProgress, prevEndStr, currStartStr, currEndStr };
}

// ── AsciiDoc helpers ──────────────────────────────────────────────────────────

export const adocStatusLabels: Record<TaskStatus, string> = {
  BACKLOG: '待規劃', TODO: '待執行', IN_PROGRESS: '進行中',
  PAUSED: '暫停', DONE: '完成', CANCELLED: '取消',
};

export function adocColor(text: string, color: 'red' | 'green' | 'blue'): string {
  return `[${color}]#${text}#`;
}

export function getStatusColor(status: TaskStatus): 'red' | 'green' | 'blue' | null {
  if (status === 'PAUSED') return 'red';
  if (status === 'DONE') return 'green';
  if (status === 'IN_PROGRESS') return 'blue';
  return null;
}

export function fmtStatusCell(status: TaskStatus): string {
  const color = getStatusColor(status);
  const label = adocStatusLabels[status];
  return color ? adocColor(label, color) : label;
}

export function fmtSpiCell(spiData: { planned: number; spi: number } | null): string {
  if (!spiData) return '—';
  const line1 = `SPI ${spiData.spi.toFixed(2)} ${spiData.spi >= 1.0 ? '正常/超前' : spiData.spi >= 0.8 ? '落後' : '嚴重落後'}`;
  const line2 = `計畫進度 ${spiData.planned}%`;
  if (spiData.spi < 1.0) {
    return `${adocColor(line1, 'red')} +\n${adocColor(line2, 'red')}`;
  }
  return `${line1} +\n${line2}`;
}

export function fmtTitleCell(title: string, mainCategory: string | undefined, status: TaskStatus): string {
  const line1 = `*${title}*`;
  const line2 = mainCategory ? `（${mainCategory}）` : null;
  const color = getStatusColor(status);
  if (color === 'red') {
    return line2 ? `${adocColor(line1, 'red')} +\n${adocColor(line2, 'red')}` : adocColor(line1, 'red');
  }
  return line2 ? `${line1} +\n${line2}` : line1;
}

export function fmtDelta(delta: number | undefined): string {
  if (delta === undefined) return '—';
  if (delta > 0) return `↑ +${delta}%`;
  if (delta < 0) return `↓ ${delta}%`;
  return '→ 持平';
}

export function fmtVal(
  value: number | undefined,
  isFallback: boolean,
  completenessType?: 'real' | 'confidence',
): string {
  if (value === undefined) return '—';
  const typeTag = completenessType === 'real' ? ' [真]' : ' [信]';
  return `${value}%${isFallback ? ' (目前)' : ''}${typeTag}`;
}

export function getWbsColor(status: TaskStatus): string | null {
  if (status === 'DONE') return '#lightgreen';
  if (status === 'CANCELLED') return '#yellow';
  if (status === 'PAUSED') return '#pink';
  if (status === 'BACKLOG' || status === 'TODO') return '#lightblue';
  return null;
}
