import { useState, useMemo } from 'react';
import { format, isValid, addMonths, subMonths, startOfDay, endOfDay, subDays } from 'date-fns';
import plantumlEncoder from 'plantuml-encoder';
import type { Task, Timeslot, OutputType, TaskStatus, WorkOutput } from '@tt/shared/types';
import {
  getSnapshotAtOrBefore, getSnapshotInPeriod, getSnapshotNoteInPeriod,
  calcSPI, getTaskDepth,
  fmtStatusCell, fmtSpiCell, fmtTitleCell,
  getWbsColor, fmtDelta, fmtVal,
} from '@tt/shared/reports/common';
import type { ReportType, Period, PeriodLabels, ProgressSplit } from '@tt/shared/reports/common';
import { getTaskActualStart, getTaskActualEnd } from '@tt/shared/utils/taskDateUtils';
import type { PeriodSummary } from './report.types';

export type GanttMode = 'weekly' | 'workReview';
export type GanttScale = 'daily' | 'weekly' | 'monthly';

interface UseReportSourcesInput {
  reportType: ReportType;
  reportAnchorDate: Date;
  ganttPeriod: Period;
  progressPeriod: Period;
  prevPeriod: Period;
  periodLabels: PeriodLabels;
  activeTasks: Task[];
  progressTasks: Task[];
  progressSplit: ProgressSplit;
  excludedMainCats: string[];
  selectedLevels: number[];
  tasks: Task[];
  timeslots: Timeslot[];
  holidays: string[];
  outputTypes: OutputType[];
}

