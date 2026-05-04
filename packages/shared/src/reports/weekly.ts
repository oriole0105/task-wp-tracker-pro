import { format, startOfDay, endOfDay, addMonths, subDays } from 'date-fns';
import type { Task, Timeslot, OutputType, TaskStatus } from '../types/index.js';
import {
  type ReportType, type GanttMode, type Period, type PeriodLabels, type ProgressSplit,
  computeGanttPeriod, computeProgressPeriod, computePrevPeriod, computePeriodLabels,
  computeActiveTasks, computeProgressTasks, computeProgressSplit,
  getSnapshotAtOrBefore, getSnapshotInPeriod, getSnapshotNoteInPeriod,
  calcSPI, getTaskDepth,
  fmtDelta, fmtVal, fmtStatusCell, fmtSpiCell, fmtTitleCell, adocStatusLabels,
} from './common.js';
import { buildWbsSource, buildGanttSource } from './plantuml.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportOpts {
  tasks: Task[];
  timeslots: Timeslot[];
  outputTypes: OutputType[];
  holidays: string[];
  reportType: ReportType;
  anchorDate?: Date;
  selectedLevels?: number[];
  excludedMainCats?: string[];
  showTodayMark?: boolean;
  groupByCategory?: boolean;
  ganttMode?: GanttMode;
  ganttScale?: 'daily' | 'weekly' | 'monthly';
  ganttZoom?: number;
}

export interface ReportContext {
  ganttPeriod: Period;
  progressPeriod: Period;
  prevPeriod: Period;
  periodLabels: PeriodLabels;
  ganttRange: Period;
  activeTasks: Task[];
  progressTasks: Task[];
  ganttActiveTasks: Task[];
  progressSplit: ProgressSplit;
}

// ── Context builder ───────────────────────────────────────────────────────────

export function buildReportContext(opts: ReportOpts): ReportContext {
  const {
    tasks, timeslots, reportType,
    anchorDate = new Date(),
    selectedLevels = [1, 2, 3, 4, 5],
    excludedMainCats = [],
    ganttMode = 'weekly',
  } = opts;

  const ganttPeriod = computeGanttPeriod(reportType, anchorDate);
  const progressPeriod = computeProgressPeriod(reportType, anchorDate, ganttPeriod);
  const prevPeriod = computePrevPeriod(reportType, progressPeriod);
  const periodLabels = computePeriodLabels(reportType, progressPeriod, prevPeriod);

  // ganttRange: for weekly reports there's a wider view mode
  let ganttRange: Period;
  if (reportType !== 'weekly') {
    ganttRange = ganttPeriod;
  } else if (ganttMode === 'weekly') {
    const today = new Date();
    ganttRange = { start: subDays(startOfDay(today), 30), end: endOfDay(addMonths(today, 1)) };
  } else {
    // workReview mode
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const oddMonths = [1, 3, 5, 7, 9, 11];
    const pastOdd = oddMonths.filter(m => m <= month);
    const anchorMonth = pastOdd.length > 0 ? Math.max(...pastOdd) : 11;
    const anchorYear = pastOdd.length > 0 ? year : year - 1;
    const anchor = new Date(anchorYear, anchorMonth - 1, 1);
    ganttRange = {
      start: startOfDay(new Date(anchor.getTime() - 15 * 86400000)),
      end: endOfDay(addMonths(anchor, 2)),
    };
  }

  const activeTasks = computeActiveTasks(tasks, timeslots, ganttPeriod, selectedLevels);
  const progressTasks = computeProgressTasks(tasks, timeslots, progressPeriod, selectedLevels);

  const ganttStartTs = ganttRange.start.getTime();
  const ganttEndTs = ganttRange.end.getTime();
  const ganttActiveTasks = tasks.filter(task => {
    if (task.ganttDisplayMode === 'hidden') return false;
    if (!selectedLevels.includes(getTaskDepth(task, tasks))) return false;
    if (task.ganttDisplayMode === 'section') return true;
    const hasEstimated = task.estimatedStartDate && task.estimatedStartDate <= ganttEndTs &&
      (!task.estimatedEndDate || task.estimatedEndDate >= ganttStartTs);
    const hasActual = timeslots.some(ts => {
      if (ts.taskId !== task.id) return false;
      const logEnd = ts.endTime || Date.now();
      return ts.startTime <= ganttEndTs && logEnd >= ganttStartTs;
    });
    return hasEstimated || hasActual;
  });

  const progressSplit = computeProgressSplit(progressTasks, timeslots, prevPeriod, progressPeriod, excludedMainCats);

  return {
    ganttPeriod, progressPeriod, prevPeriod, periodLabels,
    ganttRange, activeTasks, progressTasks, ganttActiveTasks, progressSplit,
  };
}

