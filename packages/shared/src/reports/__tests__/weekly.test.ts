import { describe, it, expect } from 'vitest';
import { buildFullReportAdoc } from '../weekly.js';
import type { Task, Timeslot, OutputType } from '../../types/index.js';

// Deterministic anchor: 2026-03-17 (Tuesday)
const ANCHOR = new Date('2026-03-17T12:00:00.000Z');

const TASKS: Task[] = [
  {
    id: 'T001',
    title: 'Platform migration',
    aliasTitle: 'Migration',
    description: '',
    mainCategory: 'Development',
    assignee: 'Alice',
    reporter: 'Bob',
    status: 'IN_PROGRESS',
    completeness: 40,
    outputs: [],
    labels: [],
    showInWbs: true,
    ganttDisplayMode: 'bar',
    estimatedStartDate: new Date('2026-03-09').getTime(),
    estimatedEndDate: new Date('2026-03-27').getTime(),
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  {
    id: 'T002',
    title: 'Write unit tests',
    aliasTitle: 'Tests',
    description: '',
    mainCategory: 'Development',
    assignee: 'Alice',
    reporter: 'Alice',
    status: 'TODO',
    completeness: 0,
    parentId: 'T001',
    outputs: [],
    labels: [],
    showInWbs: true,
    ganttDisplayMode: 'bar',
    estimatedStartDate: new Date('2026-03-16').getTime(),
    estimatedEndDate: new Date('2026-03-20').getTime(),
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  {
    id: 'T003',
    title: 'Weekly review meeting',
    aliasTitle: 'Review',
    description: '',
    mainCategory: 'Meeting',
    assignee: 'Alice',
    reporter: 'Bob',
    status: 'DONE',
    completeness: 100,
    outputs: [],
    labels: [],
    showInWbs: true,
    ganttDisplayMode: 'bar',
    showInReport: false,
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
];

const TIMESLOTS: Timeslot[] = [
  {
    id: 'TS001',
    taskId: 'T001',
    subCategory: '程式開發',
    startTime: new Date('2026-03-16T09:00:00').getTime(),
    endTime: new Date('2026-03-16T11:30:00').getTime(),
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
  {
    id: 'TS002',
    taskId: 'T002',
    subCategory: '文件撰寫',
    startTime: new Date('2026-03-17T14:00:00').getTime(),
    endTime: new Date('2026-03-17T15:00:00').getTime(),
    createdAt: 1740000000000,
    updatedAt: 1740000000000,
  },
];

const OUTPUT_TYPES: OutputType[] = [
  { id: 'OT001', name: '程式碼', isTangible: true },
  { id: 'OT002', name: '文件', isTangible: true },
];

describe('buildFullReportAdoc', () => {
  it('generates stable weekly report AsciiDoc', () => {
    const result = buildFullReportAdoc({
      tasks: TASKS,
      timeslots: TIMESLOTS,
      outputTypes: OUTPUT_TYPES,
      holidays: [],
      reportType: 'weekly',
      anchorDate: ANCHOR,
      selectedLevels: [1, 2, 3, 4, 5],
      excludedMainCats: [],
      showTodayMark: false,
      groupByCategory: false,
      ganttMode: 'weekly',
    });

    expect(result).toMatchSnapshot();
  });

  it('excludes a category from the output', () => {
    const result = buildFullReportAdoc({
      tasks: TASKS,
      timeslots: TIMESLOTS,
      outputTypes: OUTPUT_TYPES,
      holidays: [],
      reportType: 'weekly',
      anchorDate: ANCHOR,
      excludedMainCats: ['Meeting'],
      showTodayMark: false,
    });

    expect(result).not.toContain('Weekly review meeting');
    expect(result).toContain('Platform migration');
  });

  it('generates stable bimonthly report AsciiDoc', () => {
    const result = buildFullReportAdoc({
      tasks: TASKS,
      timeslots: TIMESLOTS,
      outputTypes: OUTPUT_TYPES,
      holidays: [],
      reportType: 'bimonthly',
      anchorDate: ANCHOR,
      selectedLevels: [1, 2, 3, 4, 5],
      excludedMainCats: [],
      showTodayMark: false,
    });

    expect(result).toMatchSnapshot();
  });
});
