import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { format, startOfWeek } from 'date-fns';
import type { Task, CategoryData, WorkOutput, Timeslot, OutputType, WeeklySnapshot } from '../types';

const getCurrentWeekStart = (): string =>
  format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');

const upsertSnapshot = (snapshots: WeeklySnapshot[] = [], weekStart: string, completeness: number, note?: string): WeeklySnapshot[] => {
  const idx = snapshots.findIndex(s => s.weekStart === weekStart);
  const snap: WeeklySnapshot = { weekStart, completeness, ...(note !== undefined && { note }) };
  return idx >= 0 ? snapshots.map((s, i) => i === idx ? snap : s) : [...snapshots, snap];
};

const DEFAULT_OUTPUT_TYPES: OutputType[] = [
  { id: 'ot-deliverable', name: '實體產出', isTangible: true },
  { id: 'ot-decision',    name: '決策',     isTangible: false },
  { id: 'ot-knowledge',   name: '知識/研究', isTangible: false },
  { id: 'ot-process',     name: '流程/規範', isTangible: false },
  { id: 'ot-other',       name: '其他',     isTangible: false },
];

interface HistorySnapshot {
  tasks: Task[];
  timeslots: Timeslot[];
}

interface TaskState {
  tasks: Task[];
  timeslots: Timeslot[];
  mainCategories: string[];
  subCategories: string[];
  outputTypes: OutputType[];
  holidays: string[]; // yyyy-MM-dd 格式的假日/休息日清單

  // Undo history (not persisted)
  _history: HistorySnapshot[];

  // UI preferences (persisted)
  darkMode: boolean;

  // Task Actions
  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  // Timeslot Actions
  addTimeslot: (data: Omit<Timeslot, 'id'>) => void;
  updateTimeslot: (id: string, updates: Partial<Timeslot>) => void;
  deleteTimeslot: (id: string) => void;
  getTaskTotalTime: (taskId: string) => number;

  // Category Actions
  addMainCategory: (name: string) => void;
  updateMainCategory: (oldName: string, newName: string) => void;
  deleteMainCategory: (name: string) => void;

  addSubCategory: (name: string) => void;
  updateSubCategory: (oldName: string, newName: string) => void;
  deleteSubCategory: (name: string) => void;

  updateWorkOutput: (taskId: string, outputId: string, updates: Partial<WorkOutput>) => void;
  importCategories: (data: CategoryData) => void;
  importFullData: (data: { tasks: Task[], timeslots?: Timeslot[], mainCategories: string[], subCategories: string[], outputTypes?: OutputType[], holidays?: string[] }) => void;

  // OutputType Actions
  addOutputType: (data: Omit<OutputType, 'id'>) => void;
  updateOutputType: (id: string, updates: Partial<Omit<OutputType, 'id'>>) => void;
  deleteOutputType: (id: string) => void;

  // Holiday Actions
  addHoliday: (date: string) => void;
  deleteHoliday: (date: string) => void;

  undo: () => void;
  toggleDarkMode: () => void;

  reorderTask: (id: string, direction: 'up' | 'down' | 'promote' | 'demote') => void;

  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  archiveAllDone: () => void;

  updateTaskSnapshots: (id: string, snapshots: WeeklySnapshot[]) => void;

  getTaskById: (id: string) => Task | undefined;
  getSubTasks: (parentId: string) => Task[];
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      timeslots: [],
      mainCategories: ['Development', 'Meeting', 'General'],
      subCategories: ['Frontend', 'Backend', 'Research', 'Planning', 'Urgent'],
      outputTypes: DEFAULT_OUTPUT_TYPES,
      holidays: [],
      _history: [],
      darkMode: false,