// ── Section builders ──────────────────────────────────────────────────────────

export function buildProgressWithAdoc(
  split: ProgressSplit,
  periodLabels: PeriodLabels,
  outputTypes: OutputType[],
): string {
  const { withProgress, prevEndStr, currStartStr, currEndStr } = split;
  const lines: string[] = [];
  lines.push('== 進度追蹤（有進展）');
  lines.push('');
  lines.push(`_${periodLabels.rangeDisplay}_`);
  lines.push('');
  lines.push('[cols="13,5,4,4,5,8,5,12",options="header"]');
  lines.push('|===');
  lines.push(`|任務 / 工作產出 |預期完成日 |${periodLabels.prevShort.replace('%', '')}% |${periodLabels.currShort.replace('%', '')}% |${periodLabels.deltaLabel} |時程績效 SPI |狀態 |說明`);
  lines.push('');

  withProgress.forEach(task => {
    const noTrack = task.trackCompleteness === false;
    const prevTask = noTrack ? undefined : getSnapshotAtOrBefore(task.weeklySnapshots, prevEndStr);
    const thisTaskSnap = noTrack ? undefined : getSnapshotInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
    const thisTask = noTrack ? undefined : (thisTaskSnap ?? task.completeness);
    const taskDelta = prevTask !== undefined && thisTask !== undefined ? thisTask - prevTask : undefined;
    const spiData = noTrack ? null : calcSPI(task);
    const endDateCell = task.estimatedEndDate ? format(task.estimatedEndDate, 'yyyy-MM-dd') : '—';
    const weeklyNote = getSnapshotNoteInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
    const noteCell = weeklyNote ? weeklyNote.replace(/\n/g, ' +\n') : '—';

    lines.push(`|${fmtTitleCell(task.title, task.mainCategory, task.status)}`);
    lines.push(`|${endDateCell}`);
    lines.push(`|${noTrack ? '—' : prevTask !== undefined ? `${prevTask}%` : '—'}`);
    lines.push(`|${noTrack ? '—' : fmtVal(thisTask, thisTaskSnap === undefined && thisTask !== undefined, task.completenessType)}`);
    lines.push(`|${noTrack ? '—' : fmtDelta(taskDelta)}`);
    lines.push(`|${fmtSpiCell(spiData)}`);
    lines.push(`|${fmtStatusCell(task.status)}`);
    lines.push(`|${noteCell}`);
    lines.push('');

    task.outputs.filter(o =>
      !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr)
    ).forEach(output => {
      const prevOut = getSnapshotAtOrBefore(output.weeklySnapshots, prevEndStr);
      const thisOutSnap = getSnapshotInPeriod(output.weeklySnapshots, currStartStr, currEndStr);
      const thisOut = thisOutSnap ?? (output.completeness ? parseInt(output.completeness) : undefined);
      const outDelta = prevOut !== undefined && thisOut !== undefined ? thisOut - prevOut : undefined;
      const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
      const label = otMeta ? `${output.name} [${otMeta.name}]` : output.name;
      lines.push(`|  ↳ ${label}`);
      lines.push('|');
      lines.push(`|${prevOut !== undefined ? `${prevOut}%` : '—'}`);
      lines.push(`|${fmtVal(thisOut, thisOutSnap === undefined && thisOut !== undefined)}`);
      lines.push(`|${fmtDelta(outDelta)}`);
      lines.push('|');
      lines.push('|');
      lines.push('|');
      lines.push('');
    });
  });

  lines.push('|===');
  return lines.join('\n');
}

