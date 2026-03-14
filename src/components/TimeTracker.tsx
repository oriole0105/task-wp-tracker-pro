import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem, IconButton,
  Tooltip, FormControlLabel, Switch, Autocomplete, Snackbar, Alert
} from '@mui/material';
import { Palette, Height, ChevronLeft, ChevronRight, CalendarMonth, IosShare, Today } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useTaskStore } from '../store/useTaskStore';
import { format, startOfDay, endOfDay, startOfWeek, addDays, isSameDay, addWeeks, subWeeks, subDays } from 'date-fns';
import { getCategoryColor } from '../utils/colors';
import { TaskForm } from './TaskForm';
import type { Timeslot, Task } from '../types';
import { exportTimeslotsToICS, parseICS } from '../utils/ics';
import { computeTaskWbsMap } from '../utils/wbs';
import { findOverlappingTimeslots, formatOverlapMessage } from '../utils/timeslotOverlap';

interface TimeSlot extends Timeslot {
  taskTitle: string;
  aliasTitle: string;
  taskDescription: string;
  mainCategory: string;
  date: Date;
}

const START_HOUR = 0;
const END_HOUR = 23;
const HEADER_HEIGHT = 40;

type ViewType = 'day' | 'week5' | 'week7';
type ColorMode = 'main' | 'sub';
type ZoomLevel = 60 | 120;

