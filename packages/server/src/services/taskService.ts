import { randomUUID } from 'crypto';
import { format, startOfWeek } from 'date-fns';
import type { Task, Timeslot, TodoItem, WorkOutput, WeeklySnapshot, OutputType, Member, JsonImportTask } from '@tt/shared/types';
import { getAllDescendantIds, propagateStatusToAncestors } from '@tt/shared/utils/taskHierarchy';
import type { AppData } from '../store/fileStore.js';

const getCurrentWeekStart = (): string =>
  format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');

const upsertSnapshot = (snapshots: WeeklySnapshot[] = [], weekStart: string, completeness: number, note?: string): WeeklySnapshot[] => {
  const idx = snapshots.findIndex(s => s.weekStart === weekStart);
  const snap: WeeklySnapshot = { weekStart, completeness, ...(note !== undefined && { note }) };
  return idx >= 0 ? snapshots.map((s, i) => i === idx ? snap : s) : [...snapshots, snap];
};

// ── Task operations ───────────────────────────────────────────────

export function addTask(data: AppData, input: Omit<Task, 'id'> & { id?: string }): { data: AppData; task: Task } {
  const now = Date.now();
  const task: Task = {
    ...input,
    id: input.id ?? randomUUID(),
    outputs: input.outputs ?? [],
    labels: input.labels ?? [],
    showInWbs: input.showInWbs ?? true,
    ganttDisplayMode: input.ganttDisplayMode ?? 'bar',
    showInReport: input.showInReport ?? true,
    trackCompleteness: input.trackCompleteness ?? true,
    createdAt: now,
    updatedAt: now,
  };
  return { data: { ...data, tasks: [...data.tasks, task] }, task };
}

export function updateTask(data: AppData, id: string, updates: Partial<Task>): { data: AppData; task: Task | null } {
  const now = Date.now();
  let updated: Task | null = null;
  let tasks = data.tasks.map(t => {
    if (t.id !== id) return t;
    const next = { ...t, ...updates, updatedAt: now };
    if (updates.completeness !== undefined && t.trackCompleteness !== false) {
      next.weeklySnapshots = upsertSnapshot(t.weeklySnapshots, getCurrentWeekStart(), updates.completeness);
    }
    updated = next;
    return next;
  });
  if (updates.status !== undefined && updated) {
    const result = propagateStatusToAncestors(tasks, id);
    tasks = result.tasks;
  }
  return { data: { ...data, tasks }, task: updated };
}

export function deleteTask(data: AppData, id: string): { data: AppData; deletedIds: string[] } {
  const ids = new Set([id, ...getAllDescendantIds(data.tasks, id)]);
  return {
    data: { ...data, tasks: data.tasks.filter(t => !ids.has(t.id)) },
    deletedIds: [...ids],
  };
}

