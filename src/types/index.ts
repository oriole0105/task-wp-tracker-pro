export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'PAUSED' | 'DONE' | 'CANCELLED';

/**
 * @deprecated Use Timeslot instead. Kept for migration script compatibility.
 */
export interface TimeLog {
  id: string;
  startTime: number;
  endTime?: number;
}

export interface Timeslot {
  id: string;
  startTime: number;
  endTime?: number;
  taskId?: string;      // 可選，無連結 = 未分類
  subCategory: string;  // 時間分類（從 Task 移至此）
  note?: string;
}

export interface OutputType {
  id: string;
  name: string;
  isTangible: boolean;
}

export interface WeeklySnapshot {
  weekStart: string;    // 'yyyy-MM-dd'（週日為起始）
  completeness: number; // 0-100
  note?: string;
}

export interface WorkOutput {
  id: string;
  name: string;
  outputTypeId?: string;  // references OutputType.id
  summary?: string;       // 無形產出的說明/摘要
  link?: string;          // 有形產出的連結
  completeness?: string;
  effectiveDate?: string;   // 'yyyy-MM-dd'，產出歸屬的期間（週期型產出用）；無值代表持續型產出
  mainCategory?: string;
  subCategory?: string;
  weeklySnapshots?: WeeklySnapshot[];
}

export interface Task {
  id: string;
  title: string;
  aliasTitle: string;
  description: string;
  mainCategory: string;

  estimatedStartDate?: number;
  estimatedEndDate?: number;
  actualStartDate?: number;
  actualEndDate?: number;

  assignee: string;
  reporter: string;

  status: TaskStatus;
  completeness?: number; // 0-100，任務整體完成度
  weeklySnapshots?: WeeklySnapshot[];
  pauseReason?: string;

  parentId?: string;
  outputs: WorkOutput[];
  labels: string[];
  showInWbs: boolean;
  showInGantt: boolean;
  showInReport?: boolean; // 顯示於週報進度表，預設 true；固定會議等可設為 false
  archived?: boolean;
  archivedAt?: number;
}

export interface CategoryData {
  mainCategories: string[];
  subCategories: string[];
}