export const TimeTracker: React.FC = () => {
  const { tasks, timeslots, subCategories, addTimeslot, updateTimeslot, deleteTimeslot } = useTaskStore();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [view, setView] = useState<ViewType>('week5');
  const [colorMode, setColorMode] = useState<ColorMode>('sub');
  const [hourHeight, setHourHeight] = useState<ZoomLevel>(60);
  const [showTooltip, setShowTooltip] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pixelsPerMinute = hourHeight / 60;

  const handlePrev = () => {
    if (!selectedDate) return;
    if (view === 'day') setSelectedDate(subDays(selectedDate, 1));
    else setSelectedDate(subWeeks(selectedDate, 1));
  };

  const handleNext = () => {
    if (!selectedDate) return;
    if (view === 'day') setSelectedDate(addDays(selectedDate, 1));
    else setSelectedDate(addWeeks(selectedDate, 1));
  };

  const displayDates = useMemo(() => {
    if (!selectedDate) return [];
    if (view === 'day') return [startOfDay(selectedDate)];
    const sunday = startOfWeek(selectedDate, { weekStartsOn: 0 });
    if (view === 'week5') {
      return [1, 2, 3, 4, 5].map(i => addDays(sunday, i));
    }
    return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  }, [selectedDate, view]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();

    displayDates.forEach(date => {
      const dayStart = startOfDay(date).getTime();
      const dayEnd = endOfDay(date).getTime();
      const slots: TimeSlot[] = [];

      timeslots.forEach(ts => {
        const effectiveStart = Math.max(ts.startTime, dayStart);
        const effectiveEnd = Math.min(ts.endTime || Date.now(), dayEnd);

        if (effectiveStart < dayEnd && effectiveEnd > dayStart) {
          const task = ts.taskId ? tasks.find(t => t.id === ts.taskId) : undefined;
          slots.push({
            ...ts,
            startTime: effectiveStart,
            endTime: effectiveEnd,
            date: date,
            taskTitle: task?.title || '（未連結任務）',
            aliasTitle: task?.aliasTitle || '',
            taskDescription: task?.description || '',
            mainCategory: task?.mainCategory || '未分類',
          });
        }
      });

      map.set(date.toDateString(), slots.sort((a, b) => a.startTime - b.startTime));
    });

    return map;
  }, [timeslots, tasks, displayDates]);

  useEffect(() => {
    if (scrollRef.current) {
      const allSlots = Array.from(slotsByDate.values()).flat();
      const firstHour = allSlots.length > 0 ? new Date(Math.min(...allSlots.map(s => s.startTime))).getHours() : 7;
      const targetHour = Math.max(firstHour - 1, 0);
      scrollRef.current.scrollTop = targetHour * hourHeight;
    }
  }, [selectedDate, view, hourHeight, slotsByDate]);

  // Edit Log State
  const [editingLog, setEditingLog] = useState<TimeSlot | null>(null);
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editSubCategory, setEditSubCategory] = useState('');
  const [editTaskId, setEditTaskId] = useState('');
  const [editNote, setEditNote] = useState('');

  // Task Form State (double-click)
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // Click timer ref：區分單擊 vs 雙擊
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 快速新增時間紀錄（點擊空白格）
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date>(new Date());
  const [quickAddStart, setQuickAddStart] = useState('');
  const [quickAddEnd, setQuickAddEnd] = useState('');
  const [quickAddTaskId, setQuickAddTaskId] = useState('');
  const [quickAddSubCategory, setQuickAddSubCategory] = useState('');
  const [quickAddNote, setQuickAddNote] = useState('');

  // 重疊錯誤提示
  const [overlapError, setOverlapError] = useState('');

  // ICS 批次匯出 Dialog
  const [icsExportDialogOpen, setIcsExportDialogOpen] = useState(false);
  const [icsExportStart, setIcsExportStart] = useState<Date | null>(null);
  const [icsExportEnd, setIcsExportEnd] = useState<Date | null>(null);

  // 從 Quick Add 跳去建立新任務時，記錄原先任務 ID 集合以便回來後自動選新任務
  const pendingQuickAdd = useRef(false);
  const prevTaskIdsRef = useRef<Set<string>>(new Set());

  const handleHourCellClick = (date: Date, hour: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMinutes = Math.round((y / hourHeight) * 60 / 15) * 15;
    const minuteOffset = Math.min(rawMinutes, 59);
    const totalMinutes = hour * 60 + minuteOffset;
    const snappedH = Math.floor(totalMinutes / 60);
    const snappedM = totalMinutes % 60;

    const startTime = new Date(date);
    startTime.setHours(snappedH, snappedM, 0, 0);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

    const fmt = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setQuickAddDate(new Date(date));
    setQuickAddStart(fmt(snappedH, snappedM));
    setQuickAddEnd(fmt(endTime.getHours(), endTime.getMinutes()));
    setQuickAddTaskId('');
    setQuickAddSubCategory('');
    setQuickAddNote('');
    setQuickAddOpen(true);
  };

  const handleQuickAddSave = () => {
    if (!quickAddStart || !quickAddEnd) return;
    const [sh, sm] = quickAddStart.split(':').map(Number);
    const [eh, em] = quickAddEnd.split(':').map(Number);
    const start = new Date(quickAddDate);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(quickAddDate);
    end.setHours(eh, em, 0, 0);
    if (end <= start) return;

    const overlaps = findOverlappingTimeslots(timeslots, tasks, start.getTime(), end.getTime());
    if (overlaps.length > 0) {
      setOverlapError(formatOverlapMessage(overlaps));
      return;
    }

    addTimeslot({
      taskId: quickAddTaskId || undefined,
      subCategory: quickAddSubCategory,
      startTime: start.getTime(),
      endTime: end.getTime(),
      note: quickAddNote,
    });
    setQuickAddOpen(false);
  };

  const openTimeLogEditor = (slot: TimeSlot) => {
    setEditingLog(slot);
    setEditDate(slot.date);
    setEditStart(format(slot.startTime, 'HH:mm'));
    const originalTs = timeslots.find(ts => ts.id === slot.id);
    const isRunning = !originalTs?.endTime;
    setEditEnd(isRunning ? '' : format(slot.endTime!, 'HH:mm'));
    setEditSubCategory(slot.subCategory || '');
    setEditTaskId(slot.taskId || '');
    setEditNote(slot.note || '');
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      openTimeLogEditor(slot);
    }, 250);
  };

  const handleSlotDoubleClick = (slot: TimeSlot) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (slot.taskId) {
      const task = tasks.find(t => t.id === slot.taskId);
      if (task) {
        setEditingTask(task);
        setTaskFormOpen(true);
      }
    }
  };

  const handleSaveLog = () => {
    if (editingLog && editDate) {
      const [sh, sm] = editStart.split(':').map(Number);
      const newStart = new Date(editDate);
      newStart.setHours(sh, sm, 0, 0);

      let newEnd: number | undefined = editingLog.endTime;
      if (editEnd) {
        const [eh, em] = editEnd.split(':').map(Number);
        const d = new Date(editDate);
        d.setHours(eh, em, 0, 0);
        newEnd = d.getTime();
      } else {
        const originalTs = timeslots.find(ts => ts.id === editingLog.id);
        if (originalTs?.endTime) {
          const d = new Date(editDate);
          const oldEnd = new Date(originalTs.endTime);
          d.setHours(oldEnd.getHours(), oldEnd.getMinutes(), 0, 0);
          newEnd = d.getTime();
        }
      }

      if (newEnd) {
        const overlaps = findOverlappingTimeslots(timeslots, tasks, newStart.getTime(), newEnd, editingLog.id);
        if (overlaps.length > 0) {
          setOverlapError(formatOverlapMessage(overlaps));
          return;
        }
      }

      updateTimeslot(editingLog.id, {
        startTime: newStart.getTime(),
        endTime: newEnd,
        subCategory: editSubCategory,
        taskId: editTaskId || undefined,
        note: editNote,
      });
      setEditingLog(null);
    }
  };

  const handleDeleteLog = () => {
    if (editingLog) {
      deleteTimeslot(editingLog.id);
      setEditingLog(null);
    }
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

  // ── ICS handlers ────────────────────────────────────────────────────────────

  const handleSingleIcsExport = (slot: Timeslot) => {
    exportTimeslotsToICS([slot], tasks, 'single');
  };

  const handleBatchIcsExport = () => {
    if (!icsExportStart || !icsExportEnd) return;
    const start = startOfDay(icsExportStart).getTime();
    const end = endOfDay(icsExportEnd).getTime();
    const filtered = timeslots.filter(ts => ts.startTime >= start && ts.startTime <= end);
    const hint = `${format(icsExportStart, 'yyyy-MM-dd')}_to_${format(icsExportEnd, 'yyyy-MM-dd')}`;
    exportTimeslotsToICS(filtered, tasks, hint);
    setIcsExportDialogOpen(false);
  };

  const handleIcsImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parsed = parseICS(content);
      if (parsed.length === 0) {
        alert('未能解析到任何有效的時間事件，請確認檔案格式。');
        return;
      }
      if (window.confirm(`共解析到 ${parsed.length} 筆時間紀錄，是否全部匯入？`)) {
        let imported = 0;
        let skipped = 0;
        const currentTimeslots = useTaskStore.getState().timeslots;
        const currentTasks = useTaskStore.getState().tasks;
        const allTimeslots = [...currentTimeslots];

        parsed.forEach(p => {
          if (p.endTime) {
            const overlaps = findOverlappingTimeslots(allTimeslots, currentTasks, p.startTime, p.endTime);
            if (overlaps.length > 0) {
              skipped++;
              return;
            }
          }
          const newTs = {
            id: crypto.randomUUID(),
            startTime: p.startTime,
            endTime: p.endTime,
            subCategory: p.subCategory,
            note: p.note,
          };
          addTimeslot({
            startTime: p.startTime,
            endTime: p.endTime,
            subCategory: p.subCategory,
            note: p.note,
          });
          allTimeslots.push(newTs);
          imported++;
        });

        if (skipped > 0) {
          setOverlapError(`匯入完成：成功 ${imported} 筆，因時間重疊跳過 ${skipped} 筆。`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 非封存任務清單 + WBS 編號
  const activeTasks = useMemo(() => tasks.filter(t => !t.archived), [tasks]);
  const { wbsNumbers, sorted: sortedTasks } = useMemo(() => computeTaskWbsMap(activeTasks), [activeTasks]);

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton size="small" onClick={handlePrev}><ChevronLeft /></IconButton>
            <DatePicker
              label="日期"
              value={selectedDate}
              onChange={(d) => setSelectedDate(d)}
              slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
            />
            <IconButton size="small" onClick={handleNext}><ChevronRight /></IconButton>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Today />}
              onClick={() => setSelectedDate(new Date())}
              sx={{ ml: 0.5 }}
            >
              {view === 'day' ? '今天' : '本週'}
            </Button>
          </Box>

          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={(_, v) => v && setView(v)}
            size="small"
            color="primary"
          >
            <ToggleButton value="day">日</ToggleButton>
            <ToggleButton value="week5">週 (5天)</ToggleButton>
            <ToggleButton value="week7">週 (7天)</ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Height fontSize="small" color="action" />
            <ToggleButtonGroup
              value={hourHeight}
              exclusive
              onChange={(_, v) => v && setHourHeight(v)}
              size="small"
              color="secondary"
            >
              <ToggleButton value={60}>精簡</ToggleButton>
              <ToggleButton value={120}>詳細</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Palette fontSize="small" color="action" />
            <FormControl size="small" variant="outlined" sx={{ minWidth: 130 }}>
              <InputLabel>顏色</InputLabel>
              <Select
                value={colorMode}
                label="顏色"
                onChange={(e) => setColorMode(e.target.value as ColorMode)}
              >
                <MenuItem value="main">任務分類</MenuItem>
                <MenuItem value="sub">時間分類</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <FormControlLabel
            control={<Switch size="small" checked={showTooltip} onChange={(e) => setShowTooltip(e.target.checked)} />}
            label={<Typography variant="caption">顯示說明</Typography>}
            sx={{ ml: 1 }}
          />

          <Divider orientation="vertical" flexItem />

          <Button size="small" variant="outlined" startIcon={<CalendarMonth />} component="label">
            匯入 .ics
            <input type="file" hidden accept=".ics" onChange={handleIcsImport} />
          </Button>
          <Button size="small" variant="outlined" startIcon={<IosShare />}
            onClick={() => setIcsExportDialogOpen(true)}>
            批次匯出
          </Button>
        </Box>
      </Box>

      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── 固定日期標頭列 ── */}
        <Box sx={{ display: 'flex', flexShrink: 0, borderBottom: 2, borderColor: 'divider', bgcolor: 'background.paper', zIndex: 40 }}>
          <Box sx={{ width: 65, flexShrink: 0, borderRight: 1, borderColor: 'divider', height: HEADER_HEIGHT }} />
          <Box sx={{ display: 'flex', flexGrow: 1 }}>
            {displayDates.map((date, idx) => {
              const isToday = isSameDay(date, new Date());
              return (
                <Box key={idx} sx={{
                  flexGrow: 1, flexBasis: 0,
                  minWidth: view === 'day' ? '100%' : (view === 'week5' ? 150 : 120),
                  borderRight: 1, borderColor: 'divider',
                  height: HEADER_HEIGHT,
                  bgcolor: isToday ? 'rgba(25, 118, 210, 0.18)' : 'action.hover',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: isToday ? 'bold' : 'normal', fontSize: '0.75rem' }}>
                    {format(date, view === 'day' ? 'EEEE, MMMM do' : 'EEE MM/dd')}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* ── 可捲動的時間格區域 ── */}
        <Box
          ref={scrollRef}
          sx={{ flexGrow: 1, overflowY: 'auto', position: 'relative', display: 'flex' }}
        >
          {/* 時間軸（左側） */}
          <Box sx={{ width: 65, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', position: 'sticky', left: 0, zIndex: 30 }}>
            {hours.map(hour => (
              <Box key={hour} sx={{ height: hourHeight, borderBottom: 1, borderColor: 'divider', position: 'relative' }}>
                <Typography variant="caption" sx={{ position: 'absolute', top: -10, right: 8, color: 'text.secondary', fontWeight: 'bold', fontSize: '0.75rem' }}>
                  {hour < 10 ? `0${hour}` : hour}:00
                </Typography>
                <Box sx={{ position: 'absolute', top: hourHeight / 2, right: 0, width: 5, borderTop: 1, borderColor: 'divider' }} />
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', flexGrow: 1 }}>
            {displayDates.map((date, idx) => {
              const slots = slotsByDate.get(date.toDateString()) || [];
              const isToday = isSameDay(date, new Date());

              return (
                <Box key={idx} sx={{
                  flexGrow: 1, flexBasis: 0,
                  minWidth: view === 'day' ? '100%' : (view === 'week5' ? 150 : 120),
                  borderRight: 1, borderColor: 'divider',
                  position: 'relative',
                  bgcolor: isToday ? 'rgba(25, 118, 210, 0.04)' : 'transparent'
                }}>
                  {hours.map(hour => (
                    <Box
                      key={hour}
                      onClick={(e) => handleHourCellClick(date, hour, e)}
                      sx={{
                        height: hourHeight,
                        borderBottom: 1,
                        borderColor: 'divider',
                        position: 'relative',
                        cursor: 'cell',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ position: 'absolute', top: hourHeight / 2, left: 0, right: 0, borderTop: '1px dashed', borderColor: 'action.disabledBackground', pointerEvents: 'none' }} />
                    </Box>
                  ))}

                  {slots.map((slot) => {
                    const start = new Date(slot.startTime);
                    const end = new Date(slot.endTime!);

                    const startTotalMinutes = start.getHours() * 60 + start.getMinutes();
                    const snappedStartMinutes = Math.floor(startTotalMinutes / 5) * 5;

                    const endTotalMinutes = end.getHours() * 60 + end.getMinutes();
                    const snappedEndMinutes = Math.ceil(endTotalMinutes / 5) * 5;

                    const durationMinutes = Math.max(snappedEndMinutes - snappedStartMinutes, 10);
                    const topOffset = (snappedStartMinutes - (START_HOUR * 60)) * pixelsPerMinute;

                    if (snappedEndMinutes < START_HOUR * 60 || snappedStartMinutes > END_HOUR * 60) return null;

                    const targetCategory = colorMode === 'main' ? slot.mainCategory : slot.subCategory;
                    const blockColor = getCategoryColor(targetCategory);

                    const slotContent = (
                      <Box
                        onClick={(e) => { e.stopPropagation(); handleSlotClick(slot); }}
                        onDoubleClick={(e) => { e.stopPropagation(); handleSlotDoubleClick(slot); }}
                        sx={{
                          position: 'absolute',
                          top: topOffset,
                          height: durationMinutes * pixelsPerMinute,
                          left: 4,
                          right: 4,
                          bgcolor: blockColor,
                          color: 'white',
                          borderRadius: '4px',
                          p: '4px 8px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          zIndex: 1,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          borderLeft: '4px solid rgba(0,0,0,0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'transform 0.1s',
                          '&:hover': { zIndex: 10, filter: 'brightness(1.1)', transform: 'scale(1.01)' }
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 'bold', lineHeight: 1.2 }} noWrap>
                          {slot.aliasTitle || slot.taskTitle}
                        </Typography>
                        {(hourHeight === 120 || durationMinutes >= 30) && (
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.9 }} noWrap>
                            {format(start, 'HH:mm')}-{format(end, 'HH:mm')}
                          </Typography>
                        )}
                        {showTooltip && slot.note && (
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.8, fontStyle: 'italic', mt: 0.25 }} noWrap>
                            {slot.note}
                          </Typography>
                        )}
                      </Box>
                    );

                    return showTooltip && slot.note ? (
                      <Tooltip
                        key={slot.id}
                        title={slot.note}
                        arrow
                        placement={view === 'day' ? 'top' : 'right'}
                        enterDelay={500}
                      >
                        {slotContent}
                      </Tooltip>
                    ) : (
                      <React.Fragment key={slot.id}>
                        {slotContent}
                      </React.Fragment>
                    );
                  })}

                  {isToday && (
                    <Box sx={{
                      position: 'absolute',
                      top: (new Date().getHours() * 60 + new Date().getMinutes() - (START_HOUR * 60)) * pixelsPerMinute,
                      left: 0, right: 0, borderTop: '2px solid #d32f2f', zIndex: 20, pointerEvents: 'none',
                      '&::before': { content: '""', position: 'absolute', top: -4, left: -3, width: 8, height: 8, borderRadius: '50%', bgcolor: '#d32f2f' }
                    }} />
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Paper>

      {/* 編輯時間紀錄 Dialog */}
      <Dialog open={!!editingLog} onClose={() => setEditingLog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>編輯時間紀錄</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <DatePicker
              label="日期"
              value={editDate}
              onChange={(d) => setEditDate(d)}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="開始 (HH:mm)" fullWidth value={editStart} onChange={(e) => setEditStart(e.target.value)} size="small" />
              <TextField label="結束 (HH:mm)" fullWidth value={editEnd} onChange={(e) => setEditEnd(e.target.value)} disabled={!editingLog?.endTime && editEnd === ''} size="small" />
            </Box>
            <FormControl fullWidth size="small">
              <InputLabel>時間分類</InputLabel>
              <Select
                value={editSubCategory}
                label="時間分類"
                onChange={(e) => setEditSubCategory(e.target.value)}
              >
                <MenuItem value=""><em>無</em></MenuItem>
                {subCategories.map(sc => (
                  <MenuItem key={sc} value={sc}>{sc}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              size="small"
              options={sortedTasks}
              value={sortedTasks.find(t => t.id === editTaskId) ?? null}
              onChange={(_, task) => setEditTaskId(task ? task.id : '')}
              getOptionLabel={(task) => {
                const wbs = wbsNumbers.get(task.id);
                return wbs ? `${wbs}  ${task.title}` : task.title;
              }}
              renderOption={(props, task) => {
                const wbs = wbsNumbers.get(task.id);
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
                <TextField {...params} label="關聯任務（可選）" placeholder="無（未分類）" />
              )}
              clearOnEscape
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
            <TextField
              label="說明（此 timeslot 的備註）"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="記錄本次工作的具體內容..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={handleDeleteLog}>刪除紀錄</Button>
          <Button startIcon={<CalendarMonth />} size="small"
            onClick={() => editingLog && handleSingleIcsExport(editingLog)}>
            匯出 .ics
          </Button>
          <Button onClick={() => setEditingLog(null)}>取消</Button>
          <Button variant="contained" onClick={handleSaveLog}>儲存</Button>
        </DialogActions>
      </Dialog>

      {/* 快速新增時間紀錄 Dialog */}
      <Dialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>新增時間紀錄</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              size="small"
              options={sortedTasks}
              value={sortedTasks.find(t => t.id === quickAddTaskId) ?? null}
              onChange={(_, task) => setQuickAddTaskId(task ? task.id : '')}
              getOptionLabel={(task) => {
                const wbs = wbsNumbers.get(task.id);
                return wbs ? `${wbs}  ${task.title}` : task.title;
              }}
              renderOption={(props, task) => {
                const wbs = wbsNumbers.get(task.id);
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
                <TextField {...params} label="選擇任務（可選）" placeholder="無（未分類）" />
              )}
              clearOnEscape
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
            <FormControl fullWidth size="small">
              <InputLabel>時間分類（可選）</InputLabel>
              <Select
                value={quickAddSubCategory}
                label="時間分類（可選）"
                onChange={(e) => setQuickAddSubCategory(e.target.value)}
              >
                <MenuItem value=""><em>無</em></MenuItem>
                {subCategories.map(sc => (
                  <MenuItem key={sc} value={sc}>{sc}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <DatePicker
              label="日期"
              value={quickAddDate}
              onChange={(d) => d && setQuickAddDate(d)}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="開始 (HH:mm)" fullWidth value={quickAddStart} onChange={(e) => setQuickAddStart(e.target.value)} size="small" />
              <TextField label="結束 (HH:mm)" fullWidth value={quickAddEnd} onChange={(e) => setQuickAddEnd(e.target.value)} size="small" />
            </Box>
            <TextField
              label="說明（可選）"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={quickAddNote}
              onChange={(e) => setQuickAddNote(e.target.value)}
              placeholder="記錄本次工作的具體內容..."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button
            size="small"
            onClick={() => {
              pendingQuickAdd.current = true;
              prevTaskIdsRef.current = new Set(tasks.map(t => t.id));
              setQuickAddOpen(false);
              setEditingTask(undefined);
              setTaskFormOpen(true);
            }}
          >
            建立新任務
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setQuickAddOpen(false)}>取消</Button>
            <Button
              variant="contained"
              onClick={handleQuickAddSave}
              disabled={!quickAddStart || !quickAddEnd}
            >
              確認新增
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* 批次匯出 .ics Dialog */}
      <Dialog open={icsExportDialogOpen} onClose={() => setIcsExportDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>批次匯出 .ics</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            選擇要匯出的時段，範圍內所有時間紀錄將合併為單一 .ics 檔案。
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <DatePicker label="起始日期" value={icsExportStart} onChange={setIcsExportStart} />
            <DatePicker label="結束日期" value={icsExportEnd} onChange={setIcsExportEnd} />
            {icsExportStart && icsExportEnd && (
              <Typography variant="body2" color="text.secondary">
                範圍內共 {timeslots.filter(ts =>
                  ts.startTime >= startOfDay(icsExportStart).getTime() &&
                  ts.startTime <= endOfDay(icsExportEnd).getTime()
                ).length} 筆時間紀錄
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIcsExportDialogOpen(false)}>取消</Button>
          <Button variant="contained" startIcon={<IosShare />}
            disabled={!icsExportStart || !icsExportEnd}
            onClick={handleBatchIcsExport}>
            匯出
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!overlapError}
        autoHideDuration={8000}
        onClose={() => setOverlapError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setOverlapError('')} variant="filled">
          {overlapError}
        </Alert>
      </Snackbar>

      <TaskForm
        open={taskFormOpen}
        onClose={() => {
          setTaskFormOpen(false);
          setEditingTask(undefined);
          if (pendingQuickAdd.current) {
            pendingQuickAdd.current = false;
            const latestTasks = useTaskStore.getState().tasks;
            const newTask = latestTasks.find(t => !prevTaskIdsRef.current.has(t.id));
            if (newTask) setQuickAddTaskId(newTask.id);
            setQuickAddOpen(true);
          }
        }}
        initialData={editingTask}
      />
    </Box>
  );
};