export function buildProgressWithoutAdoc(
  split: ProgressSplit,
  periodLabels: PeriodLabels,
  outputTypes: OutputType[],
): string {
  const { withoutProgress, prevEndStr, currStartStr, currEndStr } = split;
  if (withoutProgress.length === 0) return '';

  const lines: string[] = [];
  lines.push('== 本期無進展任務');
  lines.push('');
  lines.push('_包含：暫停中任務、本期完成度與前期相同（無變動）的任務_');
  lines.push('');
  lines.push('[cols="15,6,4,4,8,6,15",options="header"]');
  lines.push('|===');
  lines.push(`|任務 / 工作產出 |預期完成日 |${periodLabels.prevShort.replace('%', '')}% |${periodLabels.currShort.replace('%', '')}% |時程績效 SPI |狀態 |原因 / 說明`);
  lines.push('');

  withoutProgress.forEach(task => {
    const noTrack = task.trackCompleteness === false;
    const prevTask = noTrack ? undefined : getSnapshotAtOrBefore(task.weeklySnapshots, prevEndStr);
    const thisTaskSnap = noTrack ? undefined : getSnapshotInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
    const thisTask = noTrack ? undefined : (thisTaskSnap ?? task.completeness);
    const spiData = noTrack ? null : calcSPI(task);
    const endDateCell = task.estimatedEndDate ? format(task.estimatedEndDate, 'yyyy-MM-dd') : '—';
    const weeklyNote = getSnapshotNoteInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
    const pauseText = task.status === 'PAUSED' && task.pauseReason
      ? task.pauseReason.replace(/\n/g, ' +\n') : '';
    const noteText = weeklyNote ? weeklyNote.replace(/\n/g, ' +\n') : '';
    const reasonCell = pauseText && noteText
      ? `${pauseText} +\n${noteText}` : pauseText || noteText || '—';

    lines.push(`|${fmtTitleCell(task.title, task.mainCategory, task.status)}`);
    lines.push(`|${endDateCell}`);
    lines.push(`|${noTrack ? '—' : prevTask !== undefined ? `${prevTask}%` : '—'}`);
    lines.push(`|${noTrack ? '—' : fmtVal(thisTask, thisTaskSnap === undefined && thisTask !== undefined, task.completenessType)}`);
    lines.push(`|${fmtSpiCell(spiData)}`);
    lines.push(`|${fmtStatusCell(task.status)}`);
    lines.push(`|${reasonCell}`);
    lines.push('');

    task.outputs.filter(o =>
      !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr)
    ).forEach(output => {
      const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
      const label = otMeta ? `${output.name} [${otMeta.name}]` : output.name;
      lines.push(`|  ↳ ${label}`);
      lines.push('|'); lines.push('|'); lines.push('|'); lines.push('|'); lines.push('|'); lines.push('|');
      lines.push('');
    });
  });

  lines.push('|===');
  return lines.join('\n');
}

export interface PeriodSummary {
  statusCount: Record<TaskStatus, number>;
  filteredTotal: number;
  hourEntries: [string, number][];
  totalMs: number;
  completedOutputs: { taskTitle: string; taskMainCategory: string | undefined; outputName: string; outputLink: string | undefined; outputTypeId: string | undefined; outputTypeName: string | undefined; completeness: string | undefined; effectiveDate: string | undefined }[];
}

