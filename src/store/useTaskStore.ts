import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { format, startOfWeek } from 'date-fns';
import type { Task, CategoryData, WorkOutput, Timeslot, OutputType, WeeklySnapshot, Member, GanttDisplayMode, JsonImportTask } from '../types';
import { getAllDescendantIds, propagateStatusToAncestors, type StatusChangeInfo } from '../utils/taskHierarchy';

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

type SettingsExport = {
  mainCategories: string[];
  subCategories: string[];
  outputTypes: OutputType[];
  holidays: string[];
  members: Member[];
};

interface TaskState {
  tasks: Task[];
  timeslots: Timeslot[];
  mainCategories: string[];
  subCategories: string[];
  outputTypes: OutputType[];
  holidays: string[]; // yyyy-MM-dd 格式的假日/休息日清單
  members: Member[];

  // Undo history (not persisted)
  _history: HistorySnapshot[];

  // UI preferences (persisted)
  darkMode: boolean;

  // Task Actions
  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (sourceTaskId: string) => void;
  importTasksFromJson: (jsonTasks: JsonImportTask[], parentId?: string) => void;

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

  // Member Actions
  addMember: (name: string) => void;
  updateMember: (id: string, name: string) => void;
  deleteMember: (id: string) => void;
  importSettings: (data: Partial<SettingsExport>) => void;

  undo: () => void;
  toggleDarkMode: () => void;

  reorderTask: (id: string, direction: 'up' | 'down' | 'promote' | 'demote') => void;

  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  archiveAllDone: () => void;

  updateTaskSnapshots: (id: string, snapshots: WeeklySnapshot[]) => void;
  updateTaskWeeklyNote: (id: string, weekStart: string, note: string) => void;

  getTaskById: (id: string) => Task | undefined;
  getSubTasks: (parentId: string) => Task[];

  // 最近一次自動狀態變更（供 UI 顯示 toast）
  _lastAutoStatusChange: StatusChangeInfo | null;
  clearLastAutoStatusChange: () => void;

  // 智慧合併匯入（手機 → 電腦）
  mergeImport: (data: { tasks?: Task[], timeslots?: Timeslot[] }) => { tasksAdded: number; tasksUpdated: number; timeslotsAdded: number; timeslotsUpdated: number };

  // 手機快速新增（不 persist）
  quickAddAction: 'task' | 'timeslot' | null;
  setQuickAddAction: (action: 'task' | 'timeslot' | null) => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      timeslots: [],
      mainCategories: ['Development', 'Meeting', 'General'],
      subCategories: ['固定會議', '臨時會議', '議題討論', '思考規劃', '閱讀學習', '文件撰寫', '程式開發', '程式碼審查', 'Debug/問題排查'],
      outputTypes: DEFAULT_OUTPUT_TYPES,
      holidays: [],
      members: [{ id: 'self', name: '', isSelf: true }],
      _history: [],
      darkMode: false,
      quickAddAction: null,
      setQuickAddAction: (action) => set({ quickAddAction: action }),

