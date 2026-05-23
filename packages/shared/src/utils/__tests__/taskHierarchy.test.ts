import { describe, it, expect } from 'vitest';
import {
  getAllDescendantIds,
  deriveParentStatus,
  propagateStatusToAncestors,
} from '../taskHierarchy.js';
import type { Task, TaskStatus } from '../../types/index.js';

function task(id: string, status: TaskStatus, parentId?: string): Task {
  return {
    id,
    title: id,
    aliasTitle: '',
    description: '',
    mainCategory: '',
    assignee: '',
    reporter: '',
    status,
    outputs: [],
    labels: [],
    showInWbs: true,
    ganttDisplayMode: 'bar',
    ...(parentId ? { parentId } : {}),
  } as Task;
}

// ── getAllDescendantIds ────────────────────────────────────────────

describe('getAllDescendantIds', () => {
  it('returns empty for leaf task', () => {
    const tasks = [task('A', 'TODO')];
    expect(getAllDescendantIds(tasks, 'A')).toEqual([]);
  });

  it('returns direct children', () => {
    const tasks = [task('P', 'TODO'), task('C1', 'TODO', 'P'), task('C2', 'TODO', 'P')];
    const ids = getAllDescendantIds(tasks, 'P');
    expect(ids.sort()).toEqual(['C1', 'C2']);
  });

  it('returns all descendants recursively', () => {
    const tasks = [
      task('P', 'TODO'),
      task('C1', 'TODO', 'P'),
      task('C1a', 'TODO', 'C1'),
    ];
    const ids = getAllDescendantIds(tasks, 'P');
    expect(ids.sort()).toEqual(['C1', 'C1a']);
  });
});

// ── deriveParentStatus ────────────────────────────────────────────

describe('deriveParentStatus', () => {
  it('all DONE → DONE', () => {
    expect(deriveParentStatus([task('a', 'DONE'), task('b', 'DONE')])).toBe('DONE');
  });

  it('all BACKLOG → BACKLOG', () => {
    expect(deriveParentStatus([task('a', 'BACKLOG'), task('b', 'BACKLOG')])).toBe('BACKLOG');
  });

  it('all TODO → TODO', () => {
    expect(deriveParentStatus([task('a', 'TODO'), task('b', 'TODO')])).toBe('TODO');
  });

  it('BACKLOG + TODO → TODO', () => {
    expect(deriveParentStatus([task('a', 'BACKLOG'), task('b', 'TODO')])).toBe('TODO');
  });

  it('any IN_PROGRESS → IN_PROGRESS', () => {
    expect(deriveParentStatus([task('a', 'DONE'), task('b', 'IN_PROGRESS')])).toBe('IN_PROGRESS');
  });

  it('DONE + TODO → IN_PROGRESS (partial completion)', () => {
    expect(deriveParentStatus([task('a', 'DONE'), task('b', 'TODO')])).toBe('IN_PROGRESS');
  });

  it('DONE + BACKLOG → IN_PROGRESS', () => {
    expect(deriveParentStatus([task('a', 'DONE'), task('b', 'BACKLOG')])).toBe('IN_PROGRESS');
  });

  it('all PAUSED → PAUSED', () => {
    expect(deriveParentStatus([task('a', 'PAUSED'), task('b', 'PAUSED')])).toBe('PAUSED');
  });

  it('PAUSED + TODO → IN_PROGRESS (work has started)', () => {
    expect(deriveParentStatus([task('a', 'PAUSED'), task('b', 'TODO')])).toBe('IN_PROGRESS');
  });

  it('DONE + PAUSED → PAUSED', () => {
    expect(deriveParentStatus([task('a', 'DONE'), task('b', 'PAUSED')])).toBe('PAUSED');
  });

  it('all CANCELLED → null (no auto-update)', () => {
    expect(deriveParentStatus([task('a', 'CANCELLED'), task('b', 'CANCELLED')])).toBeNull();
  });

  it('excludes CANCELLED when computing effective children', () => {
    // DONE + CANCELLED → treat as all-DONE
    expect(deriveParentStatus([task('a', 'DONE'), task('b', 'CANCELLED')])).toBe('DONE');
  });
});

// ── propagateStatusToAncestors ────────────────────────────────────

describe('propagateStatusToAncestors', () => {
  it('no-op for root task (no parent)', () => {
    const tasks = [task('A', 'DONE')];
    const { tasks: result, lastChange } = propagateStatusToAncestors(tasks, 'A');
    expect(result).toEqual(tasks);
    expect(lastChange).toBeNull();
  });

  it('updates parent when all children are DONE', () => {
    const tasks = [
      task('P', 'TODO'),
      task('C1', 'DONE', 'P'),
      task('C2', 'DONE', 'P'),
    ];
    const { tasks: result, lastChange } = propagateStatusToAncestors(tasks, 'C1');
    const parent = result.find(t => t.id === 'P')!;
    expect(parent.status).toBe('DONE');
    expect(lastChange?.newStatus).toBe('DONE');
  });

  it('propagates up two levels', () => {
    const tasks = [
      task('G', 'TODO'),
      task('P', 'TODO', 'G'),
      task('C', 'DONE', 'P'),
    ];
    const { tasks: result } = propagateStatusToAncestors(tasks, 'C');
    expect(result.find(t => t.id === 'P')!.status).toBe('DONE');
    expect(result.find(t => t.id === 'G')!.status).toBe('DONE');
  });

  it('does not mutate the input array', () => {
    const tasks = [task('P', 'TODO'), task('C', 'DONE', 'P')];
    const original = tasks.map(t => ({ ...t }));
    propagateStatusToAncestors(tasks, 'C');
    expect(tasks).toEqual(original);
  });

  it('no update when parent status already matches derived', () => {
    const tasks = [
      task('P', 'DONE'),
      task('C1', 'DONE', 'P'),
      task('C2', 'DONE', 'P'),
    ];
    const { tasks: result, lastChange } = propagateStatusToAncestors(tasks, 'C1');
    expect(result.find(t => t.id === 'P')!.status).toBe('DONE');
    expect(lastChange).toBeNull();
  });
});
