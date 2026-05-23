import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Grid, Box, Typography, IconButton, Paper, Chip, Divider,
  FormControlLabel, Checkbox, Collapse, Radio, RadioGroup, FormLabel,
  ToggleButton, ToggleButtonGroup, useTheme, useMediaQuery, AppBar, Toolbar,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { Add, Delete, Label as LabelIcon, AccountTree, InfoOutlined, ExpandMore, ExpandLess, Close } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatus, WorkOutput, Milestone, TaskTimelineEntry } from '@tt/shared/types';
import { useTaskStore } from '../store/useTaskStore';
import { getTaskActualStart, getTaskActualEnd } from '@tt/shared/utils/taskDateUtils';
import { computeTaskWbsMap } from '@tt/shared/utils/wbs';
import { TaskMilestones } from './TaskMilestones';
import { TaskOutputs } from './TaskOutputs';
import { TaskSnapshotSection } from './TaskSnapshotSection';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: Task;
  parentId?: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({ open, onClose, initialData, parentId }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { tasks, timeslots, mainCategories, outputTypes, members, addTask, updateTask, getTaskById } = useTaskStore();
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

  const [showAdvanced, setShowAdvanced] = useState(false);

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
            <TaskSnapshotSection
              key={initialData.id}
              taskId={initialData.id}
              outputs={outputs}
            />
          )}

          {/* ── Milestone Section ── */}
          <TaskMilestones milestones={milestones} onChange={setMilestones} />

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

          {/* ── Work Outputs Section ── */}
          <TaskOutputs
            key={`outputs-${open}-${initialData?.id ?? 'new'}`}
            outputs={outputs}
            onChange={setOutputs}
            outputTypes={outputTypes}
          />
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!title}>儲存任務</Button>
      </DialogActions>
    </Dialog>
  );
};