export function useReportSources(input: UseReportSourcesInput) {
  const {
    reportType, reportAnchorDate, ganttPeriod, progressPeriod, prevPeriod, periodLabels,
    activeTasks, progressTasks, progressSplit, excludedMainCats, selectedLevels,
    tasks, timeslots, holidays, outputTypes,
  } = input;

  const [ganttMode, setGanttMode] = useState<GanttMode>('weekly');
  const [ganttScale, setGanttScale] = useState<GanttScale>('daily');
  const [ganttZoom, setGanttZoom] = useState(1);
  const [showTodayMark, setShowTodayMark] = useState(true);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [showPlantUmlSource, setShowPlantUmlSource] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  // ── Gantt range ──────────────────────────────────────────────────────────────

  const ganttRange = useMemo((): Period => {
    if (reportType !== 'weekly') return ganttPeriod;
    const today = new Date();
    if (ganttMode === 'weekly') {
      return {
        start: subMonths(startOfDay(today), 1),
        end: addMonths(endOfDay(today), 1),
      };
    }
    // 工作盤點模式：以 1/3/5/7/9/11 月 1 日為基準
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const oddMonths = [1, 3, 5, 7, 9, 11];
    const pastOdd = oddMonths.filter(m => m <= month);
    const anchorMonth = pastOdd.length > 0 ? Math.max(...pastOdd) : 11;
    const anchorYear = pastOdd.length > 0 ? year : year - 1;
    const anchor = new Date(anchorYear, anchorMonth - 1, 1);
    return {
      start: startOfDay(subDays(anchor, 15)),
      end: endOfDay(addMonths(anchor, 2)),
    };
  }, [reportType, ganttPeriod, ganttMode]);

  const ganttActiveTasks = useMemo(() => {
    const startTs = ganttRange.start.getTime();
    const endTs = ganttRange.end.getTime();
    return tasks.filter(task => {
      if (task.ganttDisplayMode === 'hidden') return false;
      const depth = getTaskDepth(task, tasks);
      if (!selectedLevels.includes(depth)) return false;
      const hasEstimatedInRange = task.estimatedStartDate && task.estimatedStartDate <= endTs &&
        (!task.estimatedEndDate || task.estimatedEndDate >= startTs);
      const hasActualInRange = timeslots.some(ts => {
        if (ts.taskId !== task.id) return false;
        const logEnd = ts.endTime || Date.now();
        return ts.startTime <= endTs && logEnd >= startTs;
      });
      if (task.ganttDisplayMode === 'section') return true;
      return hasEstimatedInRange || hasActualInRange;
    });
  }, [tasks, timeslots, ganttRange, selectedLevels]);

  // ── WBS ──────────────────────────────────────────────────────────────────────

  const wbsSource = useMemo(() => {
    const filteredTasks = activeTasks.filter(t =>
      t.showInWbs !== false && !excludedMainCats.includes(t.mainCategory || '其他')
    );
    let source = '@startwbs\n* 專案工作任務\n';
    const mainCats = Array.from(new Set(filteredTasks.map(t => t.mainCategory || '其他')));
    mainCats.forEach(mainCat => {
      source += `** ${mainCat}\n`;
      const catTasks = filteredTasks.filter(t => (t.mainCategory || '其他') === mainCat);
      const renderTaskNode = (parentId: string | undefined, level: number) => {
        catTasks.filter(t => t.parentId === parentId).forEach(child => {
          const stars = '*'.repeat(level);
          const color = getWbsColor(child.status);
          source += `${stars}${color ? `[${color}]` : ''} ${child.title}\n`;
          renderTaskNode(child.id, level + 1);
        });
      };
      const rootCatTasks = catTasks.filter(t => !t.parentId || !catTasks.find(p => p.id === t.parentId));
      rootCatTasks.forEach(task => {
        const color = getWbsColor(task.status);
        source += `***${color ? `[${color}]` : ''} ${task.title}\n`;
        renderTaskNode(task.id, 4);
      });
    });
    source += '@endwbs';
    return source;
  }, [activeTasks, excludedMainCats]);

  // ── Gantt ─────────────────────────────────────────────────────────────────────

  const ganttSource = useMemo(() => {
    let source = '@startgantt\n';
    source += `printscale ${ganttScale} zoom ${ganttZoom}\n`;
    source += `Project starts ${format(ganttRange.start, 'yyyy-MM-dd')}\n`;
    if (showTodayMark) source += `${format(new Date(), 'yyyy-MM-dd')} is colored in Orange\n`;
    source += `saturday are colored in lightblue\nsunday are colored in lightblue\n`;
    const ganttRangeStartStr = format(ganttRange.start, 'yyyy-MM-dd');
    const ganttRangeEndStr = format(ganttRange.end, 'yyyy-MM-dd');
    holidays
      .filter(d => d >= ganttRangeStartStr && d <= ganttRangeEndStr)
      .forEach(d => { source += `${d} is colored in lightblue\n`; });
    source += '\n';

    const computeTaskSpan = (t: Task): { selfStart?: number; selfEnd?: number; isDoneOrCancelled: boolean } => {
      const actualStart = getTaskActualStart(t.id, tasks, timeslots);
      const isDoneOrCancelled = t.status === 'DONE' || t.status === 'CANCELLED';
      const actualEnd = isDoneOrCancelled ? getTaskActualEnd(t.id, tasks, timeslots) : undefined;
      let selfStart: number | undefined;
      let selfEnd: number | undefined;
      if (t.status === 'BACKLOG' || t.status === 'TODO') {
        selfStart = t.estimatedStartDate; selfEnd = t.estimatedEndDate;
      } else if (t.status === 'IN_PROGRESS' || t.status === 'PAUSED') {
        selfStart = actualStart ?? t.estimatedStartDate;
        selfEnd = t.estimatedEndDate || Date.now() + 86400000;
      } else if (isDoneOrCancelled) {
        selfStart = actualStart ?? t.estimatedStartDate;
        selfEnd = actualEnd ?? t.estimatedEndDate ?? Date.now();
      }
      return { selfStart, selfEnd, isDoneOrCancelled };
    };

    const getDescendantBarSpan = (taskId: string): { minStart?: number; maxEnd?: number } => {
      const barChildren = ganttActiveTasks.filter(t =>
        t.parentId === taskId && t.ganttDisplayMode !== 'section' && t.ganttDisplayMode !== 'hidden'
      );
      if (barChildren.length === 0) return {};
      let minStart: number | undefined;
      let maxEnd: number | undefined;
      barChildren.forEach(child => {
        const { selfStart, selfEnd } = computeTaskSpan(child);
        if (selfStart !== undefined) minStart = minStart === undefined ? selfStart : Math.min(minStart, selfStart);
        if (selfEnd !== undefined) maxEnd = maxEnd === undefined ? selfEnd : Math.max(maxEnd, selfEnd);
        const { minStart: descMin, maxEnd: descMax } = getDescendantBarSpan(child.id);
        if (descMin !== undefined) minStart = minStart === undefined ? descMin : Math.min(minStart, descMin);
        if (descMax !== undefined) maxEnd = maxEnd === undefined ? descMax : Math.max(maxEnd, descMax);
      });
      return { minStart, maxEnd };
    };

    const renderTaskMilestones = (task: Task) => {
      (task.milestones ?? [])
        .filter(m => m.showInGantt && m.title.trim() !== '' && m.date >= ganttRangeStartStr && m.date <= ganttRangeEndStr)
        .forEach(m => {
          const cleanTitle = m.title.replace(/[[\]]/g, '');
          source += `[${cleanTitle}] happens ${m.date}\n`;
          if (m.color) source += `[${cleanTitle}] is colored in ${m.color}\n`;
        });
    };

    const renderTask = (task: Task) => {
      if (task.ganttDisplayMode === 'section') {
        if (groupByCategory) return;
        const cleanTitle = task.title.replace(/[[\]]/g, '');
        source += `-- ${cleanTitle} --\n`;
        renderTaskMilestones(task);
        return;
      }
      const { selfStart, selfEnd, isDoneOrCancelled } = computeTaskSpan(task);
      const { minStart: childMin, maxEnd: childMax } = getDescendantBarSpan(task.id);
      const finalStart = childMin !== undefined ? childMin : selfStart;
      const finalEnd = childMax !== undefined ? childMax : selfEnd;
      if (finalStart && finalEnd && isValid(finalStart) && isValid(finalEnd)) {
        const startStr = format(finalStart, 'yyyy-MM-dd');
        const endStr = format(finalEnd, 'yyyy-MM-dd');
        const cleanTitle = task.title.replace(/[[\]]/g, '');
        const completenessVal = task.completeness !== undefined ? task.completeness : (isDoneOrCancelled ? 100 : 0);
        source += `[${cleanTitle}] starts ${startStr} and ends ${endStr}\n`;
        source += `[${cleanTitle}] is ${completenessVal}% completed\n`;
        if (isDoneOrCancelled) {
          source += `[${cleanTitle}] is colored in ${task.status === 'CANCELLED' ? 'Silver' : 'lightgreen'}\n`;
        } else if (task.status === 'IN_PROGRESS') {
          source += `[${cleanTitle}] is colored in deepskyblue\n`;
        } else if (task.status === 'PAUSED') {
          source += `[${cleanTitle}] is colored in Orange\n`;
        }
      }
      renderTaskMilestones(task);
    };

    const ganttActiveIds = new Set(ganttActiveTasks.map(t => t.id));
    const ganttChildrenMap = new Map<string | undefined, Task[]>();
    for (const task of ganttActiveTasks) {
      const parentKey = task.parentId && ganttActiveIds.has(task.parentId) ? task.parentId : undefined;
      const list = ganttChildrenMap.get(parentKey) ?? [];
      list.push(task);
      ganttChildrenMap.set(parentKey, list);
    }
    const renderSubtree = (parentId: string | undefined, taskList?: Task[]) => {
      (taskList ?? ganttChildrenMap.get(parentId) ?? []).forEach(task => {
        renderTask(task);
        renderSubtree(task.id);
      });
    };

    if (groupByCategory) {
      const mainCats = Array.from(new Set(ganttActiveTasks.map(t => t.mainCategory || '其他')));
      mainCats.forEach(mainCat => {
        const catRoots = (ganttChildrenMap.get(undefined) ?? []).filter(t => (t.mainCategory || '其他') === mainCat);
        if (catRoots.length === 0) return;
        source += `-- ${mainCat} --\n`;
        renderSubtree(undefined, catRoots);
        source += `\n`;
      });
    } else {
      renderSubtree(undefined);
      source += `\n`;
    }

    // 孤立 milestone（任務本身不在 ganttActiveTasks，但有 milestone 在範圍內）
    const ganttActiveTaskIds = new Set(ganttActiveTasks.map(t => t.id));
    const orphanMilestones = tasks
      .filter(task =>
        !ganttActiveTaskIds.has(task.id) &&
        task.ganttDisplayMode !== 'hidden' &&
        selectedLevels.includes(getTaskDepth(task, tasks))
      )
      .flatMap(task =>
        (task.milestones ?? []).filter(m =>
          m.showInGantt && m.title.trim() !== '' &&
          m.date >= ganttRangeStartStr && m.date <= ganttRangeEndStr
        )
      );
    if (orphanMilestones.length > 0) {
      source += '\n';
      orphanMilestones.forEach(m => {
        const cleanTitle = m.title.replace(/[[\]]/g, '');
        source += `[${cleanTitle}] happens ${m.date}\n`;
        if (m.color) source += `[${cleanTitle}] is colored in ${m.color}\n`;
      });
    }

    source += '@endgantt';
    return source;
  }, [ganttActiveTasks, tasks, selectedLevels, timeslots, ganttRange, showTodayMark, holidays, ganttScale, ganttZoom, groupByCategory]);

  // ── PlantUML URL ─────────────────────────────────────────────────────────────

  const getPlantUMLUrl = (source: string) => {
    try { return `https://www.plantuml.com/plantuml/svg/${plantumlEncoder.encode(source)}`; } catch { return ''; }
  };

  // ── AsciiDoc: 合併版進度表（複製按鈕用）─────────────────────────────────────

  const progressAsciiDoc = useMemo(() => {
    const prevEndStr = format(prevPeriod.end, 'yyyy-MM-dd');
    const currStartStr = format(progressPeriod.start, 'yyyy-MM-dd');
    const currEndStr = format(progressPeriod.end, 'yyyy-MM-dd');
    const lines: string[] = [];
    lines.push(`=== 進度追蹤（${periodLabels.rangeDisplay}）`);
    lines.push('');
    lines.push('[cols="13,5,4,4,5,8,5,12",options="header"]');
    lines.push('|===');
    lines.push(`|任務 / 工作產出 |預期完成日 |${periodLabels.prevShort.replace('%', '')}% |${periodLabels.currShort.replace('%', '')}% |${periodLabels.deltaLabel} |時程績效 SPI |狀態 |說明`);
    lines.push('');
    progressTasks
      .filter(t => !t.archived && t.showInReport !== false && !excludedMainCats.includes(t.mainCategory || '其他'))
      .forEach(task => {
        const prevTask = getSnapshotAtOrBefore(task.weeklySnapshots, prevEndStr);
        const thisTaskSnap = getSnapshotInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
        const thisTask = thisTaskSnap ?? task.completeness;
        const taskDelta = prevTask !== undefined && thisTask !== undefined ? thisTask - prevTask : undefined;
        const spiData = calcSPI(task);
        const endDateCell = task.estimatedEndDate ? format(task.estimatedEndDate, 'yyyy-MM-dd') : '—';
        const weeklyNote = getSnapshotNoteInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
        const noteCell = weeklyNote ? weeklyNote.replace(/\n/g, ' +\n') : '—';
        lines.push(`|${fmtTitleCell(task.title, task.mainCategory, task.status)}`);
        lines.push(`|${endDateCell}`);
        lines.push(`|${prevTask !== undefined ? `${prevTask}%` : '—'}`);
        lines.push(`|${fmtVal(thisTask, thisTaskSnap === undefined && thisTask !== undefined, task.completenessType)}`);
        lines.push(`|${fmtDelta(taskDelta)}`);
        lines.push(`|${fmtSpiCell(spiData)}`);
        lines.push(`|${fmtStatusCell(task.status)}`);
        lines.push(`|${noteCell}`);
        lines.push('');
        task.outputs
          .filter(o => !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr))
          .forEach(output => {
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
            lines.push('|'); lines.push('|'); lines.push('|');
            lines.push('');
          });
      });
    lines.push('|===');
    return lines.join('\n');
  }, [progressTasks, excludedMainCats, periodLabels, prevPeriod, progressPeriod, outputTypes]);

  // ── AsciiDoc: 分拆版（匯出用）───────────────────────────────────────────────

  const progressWithAsciiDoc = useMemo(() => {
    const { withProgress, prevEndStr, currStartStr, currEndStr } = progressSplit;
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
      task.outputs
        .filter(o => !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr))
        .forEach(output => {
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
          lines.push('|'); lines.push('|'); lines.push('|');
          lines.push('');
        });
    });
    lines.push('|===');
    return lines.join('\n');
  }, [progressSplit, periodLabels, outputTypes]);

  const progressWithoutAsciiDoc = useMemo(() => {
    const { withoutProgress, prevEndStr, currStartStr, currEndStr } = progressSplit;
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
      const pauseText = task.status === 'PAUSED' && task.pauseReason ? task.pauseReason.replace(/\n/g, ' +\n') : '';
      const noteText = weeklyNote ? weeklyNote.replace(/\n/g, ' +\n') : '';
      const reasonCell = pauseText && noteText ? `${pauseText} +\n${noteText}` : pauseText || noteText || '—';
      lines.push(`|${fmtTitleCell(task.title, task.mainCategory, task.status)}`);
      lines.push(`|${endDateCell}`);
      lines.push(`|${noTrack ? '—' : prevTask !== undefined ? `${prevTask}%` : '—'}`);
      lines.push(`|${noTrack ? '—' : fmtVal(thisTask, thisTaskSnap === undefined && thisTask !== undefined, task.completenessType)}`);
      lines.push(`|${fmtSpiCell(spiData)}`);
      lines.push(`|${fmtStatusCell(task.status)}`);
      lines.push(`|${reasonCell}`);
      lines.push('');
      task.outputs
        .filter(o => !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr))
        .forEach(output => {
          const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
          const label = otMeta ? `${output.name} [${otMeta.name}]` : output.name;
          lines.push(`|  ↳ ${label}`);
          lines.push('|'); lines.push('|'); lines.push('|'); lines.push('|'); lines.push('|'); lines.push('|');
          lines.push('');
        });
    });
    lines.push('|===');
    return lines.join('\n');
  }, [progressSplit, periodLabels, outputTypes]);

  // ── Period Summary（雙月/半年報用）──────────────────────────────────────────

  const periodSummary = useMemo((): PeriodSummary | null => {
    if (reportType === 'weekly') return null;
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
    const completedOutputs: { task: Task; output: WorkOutput }[] = [];
    tasks
      .filter(t => !t.archived && !excludedMainCats.includes(t.mainCategory || '其他'))
      .forEach(task => {
        task.outputs.forEach(output => {
          if (output.effectiveDate && output.effectiveDate >= currStartStr && output.effectiveDate <= currEndStr) {
            completedOutputs.push({ task, output });
          }
        });
      });
    completedOutputs.sort((a, b) => (a.output.effectiveDate ?? '').localeCompare(b.output.effectiveDate ?? ''));
    return { statusCount, filteredTotal: filteredTasks.length, hourEntries, totalMs, completedOutputs };
  }, [reportType, progressPeriod, progressTasks, tasks, timeslots, excludedMainCats]);

  const periodSummaryAsciiDoc = useMemo(() => {
    if (!periodSummary) return '';
    const fmtMs = (ms: number) => `${(ms / 3600000).toFixed(1)}h`;
    const statusLabels: Record<TaskStatus, string> = {
      BACKLOG: '待規劃', TODO: '待執行', IN_PROGRESS: '進行中',
      PAUSED: '暫停', DONE: '完成', CANCELLED: '取消',
    };
    const lines: string[] = [];
    lines.push('== 期間工作成果彙總');
    lines.push('');
    lines.push(`_工作成果區間：${format(progressPeriod.start, 'yyyy-MM-dd')} ～ ${format(progressPeriod.end, 'yyyy-MM-dd')}_`);
    lines.push('');
    lines.push('=== 任務狀態統計');
    lines.push('');
    const statParts: string[] = [];
    (['DONE', 'IN_PROGRESS', 'PAUSED', 'CANCELLED', 'TODO', 'BACKLOG'] as TaskStatus[])
      .filter(s => periodSummary.statusCount[s] > 0)
      .forEach(s => statParts.push(`${statusLabels[s]}：${periodSummary.statusCount[s]}`));
    statParts.push(`合計：${periodSummary.filteredTotal}`);
    lines.push(statParts.join('、'));
    lines.push('');
    lines.push('=== 期間實際工時彙總');
    lines.push('');
    if (periodSummary.hourEntries.length === 0) {
      lines.push('此期間無工時紀錄');
    } else {
      lines.push('[cols="2,1,1",options="header"]');
      lines.push('|===');
      lines.push('|主分類 |工時 |佔比');
      lines.push('');
      periodSummary.hourEntries.forEach(([cat, ms]) => {
        lines.push(`|${cat}`);
        lines.push(`|${fmtMs(ms)}`);
        lines.push(`|${((ms / periodSummary.totalMs) * 100).toFixed(0)}%`);
        lines.push('');
      });
      lines.push('|*合計*');
      lines.push(`|*${fmtMs(periodSummary.totalMs)}*`);
      lines.push('|100%');
      lines.push('');
      lines.push('|===');
    }
    lines.push('');
    lines.push('=== 工作產出清單');
    lines.push('');
    if (periodSummary.completedOutputs.length === 0) {
      lines.push('此期間無標記 effectiveDate 的工作產出');
    } else {
      lines.push('[cols="2,2,1,1,1",options="header"]');
      lines.push('|===');
      lines.push('|任務 |工作產出 |類型 |完成度 |對應日期');
      lines.push('');
      periodSummary.completedOutputs.forEach(({ task, output }) => {
        const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
        const taskCell = task.mainCategory ? `${task.title} +\n（${task.mainCategory}）` : task.title;
        const outputCell = output.link ? `${output.name} +\n${output.link}` : output.name;
        lines.push(`|${taskCell}`);
        lines.push(`|${outputCell}`);
        lines.push(`|${otMeta ? otMeta.name : '—'}`);
        lines.push(`|${output.completeness ? `${output.completeness}%` : '—'}`);
        lines.push(`|${output.effectiveDate ?? '—'}`);
        lines.push('');
      });
      lines.push('|===');
    }
    return lines.join('\n');
  }, [periodSummary, progressPeriod, outputTypes]);

  // ── Full export ───────────────────────────────────────────────────────────────

  const fullExportAsciiDoc = useMemo(() => {
    const reportTypeName = reportType === 'weekly' ? '工作週報' : reportType === 'bimonthly' ? '雙月盤點報告' : '半年報';
    const dateStr = format(reportAnchorDate, 'yyyy-MM-dd');
    const parts: string[] = [
      `= ${reportTypeName} | ${dateStr}`, '',
      '== WBS', '', '[plantuml]', '----', wbsSource, '----', '',
      '== 甘特圖', '', '[plantuml]', '----', ganttSource, '----', '',
      progressWithAsciiDoc, '',
    ];
    if (progressWithoutAsciiDoc) parts.push(progressWithoutAsciiDoc, '');
    if (periodSummaryAsciiDoc) parts.push(periodSummaryAsciiDoc, '');
    return parts.join('\n');
  }, [reportType, reportAnchorDate, wbsSource, ganttSource, progressWithAsciiDoc, progressWithoutAsciiDoc, periodSummaryAsciiDoc]);

  const handleExportAsciiDoc = () => {
    const suffix = reportType === 'weekly' ? 'weekly' : reportType === 'bimonthly' ? 'bimonthly' : 'semiannual';
    const dateStr = format(reportAnchorDate, 'yyyy-MM-dd');
    const blob = new Blob([fullExportAsciiDoc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${suffix}_${dateStr}.adoc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    ganttMode, setGanttMode,
    ganttScale, setGanttScale,
    ganttZoom, setGanttZoom,
    showTodayMark, setShowTodayMark,
    groupByCategory, setGroupByCategory,
    showPlantUmlSource, setShowPlantUmlSource,
    settingsExpanded, setSettingsExpanded,
    ganttRange, ganttActiveTasks,
    wbsSource, ganttSource, getPlantUMLUrl,
    progressAsciiDoc,
    progressWithAsciiDoc, progressWithoutAsciiDoc,
    periodSummary, periodSummaryAsciiDoc,
    fullExportAsciiDoc, handleExportAsciiDoc,
  };
}