export function computePeriodSummary(
  progressTasks: Task[],
  tasks: Task[],
  timeslots: Timeslot[],
  outputTypes: OutputType[],
  progressPeriod: Period,
  excludedMainCats: string[],
): PeriodSummary {
  const startTs = progressPeriod.start.getTime();
  const endTs = progressPeriod.end.getTime();
  const currStartStr = format(progressPeriod.start, 'yyyy-MM-dd');
  const currEndStr = format(progressPeriod.end, 'yyyy-MM-dd');

  const filteredTasks = progressTasks.filter(
    t => !t.archived && t.showInReport !== false && !excludedMainCats.includes(t.mainCategory || '其他')
  );

  const statusCount: Record<TaskStatus, number> = {
    DONE: 0, CANCELLED: 0, IN_PROGRESS: 0, PAUSED: 0, TODO: 0, BACKLOG: 0,
  };
  filteredTasks.forEach(t => { statusCount[t.status]++; });

  const hoursByCategory = new Map<string, number>();
  let totalMs = 0;
  timeslots.forEach(ts => {
    if (!ts.endTime) return;
    const effectiveStart = Math.max(ts.startTime, startTs);
    const effectiveEnd = Math.min(ts.endTime, endTs);
    if (effectiveStart >= effectiveEnd) return;
    const duration = effectiveEnd - effectiveStart;
    const task = ts.taskId ? tasks.find(t => t.id === ts.taskId) : undefined;
    const cat = task?.mainCategory || '未分類';
    hoursByCategory.set(cat, (hoursByCategory.get(cat) || 0) + duration);
    totalMs += duration;
  });
  const hourEntries = Array.from(hoursByCategory.entries()).sort((a, b) => b[1] - a[1]);

  const completedOutputs: PeriodSummary['completedOutputs'] = [];
  tasks.filter(t => !t.archived && !excludedMainCats.includes(t.mainCategory || '其他')).forEach(task => {
    task.outputs.forEach(output => {
      if (output.effectiveDate && output.effectiveDate >= currStartStr && output.effectiveDate <= currEndStr) {
        const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
        completedOutputs.push({
          taskTitle: task.title,
          taskMainCategory: task.mainCategory,
          outputName: output.name,
          outputLink: output.link || undefined,
          outputTypeId: output.outputTypeId,
          outputTypeName: otMeta?.name,
          completeness: output.completeness || undefined,
          effectiveDate: output.effectiveDate,
        });
      }
    });
  });
  completedOutputs.sort((a, b) => (a.effectiveDate ?? '').localeCompare(b.effectiveDate ?? ''));

  return { statusCount, filteredTotal: filteredTasks.length, hourEntries, totalMs, completedOutputs };
}

export function buildPeriodSummaryAdoc(
  summary: PeriodSummary,
  progressPeriod: Period,
): string {
  const fmtMs = (ms: number) => `${(ms / 3600000).toFixed(1)}h`;

  const lines: string[] = [];
  lines.push('== 期間工作成果彙總');
  lines.push('');
  lines.push(`_工作成果區間：${format(progressPeriod.start, 'yyyy-MM-dd')} ～ ${format(progressPeriod.end, 'yyyy-MM-dd')}_`);
  lines.push('');

  lines.push('=== 任務狀態統計');
  lines.push('');
  const statParts: string[] = [];
  (['DONE', 'IN_PROGRESS', 'PAUSED', 'CANCELLED', 'TODO', 'BACKLOG'] as TaskStatus[])
    .filter(s => summary.statusCount[s] > 0)
    .forEach(s => statParts.push(`${adocStatusLabels[s]}：${summary.statusCount[s]}`));
  statParts.push(`合計：${summary.filteredTotal}`);
  lines.push(statParts.join('、'));
  lines.push('');

  lines.push('=== 期間實際工時彙總');
  lines.push('');
  if (summary.hourEntries.length === 0) {
    lines.push('此期間無工時紀錄');
  } else {
    lines.push('[cols="2,1,1",options="header"]');
    lines.push('|===');
    lines.push('|主分類 |工時 |佔比');
    lines.push('');
    summary.hourEntries.forEach(([cat, ms]) => {
      lines.push(`|${cat}`);
      lines.push(`|${fmtMs(ms)}`);
      lines.push(`|${((ms / summary.totalMs) * 100).toFixed(0)}%`);
      lines.push('');
    });
    lines.push('|*合計*');
    lines.push(`|*${fmtMs(summary.totalMs)}*`);
    lines.push('|100%');
    lines.push('');
    lines.push('|===');
  }
  lines.push('');

  lines.push('=== 工作產出清單');
  lines.push('');
  if (summary.completedOutputs.length === 0) {
    lines.push('此期間無標記 effectiveDate 的工作產出');
  } else {
    lines.push('[cols="2,2,1,1,1",options="header"]');
    lines.push('|===');
    lines.push('|任務 |工作產出 |類型 |完成度 |對應日期');
    lines.push('');
    summary.completedOutputs.forEach(item => {
      const taskCell = item.taskMainCategory
        ? `${item.taskTitle} +\n（${item.taskMainCategory}）`
        : item.taskTitle;
      const outputCell = item.outputLink ? `${item.outputName} +\n${item.outputLink}` : item.outputName;
      lines.push(`|${taskCell}`);
      lines.push(`|${outputCell}`);
      lines.push(`|${item.outputTypeName ?? '—'}`);
      lines.push(`|${item.completeness ? `${item.completeness}%` : '—'}`);
      lines.push(`|${item.effectiveDate ?? '—'}`);
      lines.push('');
    });
    lines.push('|===');
  }

  return lines.join('\n');
}

