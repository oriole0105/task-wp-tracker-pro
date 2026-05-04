import { z } from 'zod';

// Task status enum
export const TaskStatusSchema = z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED']);

// Base task creation schema — fleshed out in Stage 2 with full server API
export const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  mainCategory: z.string().default(''),
  assignee: z.string().default(''),
  reporter: z.string().default(''),
  status: TaskStatusSchema.default('BACKLOG'),
  parentId: z.string().optional(),
  labels: z.array(z.string()).default([]),
  showInWbs: z.boolean().default(true),
  showInReport: z.boolean().default(true),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export const CreateTimeslotSchema = z.object({
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive().optional(),
  taskId: z.string().optional(),
  subCategory: z.string().default(''),
  note: z.string().default(''),
});

export const UpdateTimeslotSchema = CreateTimeslotSchema.partial();