      addTask: (taskData) => {
        const now = Date.now();
        const newTask: Task = {
          ...taskData,
          id: uuidv4(),
          outputs: taskData.outputs ?? [],
          labels: taskData.labels ?? [],
          showInWbs: taskData.showInWbs ?? true,
          ganttDisplayMode: taskData.ganttDisplayMode ?? 'bar',
          showInReport: taskData.showInReport ?? true,
          trackCompleteness: taskData.trackCompleteness ?? true,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          tasks: [...state.tasks, newTask],
        }));
      },

      duplicateTask: (sourceTaskId) => {
        const source = get().tasks.find(t => t.id === sourceTaskId);
        if (!source) return;
        get().addTask({
          title: `${source.title}（副本）`,
          aliasTitle: source.aliasTitle,
          description: source.description,
          mainCategory: source.mainCategory,
          assignee: source.assignee,
          reporter: source.reporter,
          labels: [...(source.labels ?? [])],
          showInWbs: source.showInWbs ?? true,
          ganttDisplayMode: source.ganttDisplayMode ?? 'bar',
          showInReport: source.showInReport !== false,
          trackCompleteness: source.trackCompleteness !== false,
          parentId: source.parentId,
          status: 'BACKLOG',
          outputs: [],
          milestones: [],
        });
      },

      importTasksFromJson: (jsonTasks, parentId) => {
        const flatTasks: Task[] = [];
        const now = Date.now();
        const flatten = (items: JsonImportTask[], pid?: string) => {
          for (const item of items) {
            const id = uuidv4();
            flatTasks.push({
              id,
              title: item.title,
              aliasTitle: item.aliasTitle ?? '',
              description: item.description ?? '',
              mainCategory: item.mainCategory ?? '',
              assignee: item.assignee ?? '',
              reporter: item.reporter ?? '',
              labels: [...(item.labels ?? [])],
              showInWbs: item.showInWbs ?? true,
              ganttDisplayMode: item.ganttDisplayMode ?? 'bar',
              showInReport: item.showInReport ?? true,
              trackCompleteness: item.trackCompleteness ?? true,
              parentId: pid,
              status: item.status ?? 'BACKLOG',
              outputs: [],
              createdAt: now,
              updatedAt: now,
            });
            if (item.children?.length) {
              flatten(item.children, id);
            }
          }
        };
        flatten(jsonTasks, parentId);
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          tasks: [...state.tasks, ...flatTasks],
        }));
      },

      updateTask: (id, updates) => {
        set((state) => {
          const now = Date.now();
          let newTasks = state.tasks.map((t) => {
            if (t.id !== id) return t;
            const updated = { ...t, ...updates, updatedAt: now };
            // 僅在 trackCompleteness !== false 時自動建立快照
            if (updates.completeness !== undefined && t.trackCompleteness !== false) {
              updated.weeklySnapshots = upsertSnapshot(t.weeklySnapshots, getCurrentWeekStart(), updates.completeness);
            }
            return updated;
          });

          // 狀態變更時，遞迴向上傳播父任務狀態
          let autoChange: StatusChangeInfo | null = null;
          if (updates.status !== undefined) {
            const result = propagateStatusToAncestors(newTasks, id);
            newTasks = result.tasks;
            autoChange = result.lastChange;
          }

          return {
            _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
            tasks: newTasks,
            ...(autoChange ? { _lastAutoStatusChange: autoChange } : {}),
          };
        });
      },

      deleteTask: (id) => {
        set((state) => {
          const idsToDelete = new Set([id, ...getAllDescendantIds(state.tasks, id)]);
          return {
            _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
            tasks: state.tasks.filter((t) => !idsToDelete.has(t.id)),
          };
        });
      },

      // Timeslot Actions
      addTimeslot: (data) => {
        const now = Date.now();
        const newTimeslot: Timeslot = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          timeslots: [...state.timeslots, newTimeslot],
        }));
      },

      updateTimeslot: (id, updates) => {
        set((state) => ({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          timeslots: state.timeslots.map(ts => ts.id === id ? { ...ts, ...updates, updatedAt: Date.now() } : ts),
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
          updatedAt: Date.now(),
          outputs: (t.outputs || []).map(o => {
            if (o.id !== outputId) return o;
            const updated = { ...o, ...updates, updatedAt: Date.now() };
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
        members: (data as any).members || [{ id: 'self', name: '', isSelf: true }],
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

      addMember: (name) => set(s => ({
        members: [...s.members, { id: uuidv4(), name }],
      })),
      updateMember: (id, name) => set(s => ({
        members: s.members.map(m => m.id === id ? { ...m, name } : m),
      })),
      deleteMember: (id) => set(s => ({
        members: s.members.filter(m => m.id !== id || m.isSelf),
      })),
      importSettings: (data) => set((state) => ({
        mainCategories: data.mainCategories ?? state.mainCategories,
        subCategories: data.subCategories ?? state.subCategories,
        outputTypes: data.outputTypes ?? state.outputTypes,
        holidays: data.holidays ?? state.holidays,
        members: data.members ?? state.members,
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
            const descIds = [prevSib.id, ...getAllDescendantIds(tasks, prevSib.id)];
            let insertIdx = tasks.findIndex(t => t.id === prevSib.id);
            tasks.forEach((t, i) => { if (descIds.includes(t.id)) insertIdx = i; });
            tasks.splice(insertIdx + 1, 0, updatedTask);
            return { _history: [...state._history.slice(-19), snapshot], tasks };
          }
          return {};
        });
      },

      archiveTask: (id) => {
        const now = Date.now();
        set((state) => {
          const ids = new Set([id, ...getAllDescendantIds(state.tasks, id)]);
          return {
            _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
            tasks: state.tasks.map(t =>
              ids.has(t.id) ? { ...t, archived: true, archivedAt: now } : t
            ),
          };
        });
      },

      unarchiveTask: (id) => {
        set((state) => {
          const ids = new Set([id, ...getAllDescendantIds(state.tasks, id)]);
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
          const doneIds = state.tasks
            .filter(t => (t.status === 'DONE' || t.status === 'CANCELLED') && !t.archived)
            .map(t => t.id);
          const allIds = new Set(
            doneIds.flatMap(id => [id, ...getAllDescendantIds(state.tasks, id)])
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

      updateTaskWeeklyNote: (id, weekStart, note) => {
        set((state) => ({
          tasks: state.tasks.map(t => {
            if (t.id !== id) return t;
            const snaps = t.weeklySnapshots ?? [];
            const idx = snaps.findIndex(s => s.weekStart === weekStart);
            if (idx >= 0) {
              const updated = [...snaps];
              updated[idx] = { ...updated[idx], note: note || undefined };
              return { ...t, weeklySnapshots: updated };
            }
            // 無既有快照時，建立一筆僅含 note 的快照（completeness 取目前值或 0）
            return { ...t, weeklySnapshots: [...snaps, { weekStart, completeness: t.completeness ?? 0, note: note || undefined }] };
          }),
        }));
      },

      mergeImport: (data) => {
        const state = get();
        const stats = { tasksAdded: 0, tasksUpdated: 0, timeslotsAdded: 0, timeslotsUpdated: 0 };

        // Merge tasks
        let mergedTasks = [...state.tasks];
        if (data.tasks) {
          for (const incoming of data.tasks) {
            const idx = mergedTasks.findIndex(t => t.id === incoming.id);
            if (idx === -1) {
              mergedTasks.push(incoming);
              stats.tasksAdded++;
            } else {
              const existing = mergedTasks[idx];
              if ((incoming.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
                mergedTasks[idx] = incoming;
                stats.tasksUpdated++;
              }
            }
          }
        }

        // Merge timeslots
        let mergedTimeslots = [...state.timeslots];
        if (data.timeslots) {
          for (const incoming of data.timeslots) {
            const idx = mergedTimeslots.findIndex(ts => ts.id === incoming.id);
            if (idx === -1) {
              mergedTimeslots.push(incoming);
              stats.timeslotsAdded++;
            } else {
              const existing = mergedTimeslots[idx];
              if ((incoming.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
                mergedTimeslots[idx] = incoming;
                stats.timeslotsUpdated++;
              }
            }
          }
        }

        set({
          _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
          tasks: mergedTasks,
          timeslots: mergedTimeslots,
        });
        return stats;
      },

      _lastAutoStatusChange: null,
      clearLastAutoStatusChange: () => set({ _lastAutoStatusChange: null }),

      getTaskById: (id) => get().tasks.find((t) => t.id === id),
      getSubTasks: (parentId) => get().tasks.filter((t) => t.parentId === parentId),
    }),
    {
      name: 'task-storage',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        timeslots: state.timeslots,
        mainCategories: state.mainCategories,
        subCategories: state.subCategories,
        outputTypes: state.outputTypes,
        holidays: state.holidays,
        members: state.members,
        darkMode: state.darkMode,
      }),
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 1 && Array.isArray(state.tasks)) {
          state.tasks = (state.tasks as Record<string, unknown>[]).map((t) => {
            if (t.ganttDisplayMode === undefined) {
              const mode: GanttDisplayMode = t.showInGantt === false ? 'hidden' : 'bar';
              const { showInGantt: _, ...rest } = t;
              return { ...rest, ganttDisplayMode: mode };
            }
            return t;
          });
        }
        if (version < 2) {
          const now = Date.now();
          if (Array.isArray(state.tasks)) {
            state.tasks = (state.tasks as Record<string, unknown>[]).map((t) =>
              t.createdAt == null ? { ...t, createdAt: now, updatedAt: now } : t
            );
          }
          if (Array.isArray(state.timeslots)) {
            state.timeslots = (state.timeslots as Record<string, unknown>[]).map((ts) =>
              ts.createdAt == null ? { ...ts, createdAt: now, updatedAt: now } : ts
            );
          }
        }
        return state;
      },
    }
  )
);
