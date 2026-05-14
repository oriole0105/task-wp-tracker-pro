import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { Task, Timeslot } from '@tt/shared/types';
import { computeProgressSplit, getTaskDepth } from '@tt/shared/reports/common';
import type { Period, ProgressSplit } from '@tt/shared/reports/common';

export type { ProgressSplit };

interface UseReportTasksInput {
  tasks: Task[];
  timeslots: Timeslot[];
  ganttPeriod: Period;
  progressPeriod: Period;
  prevPeriod: Period;
}

export function useReportTasks({
  tasks, timeslots, ganttPeriod, progressPeriod, prevPeriod,
}: UseReportTasksInput) {
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3, 4, 5]);
  const [excludedMainCats, setExcludedMainCats] = useState<string[]>([]);

  const toggleLevel = (level: number) => {
    setSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const toggleMainExclusion = (cat: string) => {
    setExcludedMainCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const activeTasks = useMemo(() => {
    const startTs = ganttPeriod.start.getTime();
    const endTs = ganttPeriod.end.getTime();
    return tasks.filter(task => {
      if (task.archived) return false;
      const depth = getTaskDepth(task, tasks);
      if (!selectedLevels.includes(depth)) return false;
      const hasEstimatedInRange = task.estimatedStartDate && task.estimatedStartDate <= endTs &&
        (!task.estimatedEndDate || task.estimatedEndDate >= startTs);
      const hasActualInRange = timeslots.some(ts => {
        if (ts.taskId !== task.id) return false;
        const logEnd = ts.endTime || Date.now();
        return ts.startTime <= endTs && logEnd >= startTs;
      });
      return hasEstimatedInRange || hasActualInRange;
    });
  }, [tasks, timeslots, ganttPeriod, selectedLevels]);

  const progressTasks = useMemo(() => {
    const startTs = progressPeriod.start.getTime();
    const endTs = progressPeriod.end.getTime();
    const currStartStr = format(progressPeriod.start, 'yyyy-MM-dd');
    const currEndStr = format(progressPeriod.end, 'yyyy-MM-dd');
    return tasks.filter(task => {
      if (task.archived) return false;
      const depth = getTaskDepth(task, tasks);
      if (!selectedLevels.includes(depth)) return false;
      const hasEstimatedInRange = task.estimatedStartDate && task.estimatedStartDate <= endTs &&
        (!task.estimatedEndDate || task.estimatedEndDate >= startTs);
      const hasActualInRange = timeslots.some(ts => {
        if (ts.taskId !== task.id) return false;
        const logEnd = ts.endTime || Date.now();
        return ts.startTime <= endTs && logEnd >= startTs;
      });
      const hasOutputInRange = task.outputs.some(o =>
        o.effectiveDate && o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr
      );
      return hasEstimatedInRange || hasActualInRange || hasOutputInRange;
    });
  }, [tasks, timeslots, progressPeriod, selectedLevels]);

  const progressSplit = useMemo((): ProgressSplit =>
    computeProgressSplit(progressTasks, timeslots, prevPeriod, progressPeriod, excludedMainCats),
    [progressTasks, timeslots, prevPeriod, progressPeriod, excludedMainCats]
  );

  return {
    selectedLevels, toggleLevel,
    excludedMainCats, setExcludedMainCats, toggleMainExclusion,
    activeTasks, progressTasks, progressSplit,
  };
}
