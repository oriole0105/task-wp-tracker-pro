import { describe, it, expect } from 'vitest';
import { addTask, updateTask, deleteTask, duplicateTask } from '../taskService.js';
import type { AppData } from '../../store/fileStore.js';

function emptyData(): AppData {
  return {
    tasks: [],
    timeslots: [],
    todos: [],
    mainCategories: [],
    subCategories: [],
    outputTypes: [],
    holidays: [],
    members: [],
    settings: {
      darkMode: false,
      preventDuplicateTaskNames: false,
      quickAddAction: 'timeslot',
    },
  };
}

const BASE_TASK = {
  title: 'Test Task',
  aliasTitle: '',
  description: '',
  mainCategory: 'Dev',
  assignee: '',
  reporter: '',
  status: 'BACKLOG' as const,
  outputs: [],
  labels: [],
  showInWbs: true,
  ganttDisplayMode: 'bar' as const,
};

describe('addTask', () => {
  it('appends a task with provided id', () => {
    const { data, task } = addTask(emptyData(), { ...BASE_TASK, id: 'T001' });
    expect(data.tasks).toHaveLength(1);
    expect(task.id).toBe('T001');
  });

  it('generates a uuid when id is omitted', () => {
    const { data, task } = addTask(emptyData(), BASE_TASK);
    expect(data.tasks).toHaveLength(1);
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('applies default values for optional fields', () => {
    const { task } = addTask(emptyData(), BASE_TASK);
    expect(task.outputs).toEqual([]);
    expect(task.labels).toEqual([]);
    expect(task.showInWbs).toBe(true);
    expect(task.trackCompleteness).toBe(true);
    expect(task.showInReport).toBe(true);
    expect(task.ganttDisplayMode).toBe('bar');
  });

  it('does not mutate the original data', () => {
    const original = emptyData();
    addTask(original, { ...BASE_TASK, id: 'T001' });
    expect(original.tasks).toHaveLength(0);
  });
});

describe('updateTask', () => {
  it('updates fields on the matching task', () => {
    const data = addTask(emptyData(), { ...BASE_TASK, id: 'T001' }).data;
    const { data: next, task } = updateTask(data, 'T001', { title: 'Updated', status: 'IN_PROGRESS' });
    expect(task?.title).toBe('Updated');
    expect(task?.status).toBe('IN_PROGRESS');
    expect(next.tasks[0].title).toBe('Updated');
  });

  it('returns null task when id does not exist', () => {
    const { task } = updateTask(emptyData(), 'NONEXISTENT', { title: 'X' });
    expect(task).toBeNull();
  });

  it('creates a weekly snapshot when completeness changes', () => {
    const data = addTask(emptyData(), { ...BASE_TASK, id: 'T001' }).data;
    const { task } = updateTask(data, 'T001', { completeness: 75 });
    expect(task?.weeklySnapshots).toHaveLength(1);
    expect(task?.weeklySnapshots?.[0].completeness).toBe(75);
  });

  it('does not mutate the original data', () => {
    const data = addTask(emptyData(), { ...BASE_TASK, id: 'T001' }).data;
    updateTask(data, 'T001', { title: 'Changed' });
    expect(data.tasks[0].title).toBe('Test Task');
  });
});

describe('deleteTask', () => {
  it('removes the specified task', () => {
    const data = addTask(emptyData(), { ...BASE_TASK, id: 'T001' }).data;
    const { data: next, deletedIds } = deleteTask(data, 'T001');
    expect(next.tasks).toHaveLength(0);
    expect(deletedIds).toContain('T001');
  });

  it('removes all descendants recursively', () => {
    let data = emptyData();
    data = addTask(data, { ...BASE_TASK, id: 'P001' }).data;
    data = addTask(data, { ...BASE_TASK, id: 'C001', parentId: 'P001' }).data;
    data = addTask(data, { ...BASE_TASK, id: 'C002', parentId: 'P001' }).data;
    data = addTask(data, { ...BASE_TASK, id: 'GC001', parentId: 'C001' }).data;

    const { data: next, deletedIds } = deleteTask(data, 'P001');
    expect(next.tasks).toHaveLength(0);
    expect(deletedIds.sort()).toEqual(['C001', 'C002', 'GC001', 'P001'].sort());
  });

  it('only removes the specified subtree, leaving siblings', () => {
    let data = emptyData();
    data = addTask(data, { ...BASE_TASK, id: 'P001' }).data;
    data = addTask(data, { ...BASE_TASK, id: 'C001', parentId: 'P001' }).data;
    data = addTask(data, { ...BASE_TASK, id: 'SIBLING' }).data;

    const { data: next } = deleteTask(data, 'P001');
    expect(next.tasks).toHaveLength(1);
    expect(next.tasks[0].id).toBe('SIBLING');
  });
});

describe('duplicateTask', () => {
  it('creates a copy with a unique name', () => {
    const data = addTask(emptyData(), { ...BASE_TASK, id: 'T001', title: 'Alpha' }).data;
    const { data: next, task } = duplicateTask(data, 'T001');
    expect(task?.title).toBe('Alpha-1');
    expect(next.tasks).toHaveLength(2);
  });

  it('increments suffix to avoid duplicate names', () => {
    let data = emptyData();
    data = addTask(data, { ...BASE_TASK, id: 'T001', title: 'Alpha' }).data;
    data = addTask(data, { ...BASE_TASK, id: 'T002', title: 'Alpha-1' }).data;
    const { task } = duplicateTask(data, 'T001');
    expect(task?.title).toBe('Alpha-2');
  });

  it('returns null task when source id does not exist', () => {
    const { task } = duplicateTask(emptyData(), 'NONEXISTENT');
    expect(task).toBeNull();
  });
});
