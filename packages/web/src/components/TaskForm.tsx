import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Grid, Box, Typography, IconButton, Paper, Divider, Chip,
  FormControlLabel, Checkbox, Collapse, Tooltip, Radio, RadioGroup, FormLabel,
  ToggleButton, ToggleButtonGroup, useTheme, useMediaQuery, AppBar, Toolbar,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { Add, Delete, ContentCopy, Link as LinkIcon, Label as LabelIcon, AccountTree, InfoOutlined, ExpandMore, ExpandLess, Close } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatus, WorkOutput, WeeklySnapshot, Milestone, TaskTimelineEntry } from '@tt/shared/types';
import { useTaskStore } from '../store/useTaskStore';
import { getTaskActualStart, getTaskActualEnd } from '@tt/shared/utils/taskDateUtils';
import { computeTaskWbsMap } from '@tt/shared/utils/wbs';

const CHART_COLORS = ['#1976d2', '#e91e63', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548'];

const MILESTONE_COLORS: { value: string; label: string; css: string }[] = [
  { value: 'Red',        label: '紅',  css: '#f44336' },
  { value: 'Orange',     label: '橙',  css: '#ff9800' },
  { value: 'Gold',       label: '金',  css: '#ffc107' },
  { value: 'LimeGreen',  label: '草綠', css: '#8bc34a' },
  { value: 'DeepSkyBlue',label: '藍',  css: '#03a9f4' },
  { value: 'Violet',     label: '紫',  css: '#9c27b0' },
  { value: 'HotPink',    label: '粉',  css: '#e91e63' },
  { value: 'Silver',     label: '灰',  css: '#9e9e9e' },
];

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: Task;
  parentId?: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({ open, onClose, initialData, parentId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { tasks, timeslots, mainCategories, outputTypes, members, addTask, updateTask, updateTaskSnapshots, getTaskById } = useTaskStore();
  const memberNames = members.map(m => m.name).filter(n => n.trim() !== '');

  const [title, setTitle] = useState('');
  const [aliasTitle, setAliasTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainCategory, setMainCategory] = useState('');
  const [estimatedStartDate, setEstimatedStartDate] = useState<Date | null>(null);
  const [estimatedEndDate, setEstimatedEndDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState('');
  const [reporter, setReporter] = useState('');
  const [status, setStatus] = useState<TaskStatus>('BACKLOG');
  const [completeness, setCompleteness] = useState<number | ''>('');
  const [showInWbs, setShowInWbs] = useState(true);
  const [ganttDisplayMode, setGanttDisplayMode] = useState<'bar' | 'section' | 'hidden'>('bar');
  const [showInReport, setShowInReport] = useState(true);
  const [dateError, setDateError] = useState(false);
  const [outputs, setOutputs] = useState<WorkOutput[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [pauseReasonError, setPauseReasonError] = useState(false);
  const [trackCompleteness, setTrackCompleteness] = useState(true);
  const [completenessType, setCompletenessType] = useState<'real' | 'confidence'>('confidence');
  const [currentParentId, setCurrentParentId] = useState<string>('');

  // --- Timeline entries state ---
  const [timelineEntries, setTimelineEntries] = useState<TaskTimelineEntry[]>([]);
  const [newTimelineDate, setNewTimelineDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newTimelineContent, setNewTimelineContent] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);

  // --- Snapshot management state ---
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 任務快照：立即存 store，從 store reactive 讀（edit mode only）
  const [showTaskSnapshots, setShowTaskSnapshots] = useState(false);
  const [newSnapDate, setNewSnapDate] = useState<Date | null>(null);
  const [newSnapValue, setNewSnapValue] = useState<number | ''>('');
  // 產出快照：local state，隨儲存任務一起存
  const [expandedOutputSnaps, setExpandedOutputSnaps] = useState<Set<string>>(new Set());
  const [newOutputSnap, setNewOutputSnap] = useState<Record<string, { date: Date | null; value: number | '' }>>({});

  // 從 store 反應式讀取任務快照（edit mode only）
  const currentTaskSnapshots = useMemo((): WeeklySnapshot[] => {
    if (!initialData) return [];
    return tasks.find(t => t.id === initialData.id)?.weeklySnapshots ?? [];
  }, [tasks, initialData]);

  // 完成度趨勢圖資料：task + 所有有快照的 output 各一條線
  const completenessChartData = useMemo(() => {
    const allDates = new Set<string>();
    currentTaskSnapshots.forEach(s => allDates.add(s.weekStart));
    outputs.forEach(o => (o.weeklySnapshots ?? []).forEach(s => allDates.add(s.weekStart)));
    if (allDates.size === 0) return [];
    return Array.from(allDates).sort().map(date => {
      const point: Record<string, string | number | undefined> = { date: date.slice(5) }; // MM-DD
      const taskSnap = currentTaskSnapshots.find(s => s.weekStart === date);
      if (taskSnap !== undefined) point['task'] = taskSnap.completeness;
      outputs.forEach(o => {
        const snap = (o.weeklySnapshots ?? []).find(s => s.weekStart === date);
        if (snap !== undefined) point[o.id] = snap.completeness;
      });
      return point;
    });
  }, [currentTaskSnapshots, outputs]);

  // Helper to get all descendants of a task to prevent circular references
  const getDescendantIds = (taskId: string): string[] => {
    const children = tasks.filter(t => t.parentId === taskId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getDescendantIds(c.id)];
    });
    return ids;
  };

  // 判斷此任務是否有子任務
  const hasChildren = useMemo(() => {
    if (!initialData) return false;
    return tasks.some(t => t.parentId === initialData.id);
  }, [tasks, initialData]);

  // Filter tasks that can be valid parents, with WBS ordering
  const { validParentCandidates, parentWbsNumbers } = useMemo(() => {
    const { wbsNumbers, sorted } = computeTaskWbsMap(tasks);
    let candidates: Task[];
    if (!initialData) {
      candidates = sorted;
    } else {
      const descendants = getDescendantIds(initialData.id);
      candidates = sorted.filter(t =>
        t.id !== initialData.id &&
        !descendants.includes(t.id)
      );
    }
    return { validParentCandidates: candidates, parentWbsNumbers: wbsNumbers };
  }, [tasks, initialData]);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setAliasTitle(initialData.aliasTitle || '');
      setDescription(initialData.description);
      setMainCategory(initialData.mainCategory);
      setEstimatedStartDate(initialData.estimatedStartDate ? new Date(initialData.estimatedStartDate) : null);
      setEstimatedEndDate(initialData.estimatedEndDate ? new Date(initialData.estimatedEndDate) : null);
      setAssignee(initialData.assignee);
      setReporter(initialData.reporter);
      setStatus(initialData.status);
      setCompleteness(initialData.completeness !== undefined ? initialData.completeness : '');
      setPauseReason(initialData.pauseReason || '');
      setTrackCompleteness(initialData.trackCompleteness !== false);
      setCompletenessType(initialData.completenessType ?? 'confidence');
      setShowInWbs(initialData.showInWbs !== undefined ? initialData.showInWbs : true);
      setGanttDisplayMode(initialData.ganttDisplayMode ?? 'bar');
      setShowInReport(initialData.showInReport !== false);
      setOutputs(initialData.outputs || []);
      setMilestones(initialData.milestones ?? []);
      setTimelineEntries(initialData.timelineEntries ?? []);
      setLabels(initialData.labels || []);
      setCurrentParentId(initialData.parentId || '');
      setShowAdvanced(!!(initialData.aliasTitle || initialData.description || initialData.assignee || initialData.reporter || (initialData.labels && initialData.labels.length > 0)));
      setShowTimeline((initialData.timelineEntries ?? []).length > 0);
    } else if (parentId) {
      const parent = getTaskById(parentId);
      if (parent) {
        setMainCategory(parent.mainCategory);
      }
      const selfName = members.find(m => m.isSelf)?.name || '';
      setTitle('');
      setAliasTitle('');
      setDescription('');
      setAssignee(selfName);
      setReporter('');
      setStatus('BACKLOG');
      setCompleteness('');
      setPauseReason('');
      setTrackCompleteness(true);
      setShowInWbs(true);
      setGanttDisplayMode('bar');
      setShowInReport(true);
      setOutputs([]);
      setMilestones([]);
      setTimelineEntries([]);
      setLabels([]);
      setCurrentParentId(parentId);
      setShowAdvanced(false);
    } else {
      const selfName = members.find(m => m.isSelf)?.name || '';
      setTitle('');
      setAliasTitle('');
      setDescription('');
      setMainCategory('');
      setEstimatedStartDate(null);
      setEstimatedEndDate(null);
      setAssignee(selfName);
      setReporter('');
      setStatus('BACKLOG');
      setShowAdvanced(false);
      setCompleteness('');
      setPauseReason('');
      setTrackCompleteness(true);
      setShowInWbs(true);
      setGanttDisplayMode('bar');
      setShowInReport(true);
      setOutputs([]);
      setMilestones([]);
      setTimelineEntries([]);
      setLabels([]);
      setCurrentParentId('');
    }
    setNewLabel('');
    setDateError(false);
    setPauseReasonError(false);
    // Reset snapshot UI state
    setShowTaskSnapshots(false);
    setNewSnapDate(null);
    setNewSnapValue('');
    setExpandedOutputSnaps(new Set());
    setNewOutputSnap({});
    // Reset timeline UI state
    setNewTimelineDate(format(new Date(), 'yyyy-MM-dd'));
    setNewTimelineContent('');
  }, [initialData, parentId, open, getTaskById, members]);

  // 實際開始日/完成日：從 timeslots 動態計算（含所有後代任務），不儲存於 Task
  const computedActualDates = useMemo(() => {
    if (!initialData) return null;
    const actualStart = getTaskActualStart(initialData.id, tasks, timeslots);
    if (actualStart === undefined) return null;
    const actualEnd = getTaskActualEnd(initialData.id, tasks, timeslots);
    return { start: actualStart, end: actualEnd };
  }, [initialData, tasks, timeslots]);

  // --- Label handlers ---
  const handleAddLabel = () => {
    const trimmed = newLabel.trim();
    if (trimmed && labels.length < 3 && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
      setNewLabel('');
    }
  };

  const handleDeleteLabel = (labelToDelete: string) => {
    setLabels(labels.filter(l => l !== labelToDelete));
  };

  // --- Milestone handlers ---
  const handleAddMilestone = () => {
    setMilestones(prev => [...prev, {
      id: uuidv4(),
      title: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      showInGantt: true,
    }]);
  };

  const handleUpdateMilestone = (id: string, updates: Partial<Omit<Milestone, 'id'>>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleDeleteMilestone = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  // --- Output handlers ---
  const getOutputTypeMeta = (outputTypeId: string | undefined) =>
    outputTypes.find(t => t.id === outputTypeId) ?? null;

  const handleAddOutput = () => {
    setOutputs([...outputs, { id: uuidv4(), name: '', outputTypeId: '', summary: '', link: '', completeness: '' }]);
  };

  const handleUpdateOutput = (id: string, field: keyof WorkOutput, value: string) => {
    setOutputs(outputs.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const handleDeleteOutput = (id: string) => {
    setOutputs(outputs.filter(o => o.id !== id));
  };

  // 複製產出為下期：effectiveDate +7 天；若原本無日期則維持空白；完成度歸零
  const handleCopyOutput = (id: string) => {
    const src = outputs.find(o => o.id === id);
    if (!src) return;
    const nextEffectiveDate = src.effectiveDate
      ? format(addDays(parseISO(src.effectiveDate), 7), 'yyyy-MM-dd')
      : '';
    const copy: typeof src = {
      ...src,
      id: uuidv4(),
      completeness: '',
      effectiveDate: nextEffectiveDate,
      weeklySnapshots: [],
    };
    // 插入在原產出之後
    const idx = outputs.findIndex(o => o.id === id);
    const next = [...outputs];
    next.splice(idx + 1, 0, copy);
    setOutputs(next);
  };

  // 產出快照（local state）
  const handleUpdateOutputSnapshots = (outputId: string, snapshots: WeeklySnapshot[]) => {
    setOutputs(prev => prev.map(o => o.id === outputId ? { ...o, weeklySnapshots: snapshots } : o));
  };

  const handleAddOutputSnapshot = (outputId: string) => {
    const s = newOutputSnap[outputId];
    if (!s?.date || s.value === '') return;
    const ws = format(startOfWeek(s.date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const existing = outputs.find(o => o.id === outputId)?.weeklySnapshots ?? [];
    const idx = existing.findIndex(sn => sn.weekStart === ws);
    const snap = { weekStart: ws, completeness: s.value as number };
    const updated = idx >= 0 ? existing.map((sn, i) => i === idx ? snap : sn) : [...existing, snap];
    handleUpdateOutputSnapshots(outputId, updated);
    setNewOutputSnap(prev => ({ ...prev, [outputId]: { date: null, value: '' } }));
  };

  // --- 任務快照（立即存 store）---
  const handleEditTaskSnapshot = (weekStart: string, completeness: number) => {
    if (!initialData) return;
    updateTaskSnapshots(initialData.id, currentTaskSnapshots.map(s =>
      s.weekStart === weekStart ? { ...s, completeness } : s
    ));
  };

  const handleDeleteTaskSnapshot = (weekStart: string) => {
    if (!initialData) return;
    updateTaskSnapshots(initialData.id, currentTaskSnapshots.filter(s => s.weekStart !== weekStart));
  };

  const handleAddTaskSnapshot = () => {
    if (!initialData || !newSnapDate || newSnapValue === '') return;
    const ws = format(startOfWeek(newSnapDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const existing = currentTaskSnapshots;
    const idx = existing.findIndex(s => s.weekStart === ws);
    const snap = { weekStart: ws, completeness: newSnapValue as number };
    const updated = idx >= 0 ? existing.map((s, i) => i === idx ? snap : s) : [...existing, snap];
    updateTaskSnapshots(initialData.id, updated);
    setNewSnapDate(null);
    setNewSnapValue('');
  };

  const handleSubmit = () => {
    if (ganttDisplayMode === 'bar' && (!estimatedStartDate || !estimatedEndDate)) {
      setDateError(true);
      return;
    }
    setDateError(false);
    if (status === 'PAUSED' && !pauseReason.trim()) {
      setPauseReasonError(true);
      return;
    }
    setPauseReasonError(false);
    const taskData = {
      title,
      aliasTitle,
      description,
      mainCategory,
      estimatedStartDate: estimatedStartDate?.getTime(),
      estimatedEndDate: estimatedEndDate?.getTime(),
      assignee,
      reporter,
      status,
      completeness: completeness === '' ? undefined : completeness,
      pauseReason: status === 'PAUSED' ? pauseReason : undefined,
      showInWbs,
      ganttDisplayMode,
      showInReport,
      trackCompleteness,
      completenessType,
      outputs,
      milestones,
      timelineEntries,
      labels,
      parentId: currentParentId || undefined,
    };

    if (initialData) {
      updateTask(initialData.id, taskData);
    } else {
      addTask(taskData as any);
    }
    onClose();
  };

  const toggleOutputSnap = (outputId: string) => {
    setExpandedOutputSnaps(prev => {
      const next = new Set(prev);
      next.has(outputId) ? next.delete(outputId) : next.add(outputId);
      return next;
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      {isMobile ? (
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar variant="dense">
            <IconButton edge="start" color="inherit" onClick={onClose} size="small">
              <Close />
            </IconButton>
            <Typography variant="subtitle1" sx={{ ml: 1, flex: 1, fontWeight: 600 }}>
              {initialData ? '編輯任務' : '建立任務'}
            </Typography>
          </Toolbar>
        </AppBar>
      ) : (
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {initialData ? '編輯任務' : '建立任務'}
        </DialogTitle>
      )}
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* 任務名稱 */}
          <Grid size={{ xs: 12 }}>
            <TextField label="任務名稱" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Grid>

          {/* Parent Task Selector */}
          <Grid size={{ xs: 12 }}>
            <Autocomplete
              size="small"
              options={validParentCandidates}
              value={validParentCandidates.find(t => t.id === currentParentId) ?? null}
              onChange={(_, task) => setCurrentParentId(task ? task.id : '')}
              getOptionLabel={(task) => {
                const wbs = parentWbsNumbers.get(task.id);
                return wbs ? `${wbs}  ${task.title}` : task.title;
              }}
              renderOption={(props, task) => {
                const wbs = parentWbsNumbers.get(task.id);
                const depth = wbs ? wbs.split('.').length - 1 : 0;
                return (
                  <li {...props} key={task.id}>
                    <Box sx={{ pl: depth * 2 }}>
                      <Typography variant="body2" component="span" color="textSecondary" sx={{ mr: 1, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {wbs}
                      </Typography>
                      {task.title}
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><AccountTree sx={{ fontSize: 18 }} /> 上層任務 (WBS 歸類)</Box>}
                  placeholder="無（設為第一階任務）"
                />
              )}
              clearOnEscape
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Grid>

          {/* 設定參數區塊（緊接在上層任務之後） */}
          <Grid size={{ xs: 12 }} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Checkbox checked={showInWbs} onChange={(e) => setShowInWbs(e.target.checked)} size="small" />}
              label="顯示於 WBS"
            />
            <FormControlLabel
              control={<Checkbox checked={trackCompleteness} onChange={(e) => setTrackCompleteness(e.target.checked)} size="small" />}
              label="追蹤完成度 %"
            />
            <FormControlLabel
              control={<Checkbox checked={showInReport} onChange={(e) => setShowInReport(e.target.checked)} size="small" />}
              label="顯示於週報進度表"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControl component="fieldset" sx={{ ml: 1 }}>
              <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>甘特圖顯示方式</FormLabel>
              <RadioGroup
                row
                value={ganttDisplayMode}
                onChange={(e) => setGanttDisplayMode(e.target.value as 'bar' | 'section' | 'hidden')}
              >
                <FormControlLabel value="bar" control={<Radio size="small" />} label="進度列" />
                <FormControlLabel value="section" control={<Radio size="small" />} label="章節標題" />
                <FormControlLabel value="hidden" control={<Radio size="small" />} label="不顯示" />
              </RadioGroup>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>任務分類</InputLabel>
              <Select value={mainCategory} label="任務分類" onChange={(e) => setMainCategory(e.target.value)}>
                {mainCategories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>任務狀態</InputLabel>
              <Select value={status} label="任務狀態" onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                <MenuItem value="BACKLOG">待規劃 (Backlog)</MenuItem>
                <MenuItem value="TODO">待處理 (Todo)</MenuItem>
                <MenuItem value="IN_PROGRESS">進行中 (Ongoing)</MenuItem>
                <MenuItem value="PAUSED">已暫停 (Paused)</MenuItem>
                <MenuItem value="DONE">已完成 (Done)</MenuItem>
                <MenuItem value="CANCELLED">已取消 (Cancelled)</MenuItem>
              </Select>
              {hasChildren && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                  此任務有子任務，狀態會在子任務變動時自動更新
                </Typography>
              )}
            </FormControl>
          </Grid>

          {status === 'PAUSED' && (
            <Grid size={{ xs: 12 }}>
              <TextField
                label="暫停原因 *"
                fullWidth
                multiline
                rows={2}
                required
                placeholder="說明任務暫停的原因或待解決的阻礙..."
                value={pauseReason}
                error={pauseReasonError}
                helperText={pauseReasonError ? '暫停狀態必須填寫暫停原因' : undefined}
                onChange={(e) => {
                  setPauseReason(e.target.value);
                  if (e.target.value.trim()) setPauseReasonError(false);
                }}
              />
            </Grid>
          )}

          <Grid size={{ xs: 12, md: 6 }}>
            <DatePicker
              label={ganttDisplayMode === 'bar' ? '預估開始日期 *' : '預估開始日期'}
              value={estimatedStartDate}
              onChange={(newValue) => { setEstimatedStartDate(newValue); if (newValue) setDateError(false); }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: dateError && ganttDisplayMode === 'bar' && !estimatedStartDate,
                  helperText: dateError && ganttDisplayMode === 'bar' && !estimatedStartDate ? '顯示進度列時為必填' : undefined,
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <DatePicker
              label={ganttDisplayMode === 'bar' ? '預估完成日期 *' : '預估完成日期'}
              value={estimatedEndDate}
              onChange={(newValue) => { setEstimatedEndDate(newValue); if (newValue) setDateError(false); }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: dateError && ganttDisplayMode === 'bar' && !estimatedEndDate,
                  helperText: dateError && ganttDisplayMode === 'bar' && !estimatedEndDate ? '顯示進度列時為必填' : undefined,
                },
              }}
            />
          </Grid>

          {/* 實際日期說明（唯讀，從 timeslots 計算） */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', gap: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, alignItems: 'flex-start' }}>
              <InfoOutlined fontSize="small" color="info" sx={{ mt: 0.2, flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <span>
                    <b>實際開始日</b>（自動）：
                    {computedActualDates
                      ? <b> {format(computedActualDates.start, 'yyyy-MM-dd HH:mm')}</b>
                      : ' 尚無時間紀錄'}
                  </span>
                  <span>
                    <b>實際完成日</b>（自動）：
                    {computedActualDates?.end
                      ? <b> {format(computedActualDates.end, 'yyyy-MM-dd HH:mm')}</b>
                      : ' —'}
                  </span>
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                  實際日期由時間紀錄（Timeslot）自動推算，無需手動填寫。
                  實際開始日 = 最早一筆 timeslot 的開始時間；
                  實際完成日 = 最晚一筆 timeslot 的結束時間（僅 DONE / CANCELLED 任務的甘特圖使用）。
                </Typography>
              </Box>
            </Box>
          </Grid>

          {trackCompleteness && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <TextField
                  label="整體完成度 (%)"
                  fullWidth
                  type="number"
                  placeholder="0–100"
                  inputProps={{ min: 0, max: 100, step: 5 }}
                  value={completeness}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                    setCompleteness(val);
                  }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>百分比類別</Typography>
                  <ToggleButtonGroup
                    value={completenessType}
                    exclusive
                    size="small"
                    onChange={(_, val) => { if (val) setCompletenessType(val); }}
                  >
                    <ToggleButton value="confidence" sx={{ px: 1, py: 0.5, fontSize: '0.7rem' }}>信心</ToggleButton>
                    <ToggleButton value="real" sx={{ px: 1, py: 0.5, fontSize: '0.7rem' }}>真實</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Box>
            </Grid>
          )}

          {/* 進階選項（漸進式展開） */}
          <Grid size={{ xs: 12 }}>
            <Box
              onClick={() => setShowAdvanced(v => !v)}
              sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 0.5, py: 0.5, userSelect: 'none' }}
            >
              {showAdvanced ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              <Typography variant="body2" color="text.secondary">
                進階選項（別名、說明、標籤、負責人、指派人）
              </Typography>
            </Box>
            <Collapse in={showAdvanced}>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 12 }}>
                  <TextField label="別名 (Alias Title)" fullWidth value={aliasTitle} onChange={(e) => setAliasTitle(e.target.value)} inputProps={{ maxLength: 10 }} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField label="任務詳細說明" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LabelIcon fontSize="small" color="action" />
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>標籤 (最多 3 個)</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                      {labels.map((label) => (
                          <Chip key={label} label={label} onDelete={() => handleDeleteLabel(label)} color="secondary" variant="outlined" size="small" />
                      ))}
                      {labels.length < 3 && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                              <TextField
                                  size="small"
                                  placeholder="新增標籤..."
                                  value={newLabel}
                                  onChange={(e) => setNewLabel(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLabel())}
                                  sx={{ width: 150 }}
                              />
                              <Button size="small" onClick={handleAddLabel} disabled={!newLabel.trim()}>加入</Button>
                          </Box>
                      )}
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete
                    freeSolo
                    options={memberNames}
                    value={assignee}
                    onInputChange={(_, v) => setAssignee(v)}
                    renderInput={(params) => <TextField {...params} label="任務負責人" fullWidth />}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Autocomplete
                    freeSolo
                    options={memberNames}
                    value={reporter}
                    onInputChange={(_, v) => setReporter(v)}
                    renderInput={(params) => <TextField {...params} label="任務指派人" fullWidth />}
                  />
                </Grid>
              </Grid>
            </Collapse>
          </Grid>

          {/* 任務完成度歷史快照（僅編輯模式，且追蹤完成度時顯示） */}
          {initialData && trackCompleteness && (
            <Grid size={{ xs: 12 }}>
              <Box
                onClick={() => setShowTaskSnapshots(v => !v)}
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 0.5, py: 0.5, userSelect: 'none' }}
              >
                {showTaskSnapshots ? <ExpandLess fontSize="small" color="primary" /> : <ExpandMore fontSize="small" color="primary" />}
                <Typography variant="body2" color="primary">
                  完成度歷史快照（{currentTaskSnapshots.length} 筆）
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                  — 補填或修改過去各期的完成度紀錄
                </Typography>
              </Box>
              <Collapse in={showTaskSnapshots}>
                <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'action.hover' }}>
                  {/* 現有快照列表（最新在上） */}
                  {[...currentTaskSnapshots]
                    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
                    .map(snap => (
                      <Box key={snap.weekStart} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ minWidth: 110, fontFamily: 'monospace', flexShrink: 0 }}>
                          {snap.weekStart}
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          label="%"
                          value={snap.completeness}
                          inputProps={{ min: 0, max: 100, step: 5 }}
                          sx={{ width: 80 }}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            handleEditTaskSnapshot(snap.weekStart, val);
                          }}
                        />
                        <IconButton size="small" color="error" onClick={() => handleDeleteTaskSnapshot(snap.weekStart)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  {currentTaskSnapshots.length === 0 && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
                      尚無歷史快照
                    </Typography>
                  )}

                  {/* 新增快照 */}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <DatePicker
                      label="週次（任意日期）"
                      value={newSnapDate}
                      onChange={setNewSnapDate}
                      slotProps={{ textField: { size: 'small', sx: { width: 180 } } }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="完成度 %"
                      value={newSnapValue}
                      inputProps={{ min: 0, max: 100, step: 5 }}
                      sx={{ width: 100 }}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                        setNewSnapValue(val);
                      }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={handleAddTaskSnapshot}
                      disabled={!newSnapDate || newSnapValue === ''}
                      sx={{ mt: 0.5 }}
                    >
                      新增
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                    日期自動對齊至該週週日（weekStart）。同週已有快照時會覆蓋。
                  </Typography>

                  {/* 完成度趨勢圖 */}
                  {completenessChartData.length > 0 && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        完成度趨勢（任務整體 + 各工作產出）
                      </Typography>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={completenessChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                          <ChartTooltip formatter={(v: number | string | readonly (string | number)[] | undefined) => typeof v === 'number' ? `${v}%` : ''} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                          {currentTaskSnapshots.length > 0 && (
                            <Line
                              type="monotone" dataKey="task" name="任務整體"
                              stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} connectNulls
                            />
                          )}
                          {outputs
                            .filter(o => (o.weeklySnapshots ?? []).length > 0)
                            .map((o, idx) => (
                              <Line
                                key={o.id} type="monotone" dataKey={o.id}
                                name={o.name || `產出 ${idx + 1}`}
                                stroke={CHART_COLORS[(idx + 1) % CHART_COLORS.length]}
                                strokeWidth={1.5}
                                strokeDasharray={idx % 2 !== 0 ? '4 2' : undefined}
                                dot={{ r: 2 }} connectNulls
                              />
                            ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </Paper>
              </Collapse>
            </Grid>
          )}

          {/* ── Milestone Section ── */}
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">里程碑 (Milestones)</Typography>
              <Button startIcon={<Add />} variant="outlined" size="small" onClick={handleAddMilestone}>新增里程碑</Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {milestones.map((ms) => (
                <Paper key={ms.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label="里程碑名稱"
                        size="small"
                        fullWidth
                        value={ms.title}
                        onChange={(e) => handleUpdateMilestone(ms.id, { title: e.target.value })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <DatePicker
                        label="日期"
                        value={ms.date ? new Date(ms.date) : null}
                        onChange={(d) => d && handleUpdateMilestone(ms.id, { date: format(d, 'yyyy-MM-dd') })}
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel>顏色</InputLabel>
                        <Select
                          value={ms.color ?? ''}
                          label="顏色"
                          onChange={(e) => handleUpdateMilestone(ms.id, { color: e.target.value || undefined })}
                          renderValue={(val) => {
                            if (!val) return <em>預設</em>;
                            const c = MILESTONE_COLORS.find(x => x.value === val);
                            return (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c?.css ?? '#999', flexShrink: 0 }} />
                                {c?.label ?? val}
                              </Box>
                            );
                          }}
                        >
                          <MenuItem value=""><em>預設</em></MenuItem>
                          {MILESTONE_COLORS.map(c => (
                            <MenuItem key={c.value} value={c.value}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c.css, flexShrink: 0 }} />
                                {c.label}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 'auto' }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={ms.showInGantt}
                            onChange={(e) => handleUpdateMilestone(ms.id, { showInGantt: e.target.checked })}
                          />
                        }
                        label={<Typography variant="caption">甘特圖</Typography>}
                        sx={{ mr: 0 }}
                      />
                      <IconButton size="small" color="error" onClick={() => handleDeleteMilestone(ms.id)}>
                        <Delete />
                      </IconButton>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        label="備註（選填）"
                        size="small"
                        fullWidth
                        value={ms.note ?? ''}
                        onChange={(e) => handleUpdateMilestone(ms.id, { note: e.target.value || undefined })}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              ))}
              {milestones.length === 0 && (
                <Typography variant="body2" color="text.disabled" sx={{ pl: 1 }}>尚無里程碑</Typography>
              )}
            </Box>
          </Grid>

          {/* ── Timeline Entries Section ── */}
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 2 }} />
            <Box
              onClick={() => setShowTimeline(v => !v)}
              sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 0.5, py: 0.5, userSelect: 'none' }}
            >
              {showTimeline ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              <Typography variant="h6">
                事件時間軸（{timelineEntries.length} 筆）
              </Typography>
            </Box>
            <Collapse in={showTimeline}>
              <Box sx={{ mt: 1 }}>
                {/* Add new entry */}
                <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: 'action.hover' }}>
                  <Grid container spacing={1} alignItems="flex-start">
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        size="small"
                        label="日期"
                        type="date"
                        fullWidth
                        value={newTimelineDate}
                        onChange={(e) => setNewTimelineDate(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        size="small"
                        label="事件描述"
                        fullWidth
                        value={newTimelineContent}
                        onChange={(e) => setNewTimelineContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (newTimelineContent.trim() && newTimelineDate) {
                              setTimelineEntries(prev => [...prev, {
                                id: uuidv4(),
                                date: newTimelineDate,
                                content: newTimelineContent.trim(),
                              }]);
                              setNewTimelineContent('');
                            }
                          }
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 2 }} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Add />}
                        disabled={!newTimelineContent.trim() || !newTimelineDate}
                        onClick={() => {
                          setTimelineEntries(prev => [...prev, {
                            id: uuidv4(),
                            date: newTimelineDate,
                            content: newTimelineContent.trim(),
                          }]);
                          setNewTimelineContent('');
                        }}
                      >
                        新增
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Existing entries sorted by date desc */}
                {[...timelineEntries]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((entry) => (
                    <Paper key={entry.id} variant="outlined" sx={{ p: 1, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={entry.date} size="small" variant="outlined" sx={{ fontFamily: 'monospace', flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>{entry.content}</Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setTimelineEntries(prev => prev.filter(e => e.id !== entry.id))}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Paper>
                  ))}
                {timelineEntries.length === 0 && (
                  <Typography variant="body2" color="text.disabled" sx={{ pl: 1 }}>尚無事件記錄</Typography>
                )}
              </Box>
            </Collapse>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">工作產出 (Work Outputs)</Typography>
                <Button startIcon={<Add />} variant="outlined" size="small" onClick={handleAddOutput}>新增產出</Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {outputs.map((output) => {
                    const typeMeta = getOutputTypeMeta(output.outputTypeId);
                    const isIntangible = typeMeta !== null && !typeMeta.isTangible;
                    const outputSnapshots = output.weeklySnapshots ?? [];
                    const isSnapExpanded = expandedOutputSnaps.has(output.id);
                    return (
                    <Paper key={output.id} variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                        <Grid container spacing={2} alignItems="flex-start">
                            {/* Row 1：名稱 + 類型 + 完成度 + 操作按鈕 */}
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    label="產出名稱"
                                    size="small"
                                    fullWidth
                                    required
                                    value={output.name}
                                    onChange={(e) => handleUpdateOutput(output.id, 'name', e.target.value)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>產出類型</InputLabel>
                                    <Select
                                        value={output.outputTypeId || ''}
                                        label="產出類型"
                                        onChange={(e) => handleUpdateOutput(output.id, 'outputTypeId', e.target.value)}
                                    >
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
                            </Grid>
                            <Grid size={{ xs: 8, md: 2 }}>
                                <TextField
                                    label="完成度 (%)"
                                    size="small"
                                    type="number"
                                    fullWidth
                                    placeholder="0-100"
                                    inputProps={{ min: 0, max: 100, step: 1 }}
                                    value={output.completeness}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0)).toString();
                                        handleUpdateOutput(output.id, 'completeness', val);
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 4, md: 2 }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Tooltip title={output.effectiveDate ? `複製為下期（${format(addDays(parseISO(output.effectiveDate), 7), 'MM/dd')} 起）` : '複製為下期產出'}>
                                    <IconButton size="small" color="primary" onClick={() => handleCopyOutput(output.id)}>
                                        <ContentCopy fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <IconButton size="small" color="error" onClick={() => handleDeleteOutput(output.id)}>
                                    <Delete />
                                </IconButton>
                            </Grid>

                            {/* Row 2：依類型顯示 summary（無形）或 link（有形/未分類） */}
                            {isIntangible ? (
                                <Grid size={{ xs: 12 }}>
                                    <TextField
                                        label="說明/摘要（無形產出的描述）"
                                        size="small"
                                        fullWidth
                                        multiline
                                        rows={2}
                                        placeholder="描述這項產出的具體內容或價值..."
                                        value={output.summary || ''}
                                        onChange={(e) => handleUpdateOutput(output.id, 'summary', e.target.value)}
                                    />
                                </Grid>
                            ) : (
                                <Grid size={{ xs: 12 }}>
                                    <TextField
                                        label="相關連結 (URL/路徑)"
                                        size="small"
                                        fullWidth
                                        value={output.link || ''}
                                        InputProps={{ startAdornment: <LinkIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} /> }}
                                        onChange={(e) => handleUpdateOutput(output.id, 'link', e.target.value)}
                                    />
                                </Grid>
                            )}

                            {/* Row 3：歸屬期間（週期型產出選填） */}
                            <Grid size={{ xs: 12, md: 6 }}>
                                <DatePicker
                                    label="歸屬期間（選填，週期型產出）"
                                    value={output.effectiveDate ? new Date(output.effectiveDate + 'T00:00:00') : null}
                                    onChange={(date: Date | null) => {
                                        handleUpdateOutput(output.id, 'effectiveDate', date ? format(date, 'yyyy-MM-dd') : '');
                                    }}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            fullWidth: true,
                                            helperText: '週期型產出（如每週會議報告）請填歸屬日期；持續型產出（如長期文件）留空',
                                        },
                                    }}
                                />
                            </Grid>

                            {/* Row 4：完成度快照（local state，隨儲存任務一起存） */}
                            <Grid size={{ xs: 12 }}>
                                <Box
                                    onClick={() => toggleOutputSnap(output.id)}
                                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 0.5, userSelect: 'none' }}
                                >
                                    {isSnapExpanded ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
                                    <Typography variant="caption" color="text.secondary">
                                        完成度快照（{outputSnapshots.length} 筆）
                                    </Typography>
                                </Box>
                                <Collapse in={isSnapExpanded}>
                                    <Box sx={{ pl: 1, pt: 1 }}>
                                        {[...outputSnapshots]
                                            .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
                                            .map(snap => (
                                                <Box key={snap.weekStart} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                                                    <Typography variant="caption" sx={{ minWidth: 110, fontFamily: 'monospace', flexShrink: 0 }}>
                                                        {snap.weekStart}
                                                    </Typography>
                                                    <TextField
                                                        size="small"
                                                        type="number"
                                                        label="%"
                                                        value={snap.completeness}
                                                        inputProps={{ min: 0, max: 100, step: 5 }}
                                                        sx={{ width: 75 }}
                                                        onChange={(e) => {
                                                            const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                            handleUpdateOutputSnapshots(output.id, outputSnapshots.map(s =>
                                                                s.weekStart === snap.weekStart ? { ...s, completeness: val } : s
                                                            ));
                                                        }}
                                                    />
                                                    <IconButton size="small" color="error" onClick={() => {
                                                        handleUpdateOutputSnapshots(output.id, outputSnapshots.filter(s => s.weekStart !== snap.weekStart));
                                                    }}>
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            ))}
                                        {outputSnapshots.length === 0 && (
                                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                                                尚無快照
                                            </Typography>
                                        )}
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', mt: 0.5 }}>
                                            <DatePicker
                                                label="週次"
                                                value={newOutputSnap[output.id]?.date ?? null}
                                                onChange={(date) => setNewOutputSnap(prev => ({
                                                    ...prev,
                                                    [output.id]: { ...prev[output.id] ?? { value: '' }, date },
                                                }))}
                                                slotProps={{ textField: { size: 'small', sx: { width: 165 } } }}
                                            />
                                            <TextField
                                                size="small"
                                                type="number"
                                                label="%"
                                                value={newOutputSnap[output.id]?.value ?? ''}
                                                inputProps={{ min: 0, max: 100, step: 5 }}
                                                sx={{ width: 75 }}
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                    setNewOutputSnap(prev => ({
                                                        ...prev,
                                                        [output.id]: { ...prev[output.id] ?? { date: null }, value: val },
                                                    }));
                                                }}
                                            />
                                            <IconButton
                                                size="small"
                                                color="primary"
                                                disabled={!newOutputSnap[output.id]?.date || newOutputSnap[output.id]?.value === ''}
                                                onClick={() => handleAddOutputSnapshot(output.id)}
                                                sx={{ mt: 0.5 }}
                                            >
                                                <Add />
                                            </IconButton>
                                        </Box>
                                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.3 }}>
                                            日期自動對齊至該週週日。快照於儲存任務時一起寫入。
                                        </Typography>
                                    </Box>
                                </Collapse>
                            </Grid>
                        </Grid>
                    </Paper>
                    );
                })}
                {outputs.length === 0 && (
                    <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 2 }}>
                        目前尚無產出紀錄。
                    </Typography>
                )}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!title}>儲存任務</Button>
      </DialogActions>
    </Dialog>
  );
};
