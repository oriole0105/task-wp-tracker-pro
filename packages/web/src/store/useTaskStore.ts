import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { format, startOfWeek } from 'date-fns';
import type { Task, CategoryData, WorkOutput, Timeslot, OutputType, WeeklySnapshot, Member, JsonImportTask, TodoItem } from '@tt/shared/types';
import { getAllDescendantIds, propagateStatusToAncestors, type StatusChangeInfo } from '@tt/shared/utils/taskHierarchy';
import { api, fireSync } from '../services/apiClient';

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

export type ServerExportData = {
  tasks: Task[];
  timeslots: Timeslot[];
  todos: TodoItem[];
  mainCategories: string[];
  subCategories: string[];
  outputTypes: OutputType[];
  holidays: string[];
  members: Member[];
  settings?: { darkMode?: boolean; preventDuplicateTaskNames?: boolean; quickAddAction?: string };
};

interface TaskState {
  tasks: Task[];
  timeslots: Timeslot[];
  todos: TodoItem[];
  mainCategories: string[];
  subCategories: string[];
  outputTypes: OutputType[];
  holidays: string[];
  members: Member[];

  _history: HistorySnapshot[];

  darkMode: boolean;
  preventDuplicateTaskNames: boolean;

  // API sync state
  _hydrated: boolean;
  _offline: boolean;
  _bootstrapRequired: boolean;
  _hydrate: (data: ServerExportData) => void;
  _setOffline: (v: boolean) => void;
  _setBootstrapRequired: (v: boolean) => void;

  // Task Actions
  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (sourceTaskId: string) => void;
  duplicateSubtree: (sourceTaskId: string, prefix: string, postfix: string, search?: string, replace?: string) => void;
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
  togglePreventDuplicateTaskNames: () => void;

  reorderTask: (id: string, direction: 'up' | 'down' | 'promote' | 'demote') => void;

  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  archiveAllDone: () => void;

  updateTaskSnapshots: (id: string, snapshots: WeeklySnapshot[]) => void;
  updateTaskWeeklyNote: (id: string, weekStart: string, note: string) => void;

  getTaskById: (id: string) => Task | undefined;
  getSubTasks: (parentId: string) => Task[];

  _lastAutoStatusChange: StatusChangeInfo | null;
  clearLastAutoStatusChange: () => void;

  mergeImport: (data: { tasks?: Task[], timeslots?: Timeslot[] }) => { tasksAdded: number; tasksUpdated: number; timeslotsAdded: number; timeslotsUpdated: number };

  // Todo Actions
  addTodo: (description: string) => void;
  toggleTodo: (id: string) => void;
  updateTodo: (id: string, updates: Partial<Pick<TodoItem, 'description' | 'startDate' | 'doneDate'>>) => void;
  deleteTodo: (id: string) => void;
  clearDoneTodos: () => void;
  importTodos: (incoming: TodoItem[]) => { added: number; skipped: number };