// ── Full report ───────────────────────────────────────────────────────────────

export function buildFullReportAdoc(opts: ReportOpts): string {
  const {
    tasks, timeslots, outputTypes, holidays, reportType,
    anchorDate = new Date(),
    selectedLevels = [1, 2, 3, 4, 5],
    excludedMainCats = [],
    showTodayMark = true,
    groupByCategory = false,
    ganttMode = 'weekly',
    ganttScale = reportType === 'semiannual' ? 'weekly' : 'daily',
    ganttZoom = reportType === 'semiannual' ? 2 : 1,
  } = opts;

  const ctx = buildReportContext({
    ...opts,
    anchorDate,
    selectedLevels,
    excludedMainCats,
    ganttMode,
  });

  const reportTypeName = reportType === 'weekly' ? '工作週報' : reportType === 'bimonthly' ? '雙月盤點報告' : '半年報';
  const dateStr = format(anchorDate, 'yyyy-MM-dd');

  const wbs = buildWbsSource({ tasks, activeTasks: ctx.activeTasks, excludedMainCats });
  const gantt = buildGanttSource({
    tasks, timeslots, ganttActiveTasks: ctx.ganttActiveTasks,
    ganttRange: ctx.ganttRange, holidays, showTodayMark, groupByCategory,
    ganttScale, ganttZoom, selectedLevels,
  });

  const withAdoc = buildProgressWithAdoc(ctx.progressSplit, ctx.periodLabels, outputTypes);
  const withoutAdoc = buildProgressWithoutAdoc(ctx.progressSplit, ctx.periodLabels, outputTypes);

  let periodSummaryAdoc = '';
  if (reportType !== 'weekly') {
    const summary = computePeriodSummary(
      ctx.progressTasks, tasks, timeslots, outputTypes, ctx.progressPeriod, excludedMainCats
    );
    periodSummaryAdoc = buildPeriodSummaryAdoc(summary, ctx.progressPeriod);
  }

  const parts: string[] = [
    `= ${reportTypeName} | ${dateStr}`,
    '',
    '== WBS',
    '',
    '[plantuml]',
    '----',
    wbs,
    '----',
    '',
    '== 甘特圖',
    '',
    '[plantuml]',
    '----',
    gantt,
    '----',
    '',
    withAdoc,
    '',
  ];
  if (withoutAdoc) parts.push(withoutAdoc, '');
  if (periodSummaryAdoc) parts.push(periodSummaryAdoc, '');

  return parts.join('\n');
}