      addTask: (taskData) => {
        const newTask: Task = {
          ...taskData,
          id: uuidv4(),
          outputs: taskData.outputs ?? [],
          labels: taskData.labels ?? [],
          showInWbs: taskData.showInWbs ?? true,
          showInGantt: taskData.showInGantt ?? true,
          showInReport: taskData.showInReport ?? true,
        };
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          tasks: [...state.tasks, newTask],
        }));
      },

      updateTask: (id, updates) => {
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            const updated = { ...t, ...updates };
            if (updates.completeness !== undefined) {
              updated.weeklySnapshots = upsertSnapshot(t.weeklySnapshots, getCurrentWeekStart(), updates.completeness);
            }
            return updated;
          }),
        }));
      },

      deleteTask: (id) => {
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          tasks: state.tasks.filter((t) => t.id !== id && t.parentId !== id),
        }));
      },

      // Timeslot Actions
      addTimeslot: (data) => {
        const newTimeslot: Timeslot = { ...data, id: uuidv4() };
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          timeslots: [...state.timeslots, newTimeslot],
        }));
      },

      updateTimeslot: (id, updates) => {
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          timeslots: state.timeslots.map(ts => ts.id === id ? { ...ts, ...updates } : ts),
        }));
      },

      deleteTimeslot: (id) => {
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          timeslots: state.timeslots.filter(ts => ts.id !== id),
        }));
      },

      getTaskTotalTime: (taskId) => {
        const { timeslots } = get();
        return timeslots
          .filter(ts => ts.taskId === taskId && ts.endTime)
          .reduce((acc, ts) => acc + (ts.endTime! - ts.startTime), 0);
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
        timeslots: s.timeslots.map(ts => ts.subCategory === old ? { ...ts, subCategory: newVal } : ts)
      })),
      deleteSubCategory: (name) => set(s => ({ subCategories: s.subCategories.filter(c => c !== name) })),

      updateWorkOutput: (taskId, outputId, updates) => set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? {
          ...t,
          outputs: (t.outputs || []).map(o => {
            if (o.id !== outputId) return o;
            const updated = { ...o, ...updates };
            if (updates.completeness !== undefined) {
              const val = parseInt(updates.completeness ?? '0') || 0;
              updated.weeklySnapshots = upsertSnapshot(o.weeklySnapshots, getCurrentWeekStart(), val);
            }
            return updated;
          }),
        } : t)
      })),

      importCategories: (data) => set({ mainCategories: data.mainCategories, subCategories: data.subCategories }),

      importFullData: (data) => set({
        _history: [],
        tasks: data.tasks || [],
        timeslots: data.timeslots || [],
        mainCategories: data.mainCategories || [],
        subCategories: data.subCategories || [],
        outputTypes: data.outputTypes || DEFAULT_OUTPUT_TYPES,
        holidays: data.holidays || [],
      }),

      addOutputType: (data) => set(s => ({
        outputTypes: [...s.outputTypes, { ...data, id: uuidv4() }],
      })),
      updateOutputType: (id, updates) => set(s => ({
        outputTypes: s.outputTypes.map(ot => ot.id === id ? { ...ot, ...updates } : ot),
      })),
      deleteOutputType: (id) => set(s => ({
        outputTypes: s.outputTypes.filter(ot => ot.id !== id),
      })),

      addHoliday: (date) => set(s => ({
        holidays: [...new Set([...s.holidays, date])].sort(),
      })),
      deleteHoliday: (date) => set(s => ({
        holidays: s.holidays.filter(d => d !== date),
      })),

      reorderTask: (id, direction) => {
        set((state) => {
          const tasks = [...state.tasks];
          const idx = tasks.findIndex(t => t.id === id);
          if (idx === -1) return {};
          const task = tasks[idx];
          const siblings = tasks.filter(t => t.parentId === task.parentId);
          const sibIdx = siblings.findIndex(t => t.id === id);
          const snapshot = { tasks: state.tasks, timeslots: state.timeslots };

          if (direction === 'up') {
            if (sibIdx === 0) return {};
            const prevIdx = tasks.findIndex(t => t.id === siblings[sibIdx - 1].id);
            [tasks[idx], tasks[prevIdx]] = [tasks[prevIdx], tasks[idx]];
            return { _history: [...state._history.slice(-19), snapshot], tasks };
          }
          if (direction === 'down') {
            if (sibIdx === siblings.length - 1) return {};
            const nextIdx = tasks.findIndex(t => t.id === siblings[sibIdx + 1].id);
            [tasks[idx], tasks[nextIdx]] = [tasks[nextIdx], tasks[idx]];
            return { _history: [...state._history.slice(-19), snapshot], tasks };
          }
          if (direction === 'promote') {
            if (!task.parentId) return {};
            const parent = tasks.find(t => t.id === task.parentId);
            if (!parent) return {};
            const updatedTask = { ...task, parentId: parent.parentId };
            tasks.splice(idx, 1);
            const parentIdx = tasks.findIndex(t => t.id === parent.id);
            tasks.splice(parentIdx + 1, 0, updatedTask);
            return { _history: [...state._history.slice(-19), snapshot], tasks };
          }
          if (direction === 'demote') {
            if (sibIdx === 0) return {};
            const prevSib = siblings[sibIdx - 1];
            const updatedTask = { ...task, parentId: prevSib.id };
            tasks.splice(idx, 1);
            const getAllDescIds = (pid: string): string[] => {
              const children = tasks.filter(t => t.parentId === pid);
              return [pid, ...children.flatMap(c => getAllDescIds(c.id))];
            };
            const descIds = getAllDescIds(prevSib.id);
            let insertIdx = tasks.findIndex(t => t.id === prevSib.id);
            tasks.forEach((t, i) => { if (descIds.includes(t.id)) insertIdx = i; });
            tasks.splice(insertIdx + 1, 0, updatedTask);
            return { _history: [...state._history.slice(-19), snapshot], tasks };
          }
          return {};
        });
      },

      archiveTask: (id) => {
        const getAllDescendantIds = (tasks: Task[], rootId: string): string[] => {
          const children = tasks.filter(t => t.parentId === rootId);
          return [rootId, ...children.flatMap(c => getAllDescendantIds(tasks, c.id))];
        };
        const now = Date.now();
        set((state) => {
          const ids = new Set(getAllDescendantIds(state.tasks, id));
          return {
            _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
            tasks: state.tasks.map(t =>
              ids.has(t.id) ? { ...t, archived: true, archivedAt: now } : t
            ),
          };
        });
      },

      unarchiveTask: (id) => {
        const getAllDescendantIds = (tasks: Task[], rootId: string): string[] => {
          const children = tasks.filter(t => t.parentId === rootId);
          return [rootId, ...children.flatMap(c => getAllDescendantIds(tasks, c.id))];
        };
        set((state) => {
          const ids = new Set(getAllDescendantIds(state.tasks, id));
          return {
            _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
            tasks: state.tasks.map(t =>
              ids.has(t.id) ? { ...t, archived: false, archivedAt: undefined } : t
            ),
          };
        });
      },

      archiveAllDone: () => {
        const now = Date.now();
        set((state) => {
          const doneIds = new Set(
            state.tasks.filter(t => (t.status === 'DONE' || t.status === 'CANCELLED') && !t.archived).map(t => t.id)
          );
          const getAllDescendantIds = (rootId: string): string[] => {
            const children = state.tasks.filter(t => t.parentId === rootId);
            return [rootId, ...children.flatMap(c => getAllDescendantIds(c.id))];
          };
          const allIds = new Set(
            Array.from(doneIds).flatMap(id => getAllDescendantIds(id))
          );
          return {
            _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
            tasks: state.tasks.map(t =>
              allIds.has(t.id) && !t.archived ? { ...t, archived: true, archivedAt: now } : t
            ),
          };
        });
      },

      undo: () => {
        const history = get()._history;
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        set({ tasks: prev.tasks, timeslots: prev.timeslots, _history: history.slice(0, -1) });
      },

      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

      updateTaskSnapshots: (id, snapshots) => {
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          tasks: state.tasks.map(t => t.id === id ? { ...t, weeklySnapshots: snapshots } : t),
        }));
      },

      getTaskById: (id) => get().tasks.find((t) => t.id === id),
      getSubTasks: (parentId) => get().tasks.filter((t) => t.parentId === parentId),
    }),
    {
      name: 'task-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        timeslots: state.timeslots,
        mainCategories: state.mainCategories,
        subCategories: state.subCategories,
        outputTypes: state.outputTypes,
        holidays: state.holidays,
        darkMode: state.darkMode,
      }),
    }
  )
);