export function duplicateTask(data: AppData, sourceTaskId: string): { data: AppData; task: Task | null } {
  const source = data.tasks.find(t => t.id === sourceTaskId);
  if (!source) return { data, task: null };
  const existingTitles = new Set(data.tasks.map(t => t.title));
  const baseMatch = source.title.match(/^(.*)-(\d+)$/);
  const baseName = baseMatch ? baseMatch[1] : source.title;
  let n = 1;
  while (existingTitles.has(`${baseName}-${n}`)) n++;
  return addTask(data, {
    title: `${baseName}-${n}`,
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
}

export function duplicateSubtree(
  data: AppData,
  sourceTaskId: string,
  prefix: string,
  postfix: string,
  search?: string,
  replace?: string
): { data: AppData; tasks: Task[] } {
  const allTasks = data.tasks;
  const source = allTasks.find(t => t.id === sourceTaskId);
  if (!source) return { data, tasks: [] };
  const now = Date.now();
  const newTasks: Task[] = [];
  const transformTitle = (original: string) => {
    const mid = search ? original.replaceAll(search, replace ?? '') : original;
    return `${prefix}${mid}${postfix}`;
  };
  const cloneNode = (taskId: string, newParentId?: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    const newId = randomUUID();
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
    allTasks.filter(t => t.parentId === taskId && !t.archived).forEach(child => cloneNode(child.id, newId));
  };
  cloneNode(sourceTaskId, source.parentId);
  return { data: { ...data, tasks: [...data.tasks, ...newTasks] }, tasks: newTasks };
}

export function importTasksFromJson(data: AppData, jsonTasks: JsonImportTask[], parentId?: string): { data: AppData; tasks: Task[] } {
  const flatTasks: Task[] = [];
  const now = Date.now();
  const flatten = (items: JsonImportTask[], pid?: string) => {
    for (const item of items) {
      const id = randomUUID();
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
  return { data: { ...data, tasks: [...data.tasks, ...flatTasks] }, tasks: flatTasks };
}

export function reorderTask(data: AppData, id: string, direction: 'up' | 'down' | 'promote' | 'demote'): AppData {
  const tasks = [...data.tasks];
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return data;
  const task = tasks[idx];
  const siblings = tasks.filter(t => t.parentId === task.parentId);
  const sibIdx = siblings.findIndex(t => t.id === id);

  if (direction === 'up') {
    if (sibIdx === 0) return data;
    const prevIdx = tasks.findIndex(t => t.id === siblings[sibIdx - 1].id);
    [tasks[idx], tasks[prevIdx]] = [tasks[prevIdx], tasks[idx]];
    return { ...data, tasks };
  }
  if (direction === 'down') {
    if (sibIdx === siblings.length - 1) return data;
    const nextIdx = tasks.findIndex(t => t.id === siblings[sibIdx + 1].id);
    [tasks[idx], tasks[nextIdx]] = [tasks[nextIdx], tasks[idx]];
    return { ...data, tasks };
  }
  if (direction === 'promote') {
    if (!task.parentId) return data;
    const parent = tasks.find(t => t.id === task.parentId);
    if (!parent) return data;
    const updatedTask = { ...task, parentId: parent.parentId };
    tasks.splice(idx, 1);
    const parentIdx = tasks.findIndex(t => t.id === parent.id);
    tasks.splice(parentIdx + 1, 0, updatedTask);
    return { ...data, tasks };
  }
  if (direction === 'demote') {
    if (sibIdx === 0) return data;
    const prevSib = siblings[sibIdx - 1];
    const updatedTask = { ...task, parentId: prevSib.id };
    tasks.splice(idx, 1);
    const descIds = [prevSib.id, ...getAllDescendantIds(tasks, prevSib.id)];
    let insertIdx = tasks.findIndex(t => t.id === prevSib.id);
    tasks.forEach((t, i) => { if (descIds.includes(t.id)) insertIdx = i; });
    tasks.splice(insertIdx + 1, 0, updatedTask);
    return { ...data, tasks };
  }
  return data;
}

export function archiveTask(data: AppData, id: string): AppData {
  const now = Date.now();
  const ids = new Set([id, ...getAllDescendantIds(data.tasks, id)]);
  return { ...data, tasks: data.tasks.map(t => ids.has(t.id) ? { ...t, archived: true, archivedAt: now } : t) };
}

export function unarchiveTask(data: AppData, id: string): AppData {
  const ids = new Set([id, ...getAllDescendantIds(data.tasks, id)]);
  return { ...data, tasks: data.tasks.map(t => ids.has(t.id) ? { ...t, archived: false, archivedAt: undefined } : t) };
}

export function archiveAllDone(data: AppData): { data: AppData; archived: number } {
  const now = Date.now();
  const doneIds = data.tasks.filter(t => (t.status === 'DONE' || t.status === 'CANCELLED') && !t.archived).map(t => t.id);
  const allIds = new Set(doneIds.flatMap(id => [id, ...getAllDescendantIds(data.tasks, id)]));
  const tasks = data.tasks.map(t => allIds.has(t.id) && !t.archived ? { ...t, archived: true, archivedAt: now } : t);
  return { data: { ...data, tasks }, archived: allIds.size };
}

export function updateTaskSnapshots(data: AppData, id: string, snapshots: WeeklySnapshot[]): AppData {
  return { ...data, tasks: data.tasks.map(t => t.id === id ? { ...t, weeklySnapshots: snapshots } : t) };
}

export function updateTaskWeeklyNote(data: AppData, id: string, weekStart: string, note: string): AppData {
  return {
    ...data,
    tasks: data.tasks.map(t => {
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
  };
}

export function updateWorkOutput(data: AppData, taskId: string, outputId: string, updates: Partial<WorkOutput>): AppData {
  return {
    ...data,
    tasks: data.tasks.map(t => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        updatedAt: Date.now(),
        outputs: (t.outputs || []).map(o => {
          if (o.id !== outputId) return o;
          const updated = { ...o, ...updates };
          if (updates.completeness !== undefined) {
            const val = typeof updates.completeness === 'string' ? parseInt(updates.completeness) || 0 : (updates.completeness ?? 0);
            updated.weeklySnapshots = upsertSnapshot(o.weeklySnapshots, getCurrentWeekStart(), val);
          }
          return updated;
        }),
      };
    }),
  };
}

export function getTaskTotalTime(data: AppData, taskId: string): number {
  return data.timeslots
    .filter(ts => ts.taskId === taskId && ts.endTime)
    .reduce((acc, ts) => acc + (ts.endTime! - ts.startTime), 0);
}

// ── Timeslot operations ───────────────────────────────────────────

export function addTimeslot(data: AppData, input: Omit<Timeslot, 'id'> & { id?: string }): { data: AppData; timeslot: Timeslot } {
  const now = Date.now();
  const timeslot: Timeslot = { ...input, id: input.id ?? randomUUID(), createdAt: now, updatedAt: now };
  return { data: { ...data, timeslots: [...data.timeslots, timeslot] }, timeslot };
}

export function updateTimeslot(data: AppData, id: string, updates: Partial<Timeslot>): { data: AppData; timeslot: Timeslot | null } {
  let updated: Timeslot | null = null;
  const timeslots = data.timeslots.map(ts => {
    if (ts.id !== id) return ts;
    updated = { ...ts, ...updates, updatedAt: Date.now() };
    return updated;
  });
  return { data: { ...data, timeslots }, timeslot: updated };
}

export function deleteTimeslot(data: AppData, id: string): AppData {
  return { ...data, timeslots: data.timeslots.filter(ts => ts.id !== id) };
}

// ── Todo operations ───────────────────────────────────────────────

export function addTodo(data: AppData, description: string, id?: string): { data: AppData; todo: TodoItem } {
  const now = Date.now();
  const todo: TodoItem = {
    id: id ?? randomUUID(),
    description,
    done: false,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    createdAt: now,
    updatedAt: now,
  };
  return { data: { ...data, todos: [...data.todos, todo] }, todo };
}

export function toggleTodo(data: AppData, id: string): AppData {
  const now = Date.now();
  return {
    ...data,
    todos: data.todos.map(t => t.id === id
      ? { ...t, done: !t.done, doneDate: !t.done ? format(new Date(), 'yyyy-MM-dd') : undefined, updatedAt: now }
      : t
    ),
  };
}

export function updateTodo(data: AppData, id: string, updates: Partial<Pick<TodoItem, 'description' | 'startDate' | 'doneDate'>>): AppData {
  return { ...data, todos: data.todos.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t) };
}

export function deleteTodo(data: AppData, id: string): AppData {
  return { ...data, todos: data.todos.filter(t => t.id !== id) };
}

export function clearDoneTodos(data: AppData): AppData {
  return { ...data, todos: data.todos.filter(t => !t.done) };
}

export function importTodos(data: AppData, incoming: TodoItem[]): { data: AppData; added: number; skipped: number } {
  const existingIds = new Set(data.todos.map(t => t.id));
  const toAdd = incoming.filter(t => !existingIds.has(t.id));
  return {
    data: { ...data, todos: [...data.todos, ...toAdd] },
    added: toAdd.length,
    skipped: incoming.length - toAdd.length,
  };
}

// ── Settings operations ───────────────────────────────────────────

export function addMainCategory(data: AppData, name: string): AppData {
  return { ...data, mainCategories: [...new Set([...data.mainCategories, name])] };
}
export function updateMainCategory(data: AppData, oldName: string, newName: string): AppData {
  return {
    ...data,
    mainCategories: data.mainCategories.map(c => c === oldName ? newName : c),
    tasks: data.tasks.map(t => t.mainCategory === oldName ? { ...t, mainCategory: newName } : t),
  };
}
export function deleteMainCategory(data: AppData, name: string): AppData {
  return { ...data, mainCategories: data.mainCategories.filter(c => c !== name) };
}

export function addSubCategory(data: AppData, name: string): AppData {
  return { ...data, subCategories: [...new Set([...data.subCategories, name])] };
}
export function updateSubCategory(data: AppData, oldName: string, newName: string): AppData {
  return {
    ...data,
    subCategories: data.subCategories.map(c => c === oldName ? newName : c),
    timeslots: data.timeslots.map(ts => ts.subCategory === oldName ? { ...ts, subCategory: newName } : ts),
  };
}
export function deleteSubCategory(data: AppData, name: string): AppData {
  return { ...data, subCategories: data.subCategories.filter(c => c !== name) };
}

export function addOutputType(data: AppData, input: Omit<OutputType, 'id'>): { data: AppData; outputType: OutputType } {
  const outputType: OutputType = { ...input, id: randomUUID() };
  return { data: { ...data, outputTypes: [...data.outputTypes, outputType] }, outputType };
}
export function updateOutputType(data: AppData, id: string, updates: Partial<Omit<OutputType, 'id'>>): AppData {
  return { ...data, outputTypes: data.outputTypes.map(ot => ot.id === id ? { ...ot, ...updates } : ot) };
}
export function deleteOutputType(data: AppData, id: string): AppData {
  return { ...data, outputTypes: data.outputTypes.filter(ot => ot.id !== id) };
}

export function addHoliday(data: AppData, date: string): AppData {
  return { ...data, holidays: [...new Set([...data.holidays, date])].sort() };
}
export function deleteHoliday(data: AppData, date: string): AppData {
  return { ...data, holidays: data.holidays.filter(d => d !== date) };
}

export function addMember(data: AppData, name: string): { data: AppData; member: Member } {
  const member: Member = { id: randomUUID(), name };
  return { data: { ...data, members: [...data.members, member] }, member };
}
export function updateMember(data: AppData, id: string, name: string): AppData {
  return { ...data, members: data.members.map(m => m.id === id ? { ...m, name } : m) };
}
export function deleteMember(data: AppData, id: string): AppData {
  return { ...data, members: data.members.filter(m => m.id !== id || m.isSelf) };
}

// ── Merge import ──────────────────────────────────────────────────

export function mergeImport(
  data: AppData,
  incoming: { tasks?: Task[]; timeslots?: Timeslot[] }
): { data: AppData; tasksAdded: number; tasksUpdated: number; timeslotsAdded: number; timeslotsUpdated: number } {
  const stats = { tasksAdded: 0, tasksUpdated: 0, timeslotsAdded: 0, timeslotsUpdated: 0 };
  let tasks = [...data.tasks];
  if (incoming.tasks) {
    for (const t of incoming.tasks) {
      const idx = tasks.findIndex(x => x.id === t.id);
      if (idx === -1) { tasks.push(t); stats.tasksAdded++; }
      else if ((t.updatedAt ?? 0) > (tasks[idx].updatedAt ?? 0)) { tasks[idx] = t; stats.tasksUpdated++; }
    }
  }
  let timeslots = [...data.timeslots];
  if (incoming.timeslots) {
    for (const ts of incoming.timeslots) {
      const idx = timeslots.findIndex(x => x.id === ts.id);
      if (idx === -1) { timeslots.push(ts); stats.timeslotsAdded++; }
      else if ((ts.updatedAt ?? 0) > (timeslots[idx].updatedAt ?? 0)) { timeslots[idx] = ts; stats.timeslotsUpdated++; }
    }
  }
  return { data: { ...data, tasks, timeslots }, ...stats };
}
