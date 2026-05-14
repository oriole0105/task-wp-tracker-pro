import type { Task, TaskStatus, WeeklySnapshot, WorkOutput } from '@tt/shared/types';

export interface PeriodSummary {
  statusCount: Record<TaskStatus, number>;
  filteredTotal: number;
  hourEntries: [string, number][];
  totalMs: number;
  completedOutputs: { task: Task; output: WorkOutput }[];
}

export interface ChartTarget {
  title: string;
  taskSnapshots: WeeklySnapshot[];
  outputLines: { name: string; snapshots: WeeklySnapshot[] }[];
}
