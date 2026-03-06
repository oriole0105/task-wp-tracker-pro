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

export interface WorkOutput {
  id: string;
  name: string;
  outputTypeId?: string;  // references OutputType.id
  summary?: string;       // 無形產出的說明/摘要
  link?: string;          // 有形產出的連結
  completeness?: string;
  mainCategory?: string;
  subCategory?: string;
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
  pauseReason?: string;

  parentId?: string;
  outputs: WorkOutput[];
  labels: string[];
  showInWbs: boolean;
  showInGantt: boolean;
  archived?: boolean;
  archivedAt?: number;
}

export interface CategoryData {
  mainCategories: string[];
  subCategories: string[];
}
