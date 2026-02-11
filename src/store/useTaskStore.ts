import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatus, CategoryData, WorkOutput } from '../types';

interface TaskState {
  tasks: Task[];
  mainCategories: string[];
  subCategories: string[];
  
  // Actions
  addTask: (task: Omit<Task, 'id' | 'timeLogs' | 'totalTimeSpent'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  
  startTimer: (taskId: string) => void;
  stopTimer: (taskId: string) => void;
  manualAddTimeLog: (taskId: string, start: number, end: number) => void;
  updateTimeLog: (taskId: string, logId: string, start: number, end: number) => void;
  deleteTimeLog: (taskId: string, logId: string) => void;
  
  // Category Actions
  addMainCategory: (name: string) => void;
  updateMainCategory: (oldName: string, newName: string) => void;
  deleteMainCategory: (name: string) => void;
  
  addSubCategory: (name: string) => void;
  updateSubCategory: (oldName: string, newName: string) => void;
  deleteSubCategory: (name: string) => void;
  
  updateWorkOutput: (taskId: string, outputId: string, updates: Partial<WorkOutput>) => void;
  importCategories: (data: CategoryData) => void;
  importFullData: (data: { tasks: Task[], mainCategories: string[], subCategories: string[] }) => void;
  
  getTaskById: (id: string) => Task | undefined;
  getSubTasks: (parentId: string) => Task[];
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      mainCategories: ['Development', 'Meeting', 'General'],
      subCategories: ['Frontend', 'Backend', 'Research', 'Planning', 'Urgent'],

      addTask: (taskData) => {
        const newTask: Task = {
          ...taskData,
          id: uuidv4(),
          timeLogs: [],
          totalTimeSpent: 0,
          outputs: [],
          labels: [],
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id && t.parentId !== id),
        }));
      },

      startTimer: (taskId) => {
        const now = Date.now();
        set((state) => {
          const newTasks = state.tasks.map((task) => {
            if (task.status === 'IN_PROGRESS') {
              const activeLogIndex = task.timeLogs.findIndex((log) => !log.endTime);
              if (activeLogIndex !== -1) {
                const updatedLogs = [...task.timeLogs];
                updatedLogs[activeLogIndex] = { ...updatedLogs[activeLogIndex], endTime: now };
                const totalTime = updatedLogs.reduce((acc, log) => acc + ((log.endTime || now) - log.startTime), 0);
                return { ...task, status: 'PAUSED' as TaskStatus, timeLogs: updatedLogs, totalTimeSpent: totalTime };
              }
            }
            if (task.id === taskId) {
               return {
                ...task,
                status: 'IN_PROGRESS' as TaskStatus,
                actualStartDate: task.actualStartDate || now,
                timeLogs: [...task.timeLogs, { id: uuidv4(), startTime: now }],
              };
            }
            return task;
          });
          return { tasks: newTasks };
        });
      },

      stopTimer: (taskId) => {
        const now = Date.now();
        set((state) => ({
            tasks: state.tasks.map((task) => {
              if (task.id === taskId) {
                const activeLogIndex = task.timeLogs.findIndex((log) => !log.endTime);
                if (activeLogIndex !== -1) {
                   const updatedLogs = [...task.timeLogs];
                    updatedLogs[activeLogIndex] = { ...updatedLogs[activeLogIndex], endTime: now };
                    const totalTime = updatedLogs.reduce((acc, log) => acc + ((log.endTime || now) - log.startTime), 0);
                    return { ...task, status: 'PAUSED' as TaskStatus, timeLogs: updatedLogs, totalTimeSpent: totalTime };
                }
              }
              return task;
            }),
        }));
      },

      manualAddTimeLog: (taskId, start, end) => {
        set((state) => ({
            tasks: state.tasks.map((task) => {
              if (task.id === taskId) {
                 const updatedLogs = [...task.timeLogs, { id: uuidv4(), startTime: start, endTime: end }];
                 const totalTime = updatedLogs.reduce((acc, log) => acc + ((log.endTime || 0) - log.startTime), 0);
                 return { ...task, timeLogs: updatedLogs, totalTimeSpent: totalTime };
              }
              return task;
            })
        }));
      },
      
      updateTimeLog: (taskId, logId, start, end) => {
          set((state) => ({
                tasks: state.tasks.map(task => {
                    if(task.id === taskId) {
                        const updatedLogs = task.timeLogs.map(log => log.id === logId ? { ...log, startTime: start, endTime: end } : log);
                        const totalTime = updatedLogs.reduce((acc, log) => acc + ((log.endTime || 0) - log.startTime), 0);
                        return { ...task, timeLogs: updatedLogs, totalTimeSpent: totalTime };
                    }
                    return task;
                })
          }));
      },

      deleteTimeLog: (taskId, logId) => {
           set((state) => ({
                tasks: state.tasks.map(task => {
                    if(task.id === taskId) {
                        const updatedLogs = task.timeLogs.filter(log => log.id !== logId);
                        const totalTime = updatedLogs.reduce((acc, log) => acc + ((log.endTime || 0) - log.startTime), 0);
                        return { ...task, timeLogs: updatedLogs, totalTimeSpent: totalTime };
                    }
                    return task;
                })
          }));
      },

      // Category Actions
      addMainCategory: (name) => set(s => ({ mainCategories: [...new Set([...s.mainCategories, name])] })),
      updateMainCategory: (old, newVal) => set(s => ({ 
          mainCategories: s.mainCategories.map(c => c === old ? newVal : c),
          tasks: s.tasks.map(t => t.mainCategory === old ? { ...t, mainCategory: newVal } : t)
      })),
      deleteMainCategory: (name) => set(s => ({ mainCategories: s.mainCategories.filter(c => c !== name) })),

      addSubCategory: (name) => set(s => ({ subCategories: [...new Set([...s.subCategories, name])] })),
      updateSubCategory: (old, newVal) => set(s => ({ 
          subCategories: s.subCategories.map(c => c === old ? newVal : c),
          tasks: s.tasks.map(t => t.subCategory === old ? { ...t, subCategory: newVal } : t)
      })),
      deleteSubCategory: (name) => set(s => ({ subCategories: s.subCategories.filter(c => c !== name) })),

      updateWorkOutput: (taskId, outputId, updates) => set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? {
          ...t,
          outputs: (t.outputs || []).map(o => o.id === outputId ? { ...o, ...updates } : o)
        } : t)
      })),

      importCategories: (data) => set({ mainCategories: data.mainCategories, subCategories: data.subCategories }),

      importFullData: (data) => set({
        tasks: data.tasks || [],
        mainCategories: data.mainCategories || [],
        subCategories: data.subCategories || []
      }),

      getTaskById: (id) => get().tasks.find((t) => t.id === id),
      getSubTasks: (parentId) => get().tasks.filter((t) => t.parentId === parentId),
    }),
    {
      name: 'task-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);