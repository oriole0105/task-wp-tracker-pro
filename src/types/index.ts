export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'PAUSED' | 'DONE' | 'CANCELLED';

export type GanttDisplayMode = 'bar' | 'section' | 'hidden';

export interface Milestone {
  id: string;
  title: string;        // 里程碑名稱（甘特圖顯示標題）
  date: string;         // 'yyyy-MM-dd'
  showInGantt: boolean;
  color?: string;       // PlantUML color 名稱，e.g. 'Red'、'Gold'
  note?: string;
}

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
  createdAt?: number;   // epoch ms，用於跨裝置智慧合併
  updatedAt?: number;   // epoch ms，用於跨裝置智慧合併
}

export interface OutputType {
  id: string;
  name: string;
  isTangible: boolean;
}

export interface Member {
  id: string;
  name: string;
  isSelf?: boolean;  // true = 「自己」這筆，不可刪除，只能改名
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
  createdAt?: number;
  updatedAt?: number;
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
  completenessType?: 'real' | 'confidence'; // 完成度類型：真實百分比 / 信心百分比，預設 'confidence'
  weeklySnapshots?: WeeklySnapshot[];
  pauseReason?: string;

  parentId?: string;
  outputs: WorkOutput[];
  labels: string[];
  showInWbs: boolean;
  ganttDisplayMode: GanttDisplayMode;
  showInReport?: boolean; // 顯示於週報進度表，預設 true；固定會議等可設為 false
  trackCompleteness?: boolean; // 預設 true；週期型/持續型任務設 false，不追蹤完成度 %
  milestones?: Milestone[];
  timelineEntries?: TaskTimelineEntry[];
  archived?: boolean;
  archivedAt?: number;
  createdAt?: number;   // epoch ms，用於跨裝置智慧合併
  updatedAt?: number;   // epoch ms，用於跨裝置智慧合併
}

/** JSON 批次匯入的任務格式（樹狀結構，children 為子任務） */
export interface JsonImportTask {
  title: string;
  aliasTitle?: string;
  description?: string;
  mainCategory?: string;
  assignee?: string;
  reporter?: string;
  labels?: string[];
  showInWbs?: boolean;
  showInReport?: boolean;
  trackCompleteness?: boolean;
  ganttDisplayMode?: GanttDisplayMode;
  status?: TaskStatus;
  children?: JsonImportTask[];
}

export interface TodoItem {
  id: string;
  description: string;
  done: boolean;
  startDate: string;   // 'yyyy-MM-dd'
  doneDate?: string;    // 'yyyy-MM-dd'
  createdAt?: number;
  updatedAt?: number;
}

export interface TaskTimelineEntry {
  id: string;
  date: string;        // 'yyyy-MM-dd'
  content: string;
}

export interface CategoryData {
  mainCategories: string[];
  subCategories: string[];
}