  quickAddAction: 'task' | 'timeslot' | null;
  setQuickAddAction: (action: 'task' | 'timeslot' | null) => void;
}

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  timeslots: [],
  todos: [],
  mainCategories: ['Development', 'Meeting', 'General'],
  subCategories: ['固定會議', '臨時會議', '議題討論', '思考規劃', '閱讀學習', '文件撰寫', '程式開發', '程式碼審查', 'Debug/問題排查'],
  outputTypes: DEFAULT_OUTPUT_TYPES,
  holidays: [],
  members: [{ id: 'self', name: '', isSelf: true }],
  _history: [],
  darkMode: false,
  preventDuplicateTaskNames: true,
  quickAddAction: null,
  _hydrated: false,
  _offline: false,
  _bootstrapRequired: false,
  _lastAutoStatusChange: null,

  setQuickAddAction: (action) => set({ quickAddAction: action }),

  _hydrate: (serverData) => {
    set({
      tasks: serverData.tasks ?? [],
      timeslots: serverData.timeslots ?? [],
      todos: serverData.todos ?? [],
      mainCategories: serverData.mainCategories ?? [],
      subCategories: serverData.subCategories ?? [],
      outputTypes: serverData.outputTypes ?? DEFAULT_OUTPUT_TYPES,
      holidays: serverData.holidays ?? [],
      members: serverData.members ?? [{ id: 'self', name: '', isSelf: true }],
      darkMode: serverData.settings?.darkMode ?? false,
      preventDuplicateTaskNames: serverData.settings?.preventDuplicateTaskNames ?? true,
      _hydrated: true,
      _offline: false,
      _bootstrapRequired: false,
    });
  },

  _setOffline: (v) => set({ _offline: v }),
  _setBootstrapRequired: (v) => set({ _bootstrapRequired: v }),

  addTask: (taskData) => {
    const now = Date.now();
    const id = uuidv4();
    const newTask: Task = {
      ...taskData,
      id,
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
    fireSync(api.post('/tasks', newTask));
  },

  duplicateTask: (sourceTaskId) => {
    const source = get().tasks.find(t => t.id === sourceTaskId);
    if (!source) return;
    const { tasks: allTasks, preventDuplicateTaskNames } = get();
    let newTitle: string;
    if (preventDuplicateTaskNames) {
      const existingTitles = new Set(allTasks.map(t => t.title));
      const baseMatch = source.title.match(/^(.*)-(\d+)$/);
      const baseName = baseMatch ? baseMatch[1] : source.title;
      let n = 1;
      while (existingTitles.has(`${baseName}-${n}`)) n++;
      newTitle = `${baseName}-${n}`;
    } else {
      newTitle = `${source.title}-1`;
    }
    get().addTask({
      title: newTitle,
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

  duplicateSubtree: (sourceTaskId, prefix, postfix, search, replace) => {
    const allTasks = get().tasks;
    const source = allTasks.find(t => t.id === sourceTaskId);
    if (!source) return;
    const now = Date.now();
    const newTasks: Task[] = [];
    const transformTitle = (original: string) => {
      const mid = search ? original.replaceAll(search, replace ?? '') : original;
      return `${prefix}${mid}${postfix}`;
    };
    const cloneNode = (taskId: string, newParentId?: string) => {
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;
      const newId = uuidv4();
      newTasks.push({
        ...task,
        id: newId,
        title: transformTitle(task.title),
        parentId: newParentId,
        status: 'BACKLOG',
        outputs: [],
        milestones: [],
        weeklySnapshots: [],
        actualStartDate: undefined,
        actualEndDate: undefined,
        createdAt: now,
        updatedAt: now,
      });
      allTasks
        .filter(t => t.parentId === taskId && !t.archived)
        .forEach(child => cloneNode(child.id, newId));
    };
    cloneNode(sourceTaskId, source.parentId);
    set((state) => ({
      _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
      tasks: [...state.tasks, ...newTasks],
    }));
    // Server generates its own UUIDs; SSE event will trigger re-hydration to sync
    fireSync(api.post(`/tasks/${sourceTaskId}/duplicate-subtree`, { prefix, postfix, search, replace }));
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
        if (item.children?.length) flatten(item.children, id);
      }
    };
    flatten(jsonTasks, parentId);
    set((state) => ({
      _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
      tasks: [...state.tasks, ...flatTasks],
    }));
    fireSync(api.post('/tasks/import', { tasks: jsonTasks, parentId }));
  },

  updateTask: (id, updates) => {
    set((state) => {
      const now = Date.now();
      let newTasks = state.tasks.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates, updatedAt: now };
        if (updates.completeness !== undefined && t.trackCompleteness !== false) {
          updated.weeklySnapshots = upsertSnapshot(t.weeklySnapshots, getCurrentWeekStart(), updates.completeness);
        }
        return updated;
      });
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
    fireSync(api.patch(`/tasks/${id}`, updates));
  },

  deleteTask: (id) => {
    set((state) => {
      const idsToDelete = new Set([id, ...getAllDescendantIds(state.tasks, id)]);
      return {
        _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
        tasks: state.tasks.filter((t) => !idsToDelete.has(t.id)),
      };
    });
    fireSync(api.delete(`/tasks/${id}`));
  },

  addTimeslot: (data) => {
    const now = Date.now();
    const id = uuidv4();
    const newTimeslot: Timeslot = { ...data, id, createdAt: now, updatedAt: now };
    set((state) => ({
      _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
      timeslots: [...state.timeslots, newTimeslot],
    }));
    fireSync(api.post('/timeslots', newTimeslot));
  },

  updateTimeslot: (id, updates) => {
    set((state) => ({
      _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
      timeslots: state.timeslots.map(ts => ts.id === id ? { ...ts, ...updates, updatedAt: Date.now() } : ts),
    }));
    fireSync(api.patch(`/timeslots/${id}`, updates));
  },

  deleteTimeslot: (id) => {
    set((state) => ({
      _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
      timeslots: state.timeslots.filter(ts => ts.id !== id),
    }));
    fireSync(api.delete(`/timeslots/${id}`));
  },

  getTaskTotalTime: (taskId) => {
    const { timeslots } = get();
    return timeslots
      .filter(ts => ts.taskId === taskId && ts.endTime)
      .reduce((acc, ts) => acc + (ts.endTime! - ts.startTime), 0);
  },

  addMainCategory: (name) => {
    set(s => ({ mainCategories: [...new Set([...s.mainCategories, name])] }));
    fireSync(api.post('/categories/main', { name }));
  },

  updateMainCategory: (old, newVal) => {
    set(s => ({
      mainCategories: s.mainCategories.map(c => c === old ? newVal : c),
      tasks: s.tasks.map(t => t.mainCategory === old ? { ...t, mainCategory: newVal } : t),
    }));
    fireSync(api.patch(`/categories/main/${encodeURIComponent(old)}`, { name: newVal }));
  },

  deleteMainCategory: (name) => {
    set(s => ({ mainCategories: s.mainCategories.filter(c => c !== name) }));
    fireSync(api.delete(`/categories/main/${encodeURIComponent(name)}`));
  },

  addSubCategory: (name) => {
    set(s => ({ subCategories: [...new Set([...s.subCategories, name])] }));
    fireSync(api.post('/categories/sub', { name }));
  },

  updateSubCategory: (old, newVal) => {
    set(s => ({
      subCategories: s.subCategories.map(c => c === old ? newVal : c),
      timeslots: s.timeslots.map(ts => ts.subCategory === old ? { ...ts, subCategory: newVal } : ts),
    }));
    fireSync(api.patch(`/categories/sub/${encodeURIComponent(old)}`, { name: newVal }));
  },

  deleteSubCategory: (name) => {
    set(s => ({ subCategories: s.subCategories.filter(c => c !== name) }));
    fireSync(api.delete(`/categories/sub/${encodeURIComponent(name)}`));
  },

  updateWorkOutput: (taskId, outputId, updates) => {
    set(s => ({
      tasks: s.tasks.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          updatedAt: Date.now(),
          outputs: (t.outputs || []).map(o => {
            if (o.id !== outputId) return o;
            const updated = { ...o, ...updates };
            if (updates.completeness !== undefined) {
              const val = parseInt(updates.completeness ?? '0') || 0;
              updated.weeklySnapshots = upsertSnapshot(o.weeklySnapshots, getCurrentWeekStart(), val);
            }
            return updated;
          }),
        };
      }),
    }));
    fireSync(api.patch(`/tasks/${taskId}/outputs/${outputId}`, updates));
  },

  importCategories: (data) => {
    set({ mainCategories: data.mainCategories, subCategories: data.subCategories });
    fireSync(api.post('/data/import-settings', { mainCategories: data.mainCategories, subCategories: data.subCategories }));
  },

  importFullData: (data) => {
    set({
      _history: [],
      tasks: data.tasks || [],
      timeslots: data.timeslots || [],
      mainCategories: data.mainCategories || [],
      subCategories: data.subCategories || [],
      outputTypes: data.outputTypes || DEFAULT_OUTPUT_TYPES,
      holidays: data.holidays || [],
      members: (data as Record<string, unknown>).members as Member[] || [{ id: 'self', name: '', isSelf: true }],
    });
    fireSync(api.post('/data/import', data));
  },

  addOutputType: (data) => {
    const id = uuidv4();
    set(s => ({ outputTypes: [...s.outputTypes, { ...data, id }] }));
    fireSync(api.post('/output-types', data));
  },

  updateOutputType: (id, updates) => {
    set(s => ({ outputTypes: s.outputTypes.map(ot => ot.id === id ? { ...ot, ...updates } : ot) }));
    fireSync(api.patch(`/output-types/${id}`, updates));
  },

  deleteOutputType: (id) => {
    set(s => ({ outputTypes: s.outputTypes.filter(ot => ot.id !== id) }));
    fireSync(api.delete(`/output-types/${id}`));
  },

  addHoliday: (date) => {
    set(s => ({ holidays: [...new Set([...s.holidays, date])].sort() }));
    fireSync(api.post('/holidays', { date }));
  },

  deleteHoliday: (date) => {
    set(s => ({ holidays: s.holidays.filter(d => d !== date) }));
    fireSync(api.delete(`/holidays/${date}`));
  },

  addMember: (name) => {
    const id = uuidv4();
    set(s => ({ members: [...s.members, { id, name }] }));
    fireSync(api.post('/members', { name }));
  },

  updateMember: (id, name) => {
    set(s => ({ members: s.members.map(m => m.id === id ? { ...m, name } : m) }));
    fireSync(api.patch(`/members/${id}`, { name }));
  },

  deleteMember: (id) => {
    set(s => ({ members: s.members.filter(m => m.id !== id || m.isSelf) }));
    fireSync(api.delete(`/members/${id}`));
  },

  importSettings: (data) => {
    set((state) => ({
      mainCategories: data.mainCategories ?? state.mainCategories,
      subCategories: data.subCategories ?? state.subCategories,
      outputTypes: data.outputTypes ?? state.outputTypes,
      holidays: data.holidays ?? state.holidays,
      members: data.members ?? state.members,
    }));
    fireSync(api.post('/data/import-settings', data));
  },

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
    fireSync(api.post(`/tasks/${id}/reorder`, { direction }));
  },

  archiveTask: (id) => {
    const now = Date.now();
    set((state) => {
      const ids = new Set([id, ...getAllDescendantIds(state.tasks, id)]);
      return {
        _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
        tasks: state.tasks.map(t => ids.has(t.id) ? { ...t, archived: true, archivedAt: now } : t),
      };
    });
    fireSync(api.post(`/tasks/${id}/archive`));
  },

  unarchiveTask: (id) => {
    set((state) => {
      const ids = new Set([id, ...getAllDescendantIds(state.tasks, id)]);
      return {
        _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
        tasks: state.tasks.map(t => ids.has(t.id) ? { ...t, archived: false, archivedAt: undefined } : t),
      };
    });
    fireSync(api.post(`/tasks/${id}/unarchive`));
  },

  archiveAllDone: () => {
    const now = Date.now();
    set((state) => {
      const doneIds = state.tasks
        .filter(t => (t.status === 'DONE' || t.status === 'CANCELLED') && !t.archived)
        .map(t => t.id);
      const allIds = new Set(doneIds.flatMap(id => [id, ...getAllDescendantIds(state.tasks, id)]));
      return {
        _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
        tasks: state.tasks.map(t => allIds.has(t.id) && !t.archived ? { ...t, archived: true, archivedAt: now } : t),
      };
    });
    fireSync(api.post('/tasks/archive-all-done'));
  },

  undo: () => {
    const history = get()._history;
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({ tasks: prev.tasks, timeslots: prev.timeslots, _history: history.slice(0, -1) });
    // Undo is local-only; server state is not reverted
  },

  toggleDarkMode: () => {
    const next = !get().darkMode;
    set({ darkMode: next });
    fireSync(api.patch('/settings', { darkMode: next }));
  },

  togglePreventDuplicateTaskNames: () => {
    const next = !get().preventDuplicateTaskNames;
    set({ preventDuplicateTaskNames: next });
    fireSync(api.patch('/settings', { preventDuplicateTaskNames: next }));
  },

  updateTaskSnapshots: (id, snapshots) => {
    set((state) => ({
      _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
      tasks: state.tasks.map(t => t.id === id ? { ...t, weeklySnapshots: snapshots } : t),
    }));
    fireSync(api.patch(`/tasks/${id}/snapshots`, snapshots));
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
        return { ...t, weeklySnapshots: [...snaps, { weekStart, completeness: t.completeness ?? 0, note: note || undefined }] };
      }),
    }));
    fireSync(api.patch(`/tasks/${id}/weekly-note`, { weekStart, note }));
  },

  mergeImport: (data) => {
    const state = get();
    const stats = { tasksAdded: 0, tasksUpdated: 0, timeslotsAdded: 0, timeslotsUpdated: 0 };
    let mergedTasks = [...state.tasks];
    if (data.tasks) {
      for (const incoming of data.tasks) {
        const idx = mergedTasks.findIndex(t => t.id === incoming.id);
        if (idx === -1) { mergedTasks.push(incoming); stats.tasksAdded++; }
        else if ((incoming.updatedAt ?? 0) > (mergedTasks[idx].updatedAt ?? 0)) { mergedTasks[idx] = incoming; stats.tasksUpdated++; }
      }
    }
    let mergedTimeslots = [...state.timeslots];
    if (data.timeslots) {
      for (const incoming of data.timeslots) {
        const idx = mergedTimeslots.findIndex(ts => ts.id === incoming.id);
        if (idx === -1) { mergedTimeslots.push(incoming); stats.timeslotsAdded++; }
        else if ((incoming.updatedAt ?? 0) > (mergedTimeslots[idx].updatedAt ?? 0)) { mergedTimeslots[idx] = incoming; stats.timeslotsUpdated++; }
      }
    }
    set({
      _history: [...state._history.slice(-19), { tasks: state.tasks, timeslots: state.timeslots }],
      tasks: mergedTasks,
      timeslots: mergedTimeslots,
    });
    fireSync(api.post('/data/merge', data));
    return stats;
  },

  addTodo: (description) => {
    const now = Date.now();
    const id = uuidv4();
    const newTodo: TodoItem = {
      id,
      description,
      done: false,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ todos: [...state.todos, newTodo] }));
    fireSync(api.post('/todos', { description, id }));
  },

  toggleTodo: (id) => {
    const now = Date.now();
    set((state) => ({
      todos: state.todos.map((t) =>
        t.id === id
          ? { ...t, done: !t.done, doneDate: !t.done ? format(new Date(), 'yyyy-MM-dd') : undefined, updatedAt: now }
          : t
      ),
    }));
    fireSync(api.post(`/todos/${id}/toggle`));
  },

  updateTodo: (id, updates) => {
    const now = Date.now();
    set((state) => ({
      todos: state.todos.map((t) => t.id === id ? { ...t, ...updates, updatedAt: now } : t),
    }));
    fireSync(api.patch(`/todos/${id}`, updates));
  },

  deleteTodo: (id) => {
    set((state) => ({ todos: state.todos.filter((t) => t.id !== id) }));
    fireSync(api.delete(`/todos/${id}`));
  },

  clearDoneTodos: () => {
    set((state) => ({ todos: state.todos.filter((t) => !t.done) }));
    fireSync(api.post('/todos/clear-done'));
  },

  importTodos: (incoming) => {
    const existingIds = new Set(get().todos.map((t) => t.id));
    const toAdd = incoming.filter((t) => !existingIds.has(t.id));
    if (toAdd.length > 0) set((state) => ({ todos: [...state.todos, ...toAdd] }));
    fireSync(api.post('/todos/import', incoming));
    return { added: toAdd.length, skipped: incoming.length - toAdd.length };
  },

  clearLastAutoStatusChange: () => set({ _lastAutoStatusChange: null }),

  getTaskById: (id) => get().tasks.find((t) => t.id === id),
  getSubTasks: (parentId) => get().tasks.filter((t) => t.parentId === parentId),
}));
