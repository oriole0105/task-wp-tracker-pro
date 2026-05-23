import { describe, it, expect } from 'vitest';
import { computeTaskWbsMap, computeTaskWbsNumbers } from '../wbs.js';
import type { Task } from '../../types/index.js';

function task(id: string, parentId?: string): Task {
  return {
    id,
    title: id,
    aliasTitle: '',
    description: '',
    mainCategory: '',
    assignee: '',
    reporter: '',
    status: 'TODO',
    outputs: [],
    labels: [],
    showInWbs: true,
    ganttDisplayMode: 'bar',
    ...(parentId ? { parentId } : {}),
  } as Task;
}

describe('computeTaskWbsMap', () => {
  it('empty array returns empty map and sorted list', () => {
    const { wbsNumbers, sorted } = computeTaskWbsMap([]);
    expect(wbsNumbers.size).toBe(0);
    expect(sorted).toHaveLength(0);
  });

  it('flat list numbers 1, 2, 3 in original order', () => {
    const tasks = [task('A'), task('B'), task('C')];
    const { wbsNumbers, sorted } = computeTaskWbsMap(tasks);
    expect(wbsNumbers.get('A')).toBe('1');
    expect(wbsNumbers.get('B')).toBe('2');
    expect(wbsNumbers.get('C')).toBe('3');
    expect(sorted.map(t => t.id)).toEqual(['A', 'B', 'C']);
  });

  it('two-level hierarchy assigns dotted numbers', () => {
    const tasks = [task('P'), task('C1', 'P'), task('C2', 'P')];
    const { wbsNumbers } = computeTaskWbsMap(tasks);
    expect(wbsNumbers.get('P')).toBe('1');
    expect(wbsNumbers.get('C1')).toBe('1.1');
    expect(wbsNumbers.get('C2')).toBe('1.2');
  });

  it('sorted interleaves children immediately after parent', () => {
    const tasks = [task('P'), task('C1', 'P'), task('C2', 'P'), task('Q')];
    const { sorted } = computeTaskWbsMap(tasks);
    expect(sorted.map(t => t.id)).toEqual(['P', 'C1', 'C2', 'Q']);
  });

  it('three-level nesting', () => {
    const tasks = [task('A'), task('A1', 'A'), task('A1a', 'A1')];
    const { wbsNumbers } = computeTaskWbsMap(tasks);
    expect(wbsNumbers.get('A')).toBe('1');
    expect(wbsNumbers.get('A1')).toBe('1.1');
    expect(wbsNumbers.get('A1a')).toBe('1.1.1');
  });

  it('multiple roots with children', () => {
    const tasks = [
      task('P1'), task('C1', 'P1'), task('C2', 'P1'),
      task('P2'), task('D1', 'P2'),
    ];
    const { wbsNumbers } = computeTaskWbsMap(tasks);
    expect(wbsNumbers.get('P1')).toBe('1');
    expect(wbsNumbers.get('C1')).toBe('1.1');
    expect(wbsNumbers.get('C2')).toBe('1.2');
    expect(wbsNumbers.get('P2')).toBe('2');
    expect(wbsNumbers.get('D1')).toBe('2.1');
  });

  it('orphan task (parent absent) continues root counter', () => {
    // 'ghost' is not in the tasks array — orphan child should be treated as root
    const tasks = [task('A'), task('orphan', 'ghost')];
    const { wbsNumbers } = computeTaskWbsMap(tasks);
    expect(wbsNumbers.get('A')).toBe('1');
    expect(wbsNumbers.get('orphan')).toBe('2');
  });

  it('does not mutate the input array', () => {
    const tasks = [task('A'), task('B')];
    const original = [...tasks];
    computeTaskWbsMap(tasks);
    expect(tasks).toEqual(original);
  });
});

describe('computeTaskWbsNumbers', () => {
  it('returns same wbsNumbers map as computeTaskWbsMap', () => {
    const tasks = [task('A'), task('B', 'A')];
    const fromMap = computeTaskWbsMap(tasks).wbsNumbers;
    const fromCompat = computeTaskWbsNumbers(tasks);
    expect(fromCompat).toEqual(fromMap);
  });
});
