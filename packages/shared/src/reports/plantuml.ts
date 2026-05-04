import { format, isValid } from 'date-fns';
import type { Task, Timeslot } from '../types/index.js';
import { getTaskActualStart, getTaskActualEnd } from '../utils/taskDateUtils.js';
import { getTaskDepth, getWbsColor, type Period } from './common.js';

// ── WBS ───────────────────────────────────────────────────────────────────────

export interface WbsOpts {
  tasks: Task[];
  /** activeTasks filtered by ganttPeriod + selectedLevels */
  activeTasks: Task[];
  excludedMainCats: string[];
}

export function buildWbsSource(opts: WbsOpts): string {
  const { activeTasks, excludedMainCats } = opts;
  const filteredTasks = activeTasks.filter(t =>
    t.showInWbs !== false && !excludedMainCats.includes(t.mainCategory || '其他')
  );

  let source = '@startwbs\n* 專案工作任務\n';

  const mainCats = Array.from(new Set(filteredTasks.map(t => t.mainCategory || '其他')));
  mainCats.forEach(mainCat => {
    source += `** ${mainCat}\n`;
    const catTasks = filteredTasks.filter(t => (t.mainCategory || '其他') === mainCat);

    const renderNode = (parentId: string | undefined, level: number) => {
      catTasks.filter(t => t.parentId === parentId).forEach(child => {
        const stars = '*'.repeat(level);
        const color = getWbsColor(child.status);
        source += `${stars}${color ? `[${color}]` : ''} ${child.title}\n`;
        renderNode(child.id, level + 1);
      });
    };

    const rootCatTasks = catTasks.filter(t => !t.parentId || !catTasks.find(p => p.id === t.parentId));
    rootCatTasks.forEach(task => {
      const color = getWbsColor(task.status);
      source += `***${color ? `[${color}]` : ''} ${task.title}\n`;
      renderNode(task.id, 4);
    });
  });

  source += '@endwbs';
  return source;
}

// ── Gantt ─────────────────────────────────────────────────────────────────────

export interface GanttOpts {
  tasks: Task[];
  timeslots: Timeslot[];
  ganttActiveTasks: Task[];
  ganttRange: Period;
  holidays: string[];
  showTodayMark: boolean;
  groupByCategory: boolean;
  ganttScale: 'daily' | 'weekly' | 'monthly';
  ganttZoom: number;
  selectedLevels: number[];
}

export function buildGanttSource(opts: GanttOpts): string {
  const {
    tasks, timeslots, ganttActiveTasks, ganttRange, holidays,
    showTodayMark, groupByCategory, ganttScale, ganttZoom, selectedLevels,
  } = opts;

  const ganttRangeStartStr = format(ganttRange.start, 'yyyy-MM-dd');
  const ganttRangeEndStr = format(ganttRange.end, 'yyyy-MM-dd');

  let source = '@startgantt\n';
  source += `printscale ${ganttScale} zoom ${ganttZoom}\n`;
  source += `Project starts ${ganttRangeStartStr}\n`;
  if (showTodayMark) source += `${format(new Date(), 'yyyy-MM-dd')} is colored in Orange\n`;
  source += `saturday are colored in lightblue\n`;
  source += `sunday are colored in lightblue\n`;
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
      selfStart = t.estimatedStartDate;
      selfEnd = t.estimatedEndDate;
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
    const milestones = (task.milestones ?? []).filter(m =>
      m.showInGantt && m.title.trim() !== '' &&
      m.date >= ganttRangeStartStr && m.date <= ganttRangeEndStr
    );
    milestones.forEach(m => {
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

  // Orphan milestones (tasks without dates that still have milestones in range)
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
}
