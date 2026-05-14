import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button,
  FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton,
} from '@mui/material';
import { Assessment, AccountTree, Timeline, ShowChart, Close } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTaskStore } from '../store/useTaskStore';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Task, WorkOutput } from '@tt/shared/types';
import { useReportPeriod } from './report/useReportPeriod';
import { useReportTasks } from './report/useReportTasks';
import { useReportSources } from './report/useReportSources';
import type { GanttScale } from './report/useReportSources';
import type { ReportType } from '@tt/shared/reports/common';
import { PlantUmlSection } from './report/PlantUmlSection';
import { ReportInfoBar } from './report/ReportInfoBar';
import { ReportSettingsPanel } from './report/ReportSettingsPanel';
import { ProgressTable } from './report/ProgressTable';
import { NoProgressTable } from './report/NoProgressTable';
import { PeriodSummaryPanel } from './report/PeriodSummaryPanel';
import type { ChartTarget } from './report/report.types';

const CHART_COLORS = ['#1976d2', '#e91e63', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548'];

const WeeklyReportPage: React.FC = () => {
  const { tasks, timeslots, mainCategories, holidays, outputTypes, updateTask, updateTaskWeeklyNote } = useTaskStore();

  // ── Hook chain ────────────────────────────────────────────────────────────
  const periods = useReportPeriod();
  const {
    reportType, setReportType, reportAnchorDate, setReportAnchorDate,
    ganttPeriod, progressPeriod, prevPeriod, periodLabels, isCurrentPeriod, navigatePeriod,
  } = periods;

  const reportTasks = useReportTasks({ tasks, timeslots, ganttPeriod, progressPeriod, prevPeriod });
  const {
    selectedLevels, toggleLevel,
    excludedMainCats, toggleMainExclusion,
    activeTasks, progressTasks, progressSplit,
  } = reportTasks;

  const sources = useReportSources({
    reportType, reportAnchorDate, ganttPeriod, progressPeriod, prevPeriod, periodLabels,
    activeTasks, progressTasks, progressSplit, excludedMainCats, selectedLevels,
    tasks, timeslots, holidays, outputTypes,
  });
  const {
    ganttMode, setGanttMode,
    ganttScale, setGanttScale,
    ganttZoom, setGanttZoom,
    showTodayMark, setShowTodayMark,
    groupByCategory, setGroupByCategory,
    showPlantUmlSource, setShowPlantUmlSource,
    settingsExpanded, setSettingsExpanded,
    ganttRange, wbsSource, ganttSource,
    progressAsciiDoc,
    periodSummary,
    handleExportAsciiDoc,
  } = sources;

  // ── Cross-hook callbacks ───────────────────────────────────────────────────
  const onReportTypeChange = (v: ReportType) => {
    setReportType(v);
    setReportAnchorDate(new Date());
    if (v === 'semiannual') { setGanttScale('weekly'); setGanttZoom(2); }
    else { setGanttScale('daily'); setGanttZoom(1); }
  };

  const onGanttScaleChange = (v: GanttScale) => {
    setGanttScale(v);
    setGanttZoom(v === 'monthly' ? 4 : v === 'weekly' ? 2 : 1);
  };

  // ── Note editing state ────────────────────────────────────────────────────
  const [editingNoteTaskId, setEditingNoteTaskId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const handleStartEditNote = (taskId: string, currentNote: string) => {
    setEditingNoteTaskId(taskId);
    setEditingNoteText(currentNote);
  };

  const handleSaveNote = () => {
    if (!editingNoteTaskId) return;
    updateTaskWeeklyNote(editingNoteTaskId, progressSplit.currStartStr, editingNoteText.trim());
    setEditingNoteTaskId(null);
    setEditingNoteText('');
  };

  const handleCancelEditNote = () => setEditingNoteTaskId(null);

  // ── Quick add output state ────────────────────────────────────────────────
  const [quickOutputTask, setQuickOutputTask] = useState<Task | null>(null);
  const [quickOutputName, setQuickOutputName] = useState('');
  const [quickOutputTypeId, setQuickOutputTypeId] = useState('');
  const [quickOutputCompleteness, setQuickOutputCompleteness] = useState<number | ''>('');

  const handleOpenQuickOutput = (task: Task) => {
    setQuickOutputTask(task);
    setQuickOutputName('');
    setQuickOutputTypeId('');
    setQuickOutputCompleteness('');
  };

  const handleSaveQuickOutput = () => {
    if (!quickOutputTask || !quickOutputName.trim()) return;
    const newOutput: WorkOutput = {
      id: uuidv4(),
      name: quickOutputName.trim(),
      outputTypeId: quickOutputTypeId || undefined,
      completeness: quickOutputCompleteness === '' ? '' : String(quickOutputCompleteness),
      effectiveDate: format(progressPeriod.start, 'yyyy-MM-dd'),
      summary: '',
      link: '',
    };
    updateTask(quickOutputTask.id, { outputs: [...quickOutputTask.outputs, newOutput] });
    setQuickOutputTask(null);
  };

  // ── Completeness trend chart state ────────────────────────────────────────
  const [chartTarget, setChartTarget] = useState<ChartTarget | null>(null);

  const chartData = useMemo(() => {
    if (!chartTarget) return [];
    const allDates = new Set<string>();
    chartTarget.taskSnapshots.forEach(s => allDates.add(s.weekStart));
    chartTarget.outputLines.forEach(o => o.snapshots.forEach(s => allDates.add(s.weekStart)));
    return Array.from(allDates).sort().map(date => {
      const point: Record<string, string | number | undefined> = { date: date.slice(5) };
      const ts = chartTarget.taskSnapshots.find(s => s.weekStart === date);
      if (ts !== undefined) point['task'] = ts.completeness;
      chartTarget.outputLines.forEach(o => {
        const snap = o.snapshots.find(s => s.weekStart === date);
        if (snap !== undefined) point[o.name] = snap.completeness;
      });
      return point;
    });
  }, [chartTarget]);

  // ── Derived labels ────────────────────────────────────────────────────────
  const ganttTitle = reportType === 'weekly'
    ? `甘特圖｜${ganttMode === 'weekly' ? '週報模式' : '工作盤點模式'}（${format(ganttRange.start, 'MM/dd')}～${format(ganttRange.end, 'MM/dd')}）`
    : `甘特圖（${format(ganttRange.start, 'MM/dd')}～${format(ganttRange.end, 'MM/dd')}）`;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Assessment fontSize="large" /> 週報素材生成
      </Typography>

      <ReportInfoBar
        reportType={reportType}
        ganttPeriod={ganttPeriod}
        progressPeriod={progressPeriod}
        onExportAsciiDoc={handleExportAsciiDoc}
      />

      <ReportSettingsPanel
        reportType={reportType}
        onReportTypeChange={onReportTypeChange}
        selectedLevels={selectedLevels}
        toggleLevel={toggleLevel}
        excludedMainCats={excludedMainCats}
        toggleMainExclusion={toggleMainExclusion}
        mainCategories={mainCategories}
        ganttMode={ganttMode}
        setGanttMode={setGanttMode}
        ganttScale={ganttScale}
        onGanttScaleChange={onGanttScaleChange}
        ganttZoom={ganttZoom}
        onZoomIn={() => setGanttZoom(z => z + 1)}
        onZoomOut={() => setGanttZoom(z => Math.max(1, z - 1))}
        showTodayMark={showTodayMark}
        setShowTodayMark={setShowTodayMark}
        groupByCategory={groupByCategory}
        setGroupByCategory={setGroupByCategory}
        showPlantUmlSource={showPlantUmlSource}
        setShowPlantUmlSource={setShowPlantUmlSource}
        ganttRange={ganttRange}
        settingsExpanded={settingsExpanded}
        onToggleSettings={() => setSettingsExpanded(v => !v)}
      />

      {/* WBS + Gantt */}
      {reportType === 'bimonthly' && (
        <Paper sx={{ px: 3, py: 1.5, mb: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            ▼ WBS / 甘特圖 — 計畫展望區間：{format(ganttPeriod.start, 'yyyy-MM-dd')} ～ {format(ganttPeriod.end, 'yyyy-MM-dd')}
          </Typography>
        </Paper>
      )}
      <PlantUmlSection title="WBS 階層圖" icon={<AccountTree />} source={wbsSource} showSource={showPlantUmlSource} />
      <PlantUmlSection title={ganttTitle} icon={<Timeline />} source={ganttSource} showSource={showPlantUmlSource} />

      {/* Progress Table */}
      {reportType === 'bimonthly' && (
        <Paper sx={{ px: 3, py: 1.5, mb: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            ▼ 進度追蹤表 — 工作成果區間：{format(progressPeriod.start, 'yyyy-MM-dd')} ～ {format(progressPeriod.end, 'yyyy-MM-dd')}
          </Typography>
        </Paper>
      )}
      <ProgressTable
        progressSplit={progressSplit}
        periodLabels={periodLabels}
        progressPeriod={progressPeriod}
        outputTypes={outputTypes}
        isCurrentPeriod={isCurrentPeriod}
        navigatePeriod={navigatePeriod}
        setReportAnchorDate={setReportAnchorDate}
        progressAsciiDoc={progressAsciiDoc}
        editingNoteTaskId={editingNoteTaskId}
        editingNoteText={editingNoteText}
        setEditingNoteText={setEditingNoteText}
        onStartEditNote={handleStartEditNote}
        onSaveNote={handleSaveNote}
        onCancelEditNote={handleCancelEditNote}
        onOpenQuickOutput={handleOpenQuickOutput}
        onOpenChart={setChartTarget}
      />

      <NoProgressTable
        progressSplit={progressSplit}
        periodLabels={periodLabels}
        progressPeriod={progressPeriod}
        outputTypes={outputTypes}
        editingNoteTaskId={editingNoteTaskId}
        editingNoteText={editingNoteText}
        setEditingNoteText={setEditingNoteText}
        onStartEditNote={handleStartEditNote}
        onSaveNote={handleSaveNote}
        onCancelEditNote={handleCancelEditNote}
        onOpenQuickOutput={handleOpenQuickOutput}
        onOpenChart={setChartTarget}
      />

      {periodSummary && (
        <PeriodSummaryPanel
          periodSummary={periodSummary}
          progressPeriod={progressPeriod}
          outputTypes={outputTypes}
        />
      )}

      {/* Quick add output Dialog */}
      <Dialog open={!!quickOutputTask} onClose={() => setQuickOutputTask(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          新增本期產出
          {quickOutputTask && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              任務：{quickOutputTask.title}　歸屬期間：{format(progressPeriod.start, 'yyyy-MM-dd')}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="產出名稱" fullWidth required autoFocus
              value={quickOutputName}
              onChange={e => setQuickOutputName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && quickOutputName.trim() && handleSaveQuickOutput()}
            />
            <FormControl fullWidth>
              <InputLabel>產出類型</InputLabel>
              <Select value={quickOutputTypeId} label="產出類型" onChange={e => setQuickOutputTypeId(e.target.value)}>
                <MenuItem value=""><em>未分類</em></MenuItem>
                {outputTypes.map(ot => (
                  <MenuItem key={ot.id} value={ot.id}>
                    {ot.name}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      {ot.isTangible ? '（有形）' : '（無形）'}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="完成度 (%)" type="number"
              inputProps={{ min: 0, max: 100, step: 5 }}
              value={quickOutputCompleteness}
              onChange={e => {
                const v = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                setQuickOutputCompleteness(v);
              }}
              sx={{ width: 160 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickOutputTask(null)}>取消</Button>
          <Button variant="contained" disabled={!quickOutputName.trim()} onClick={handleSaveQuickOutput}>新增產出</Button>
        </DialogActions>
      </Dialog>

      {/* Completeness trend Dialog */}
      <Dialog open={!!chartTarget} onClose={() => setChartTarget(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 0.5 }}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShowChart /> 完成度趨勢
            </Typography>
            <Typography variant="body2" color="text.secondary">{chartTarget?.title}</Typography>
          </Box>
          <IconButton onClick={() => setChartTarget(null)}><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          {chartData.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>此任務尚無完成度快照資料</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <ChartTooltip formatter={(v: number | string | readonly (string | number)[] | undefined) => typeof v === 'number' ? `${v}%` : ''} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
                {(chartTarget?.taskSnapshots.length ?? 0) > 0 && (
                  <Line type="monotone" dataKey="task" name="任務整體" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                )}
                {chartTarget?.outputLines
                  .filter(o => o.snapshots.length > 0)
                  .map((o, idx) => (
                    <Line
                      key={o.name} type="monotone" dataKey={o.name} name={o.name}
                      stroke={CHART_COLORS[(idx + 1) % CHART_COLORS.length]}
                      strokeWidth={1.8}
                      strokeDasharray={idx % 2 !== 0 ? '5 3' : undefined}
                      dot={{ r: 3 }} connectNulls
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default WeeklyReportPage;
