import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Grid, Box, Typography, IconButton, Paper, Divider, Chip,
  FormControlLabel, Checkbox, Collapse
} from '@mui/material';
import { Add, Delete, Link as LinkIcon, Label as LabelIcon, AccountTree, InfoOutlined, ExpandMore, ExpandLess } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, startOfWeek } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatus, WorkOutput, WeeklySnapshot } from '../types';
import { useTaskStore } from '../store/useTaskStore';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: Task;
  parentId?: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({ open, onClose, initialData, parentId }) => {
  const { tasks, timeslots, mainCategories, outputTypes, addTask, updateTask, updateTaskSnapshots, getTaskById } = useTaskStore();

  const [title, setTitle] = useState('');
  const [aliasTitle, setAliasTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainCategory, setMainCategory] = useState('');
  const [estimatedStartDate, setEstimatedStartDate] = useState<Date | null>(null);
  const [estimatedEndDate, setEstimatedEndDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState('');
  const [reporter, setReporter] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [completeness, setCompleteness] = useState<number | ''>('');
  const [showInWbs, setShowInWbs] = useState(true);
  const [showInGantt, setShowInGantt] = useState(true);
  const [showInReport, setShowInReport] = useState(true);
  const [dateError, setDateError] = useState(false);
  const [outputs, setOutputs] = useState<WorkOutput[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [currentParentId, setCurrentParentId] = useState<string>('');

  // --- Snapshot management state ---
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

  // Helper to get all descendants of a task to prevent circular references
  const getDescendantIds = (taskId: string): string[] => {
    const children = tasks.filter(t => t.parentId === taskId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getDescendantIds(c.id)];
    });
    return ids;
  };

  // Filter tasks that can be valid parents
  const validParentCandidates = useMemo(() => {
    if (!initialData) return tasks;
    const descendants = getDescendantIds(initialData.id);
    return tasks.filter(t =>
      t.id !== initialData.id &&
      !descendants.includes(t.id)
    );
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
      setShowInWbs(initialData.showInWbs !== undefined ? initialData.showInWbs : true);
      setShowInGantt(initialData.showInGantt !== undefined ? initialData.showInGantt : true);
      setShowInReport(initialData.showInReport !== false);
      setOutputs(initialData.outputs || []);
      setLabels(initialData.labels || []);
      setCurrentParentId(initialData.parentId || '');
    } else if (parentId) {
      const parent = getTaskById(parentId);
      if (parent) {
        setMainCategory(parent.mainCategory);
      }
      setTitle('');
      setAliasTitle('');
      setDescription('');
      setStatus('TODO');
      setCompleteness('');
      setPauseReason('');
      setShowInWbs(true);
      setShowInGantt(true);
      setShowInReport(true);
      setOutputs([]);
      setLabels([]);
      setCurrentParentId(parentId);
    } else {
      setTitle('');
      setAliasTitle('');
      setDescription('');
      setMainCategory('');
      setEstimatedStartDate(null);
      setEstimatedEndDate(null);
      setAssignee('');
      setReporter('');
      setStatus('TODO');
      setCompleteness('');
      setPauseReason('');
      setShowInWbs(true);
      setShowInGantt(true);
      setShowInReport(true);
      setOutputs([]);
      setLabels([]);
      setCurrentParentId('');
    }
    setNewLabel('');
    setDateError(false);
    // Reset snapshot UI state
    setShowTaskSnapshots(false);
    setNewSnapDate(null);
    setNewSnapValue('');
    setExpandedOutputSnaps(new Set());
    setNewOutputSnap({});
  }, [initialData, parentId, open, getTaskById]);

  // 實際開始日/完成日：從 timeslots 動態計算，不儲存於 Task
  const computedActualDates = useMemo(() => {
    if (!initialData) return null;
    const taskTs = timeslots.filter(ts => ts.taskId === initialData.id);
    if (taskTs.length === 0) return null;
    const actualStart = Math.min(...taskTs.map(ts => ts.startTime));
    const endedTs = taskTs.filter(ts => ts.endTime);
    const actualEnd = endedTs.length > 0 ? Math.max(...endedTs.map(ts => ts.endTime!)) : undefined;
    return { start: actualStart, end: actualEnd };
  }, [initialData, timeslots]);

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
    if (showInGantt && (!estimatedStartDate || !estimatedEndDate)) {
      setDateError(true);
      return;
    }
    setDateError(false);
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
      showInGantt,
      showInReport,
      outputs,
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {initialData ? '編輯任務' : '建立任務'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField label="任務名稱" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="別名 (Alias Title)" fullWidth value={aliasTitle} onChange={(e) => setAliasTitle(e.target.value)} inputProps={{ maxLength: 10 }} />
          </Grid>

          {/* Parent Task Selector */}
          <Grid size={{ xs: 12 }}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccountTree sx={{ fontSize: 18 }} /> 上層任務 (WBS 歸類)
              </InputLabel>
              <Select
                value={currentParentId}
                label="上層任務 (WBS 歸類)"
                onChange={(e) => setCurrentParentId(e.target.value)}
              >
                <MenuItem value=""><em>無 (設為第一階任務)</em></MenuItem>
                {validParentCandidates.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.title} {t.aliasTitle ? `(${t.aliasTitle})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
            </FormControl>
          </Grid>

          {status === 'PAUSED' && (
            <Grid size={{ xs: 12 }}>
              <TextField
                label="暫停原因"
                fullWidth
                multiline
                rows={2}
                placeholder="說明任務暫停的原因或待解決的阻礙..."
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            </Grid>
          )}

          <Grid size={{ xs: 12, md: 6 }}>
            <DatePicker
              label={showInGantt ? '預估開始日期 *' : '預估開始日期'}
              value={estimatedStartDate}
              onChange={(newValue) => { setEstimatedStartDate(newValue); if (newValue) setDateError(false); }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: dateError && showInGantt && !estimatedStartDate,
                  helperText: dateError && showInGantt && !estimatedStartDate ? '顯示於甘特圖時為必填' : undefined,
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <DatePicker
              label={showInGantt ? '預估完成日期 *' : '預估完成日期'}
              value={estimatedEndDate}
              onChange={(newValue) => { setEstimatedEndDate(newValue); if (newValue) setDateError(false); }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: dateError && showInGantt && !estimatedEndDate,
                  helperText: dateError && showInGantt && !estimatedEndDate ? '顯示於甘特圖時為必填' : undefined,
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

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="任務負責人" fullWidth value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="任務指派人" fullWidth value={reporter} onChange={(e) => setReporter(e.target.value)} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
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
          </Grid>
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Checkbox checked={showInWbs} onChange={(e) => setShowInWbs(e.target.checked)} />}
              label="顯示於 WBS"
            />
            <FormControlLabel
              control={<Checkbox checked={showInGantt} onChange={(e) => setShowInGantt(e.target.checked)} />}
              label="顯示於甘特圖"
            />
            <FormControlLabel
              control={<Checkbox checked={showInReport} onChange={(e) => setShowInReport(e.target.checked)} />}
              label="顯示於週報進度表"
            />
          </Grid>

          {/* 任務完成度歷史快照（僅編輯模式） */}
          {initialData && (
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
                </Paper>
              </Collapse>
            </Grid>
          )}

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
                            {/* Row 1：名稱 + 類型 + 完成度 + 刪除 */}
                            <Grid size={{ xs: 12, md: 5 }}>
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
                            <Grid size={{ xs: 10, md: 2 }}>
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
                            <Grid size={{ xs: 2, md: 1 }} sx={{ display: 'flex', alignItems: 'center' }}>
                                <IconButton color="error" onClick={() => handleDeleteOutput(output.id)}>
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
