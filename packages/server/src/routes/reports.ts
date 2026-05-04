import { Hono } from 'hono';
import { getData } from '../store/fileStore.js';
import { buildFullReportAdoc, buildReportContext, computePeriodSummary } from '@tt/shared/reports/weekly';
import type { ReportType, GanttMode } from '@tt/shared/reports/common';
import { generateCalendarIcs } from '../services/icsService.js';

const app = new Hono();
const ok = <T>(d: T) => ({ ok: true as const, data: d });

function parseAnchorDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseLevels(levelsStr: string | undefined): number[] {
  if (!levelsStr) return [1, 2, 3, 4, 5];
  return levelsStr.split(',').map(Number).filter(n => n >= 1 && n <= 5);
}

function parseExcluded(excludedStr: string | undefined): string[] {
  if (!excludedStr) return [];
  return excludedStr.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * GET /reports/weekly
 * Query: anchorDate=YYYY-MM-DD, format=adoc|json, levels=1,2,3, excluded=cat1,cat2
 *        ganttMode=weekly|workReview, ganttScale=daily|weekly|monthly, ganttZoom=1
 *        showTodayMark=true|false, groupByCategory=true|false
 */
app.get('/weekly', (c) => {
  const q = c.req.query();
  const data = getData();
  const anchorDate = parseAnchorDate(q.anchorDate);
  const fmt = q.format ?? 'adoc';
  const selectedLevels = parseLevels(q.levels);
  const excludedMainCats = parseExcluded(q.excluded);
  const ganttMode = (q.ganttMode as GanttMode) ?? 'weekly';
  const ganttScale = (q.ganttScale as 'daily' | 'weekly' | 'monthly') ?? 'daily';
  const ganttZoom = q.ganttZoom ? parseInt(q.ganttZoom) : 1;
  const showTodayMark = q.showTodayMark !== 'false';
  const groupByCategory = q.groupByCategory === 'true';

  const opts = {
    tasks: data.tasks,
    timeslots: data.timeslots,
    outputTypes: data.outputTypes,
    holidays: data.holidays,
    reportType: 'weekly' as ReportType,
    anchorDate,
    selectedLevels,
    excludedMainCats,
    showTodayMark,
    groupByCategory,
    ganttMode,
    ganttScale,
    ganttZoom,
  };

  if (fmt === 'adoc') {
    const adoc = buildFullReportAdoc(opts);
    c.header('Content-Type', 'text/plain; charset=utf-8');
    return c.body(adoc);
  }

  const ctx = buildReportContext(opts);
  return c.json(ok({
    reportType: 'weekly',
    anchorDate: anchorDate.toISOString(),
    ganttPeriod: { start: ctx.ganttPeriod.start.toISOString(), end: ctx.ganttPeriod.end.toISOString() },
    progressPeriod: { start: ctx.progressPeriod.start.toISOString(), end: ctx.progressPeriod.end.toISOString() },
    prevPeriod: { start: ctx.prevPeriod.start.toISOString(), end: ctx.prevPeriod.end.toISOString() },
    periodLabels: ctx.periodLabels,
    withProgress: ctx.progressSplit.withProgress.map(t => ({ id: t.id, title: t.title, status: t.status })),
    withoutProgress: ctx.progressSplit.withoutProgress.map(t => ({ id: t.id, title: t.title, status: t.status })),
  }));
});

/**
 * GET /reports/bi-monthly
 * Query: anchorDate=YYYY-MM-DD, format=adoc|json
 */
app.get('/bi-monthly', (c) => {
  const q = c.req.query();
  const data = getData();
  const anchorDate = parseAnchorDate(q.anchorDate);
  const fmt = q.format ?? 'adoc';
  const selectedLevels = parseLevels(q.levels);
  const excludedMainCats = parseExcluded(q.excluded);
  const ganttScale = (q.ganttScale as 'daily' | 'weekly' | 'monthly') ?? 'daily';
  const ganttZoom = q.ganttZoom ? parseInt(q.ganttZoom) : 1;

  const opts = {
    tasks: data.tasks,
    timeslots: data.timeslots,
    outputTypes: data.outputTypes,
    holidays: data.holidays,
    reportType: 'bimonthly' as ReportType,
    anchorDate,
    selectedLevels,
    excludedMainCats,
    showTodayMark: q.showTodayMark !== 'false',
    groupByCategory: q.groupByCategory === 'true',
    ganttScale,
    ganttZoom,
  };

  if (fmt === 'adoc') {
    const adoc = buildFullReportAdoc(opts);
    c.header('Content-Type', 'text/plain; charset=utf-8');
    return c.body(adoc);
  }

  const ctx = buildReportContext(opts);
  const summary = computePeriodSummary(
    ctx.progressTasks, data.tasks, data.timeslots, data.outputTypes,
    ctx.progressPeriod, excludedMainCats
  );
  return c.json(ok({ reportType: 'bimonthly', anchorDate: anchorDate.toISOString(), periodLabels: ctx.periodLabels, summary }));
});

/**
 * GET /reports/half-year
 * Query: anchorDate=YYYY-MM-DD, format=adoc|json
 */
app.get('/half-year', (c) => {
  const q = c.req.query();
  const data = getData();
  const anchorDate = parseAnchorDate(q.anchorDate);
  const fmt = q.format ?? 'adoc';
  const selectedLevels = parseLevels(q.levels);
  const excludedMainCats = parseExcluded(q.excluded);
  const ganttScale = (q.ganttScale as 'daily' | 'weekly' | 'monthly') ?? 'weekly';
  const ganttZoom = q.ganttZoom ? parseInt(q.ganttZoom) : 2;

  const opts = {
    tasks: data.tasks,
    timeslots: data.timeslots,
    outputTypes: data.outputTypes,
    holidays: data.holidays,
    reportType: 'semiannual' as ReportType,
    anchorDate,
    selectedLevels,
    excludedMainCats,
    showTodayMark: q.showTodayMark !== 'false',
    groupByCategory: q.groupByCategory === 'true',
    ganttScale,
    ganttZoom,
  };

  if (fmt === 'adoc') {
    const adoc = buildFullReportAdoc(opts);
    c.header('Content-Type', 'text/plain; charset=utf-8');
    return c.body(adoc);
  }

  const ctx = buildReportContext(opts);
  const summary = computePeriodSummary(
    ctx.progressTasks, data.tasks, data.timeslots, data.outputTypes,
    ctx.progressPeriod, excludedMainCats
  );
  return c.json(ok({ reportType: 'semiannual', anchorDate: anchorDate.toISOString(), periodLabels: ctx.periodLabels, summary }));
});

/**
 * GET /reports/calendar.ics
 * Query: from=YYYY-MM-DD, to=YYYY-MM-DD
 */
app.get('/calendar.ics', (c) => {
  const q = c.req.query();
  const data = getData();
  const from = q.from;
  const to = q.to;
  const ics = generateCalendarIcs(data.tasks, data.timeslots, from, to);
  c.header('Content-Type', 'text/calendar; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="calendar.ics"');
  return c.body(ics);
});

export default app;
