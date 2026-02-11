export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'PAUSED' | 'DONE';

export interface TimeLog {
  id: string;
  startTime: number;
  endTime?: number;
}

export interface WorkOutput {
  id: string;
  name: string;
  link?: string;
  completeness?: string;
}

export interface Task {
  id: string;
  title: string;
  aliasTitle: string;
  description: string;
  mainCategory: string;
  subCategory: string;
  
  estimatedStartDate?: number;
  estimatedEndDate?: number;
  actualStartDate?: number;
  actualEndDate?: number;
  
  assignee: string;
  reporter: string;
  
  status: TaskStatus;
  
  timeLogs: TimeLog[];
  totalTimeSpent: number;
  
  parentId?: string;
  outputs: WorkOutput[];
  labels: string[]; // New field for flexible tagging, max 3
}

export interface CategoryData {
  mainCategories: string[];
  subCategories: string[];
}
