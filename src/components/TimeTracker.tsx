import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Box, Paper, Typography, Button,  
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Pause, Palette, Height } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useTaskStore } from '../store/useTaskStore';
import { format, startOfDay, endOfDay, startOfWeek, addDays, isSameDay } from 'date-fns';
import { getCategoryColor } from '../utils/colors';
import type { TimeLog } from '../types';

interface TimeSlot extends TimeLog {
  taskId: string;
  taskTitle: string;
  aliasTitle: string;
  mainCategory: string;
  subCategory: string;
  date: Date;
}

const START_HOUR = 7;
const END_HOUR = 22;
const HEADER_HEIGHT = 40;

type ViewType = 'day' | 'week5' | 'week7';
type ColorMode = 'main' | 'sub';
type ZoomLevel = 60 | 120;

export const TimeTracker: React.FC = () => {
  const { tasks, stopTimer, updateTimeLog, deleteTimeLog } = useTaskStore();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [view, setView] = useState<ViewType>('week5');
  const [colorMode, setColorMode] = useState<ColorMode>('main');
  const [hourHeight, setHourHeight] = useState<ZoomLevel>(60);
  
  const activeTask = tasks.find(t => t.status === 'IN_PROGRESS');
  const scrollRef = useRef<HTMLDivElement>(null);

  const pixelsPerMinute = hourHeight / 60;

  const displayDates = useMemo(() => {
    if (!selectedDate) return [];
    if (view === 'day') return [startOfDay(selectedDate)];
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const count = view === 'week5' ? 5 : 7;
    return Array.from({ length: count }, (_, i) => addDays(monday, i));
  }, [selectedDate, view]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    
    displayDates.forEach(date => {
      const dayStart = startOfDay(date).getTime();
      const dayEnd = endOfDay(date).getTime();
      const slots: TimeSlot[] = [];

      tasks.forEach(task => {
        task.timeLogs.forEach(log => {
          const effectiveStart = Math.max(log.startTime, dayStart);
          const effectiveEnd = Math.min(log.endTime || Date.now(), dayEnd);

          if (effectiveStart < dayEnd && effectiveEnd > dayStart) {
             slots.push({
               ...log,
               startTime: effectiveStart,
               endTime: effectiveEnd,
               date: date,
               taskId: task.id,
               taskTitle: task.title,
               aliasTitle: task.aliasTitle,
               mainCategory: task.mainCategory,
               subCategory: task.subCategory,
             });
          }
        });
      });
      map.set(date.toDateString(), slots.sort((a, b) => a.startTime - b.startTime));
    });
    
    return map;
  }, [tasks, displayDates]);
  
  useEffect(() => {
      if (scrollRef.current) {
          const allSlots = Array.from(slotsByDate.values()).flat();
          const firstHour = allSlots.length > 0 ? new Date(Math.min(...allSlots.map(s => s.startTime))).getHours() : 8;
          const targetHour = Math.max(firstHour - START_HOUR, 0);
          scrollRef.current.scrollTop = targetHour * hourHeight;
      }
  }, [selectedDate, view, hourHeight, slotsByDate]);

  const [editingLog, setEditingLog] = useState<TimeSlot | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const handleSlotClick = (slot: TimeSlot) => {
    setEditingLog(slot);
    setEditStart(format(slot.startTime, 'HH:mm'));
    const isRunning = !tasks.find(t => t.id === slot.taskId)?.timeLogs.find(l => l.id === slot.id)?.endTime;
    setEditEnd(isRunning ? '' : format(slot.endTime!, 'HH:mm'));
  };

  const handleSaveLog = () => {
    if (editingLog) {
      const [sh, sm] = editStart.split(':').map(Number);
      const newStart = new Date(editingLog.date);
      newStart.setHours(sh, sm, 0, 0);

      let newEnd = editingLog.endTime || 0;
      if (editEnd) {
         const [eh, em] = editEnd.split(':').map(Number);
         const d = new Date(editingLog.date);
         d.setHours(eh, em, 0, 0);
         newEnd = d.getTime();
      } else {
        const originalLog = tasks.find(t => t.id === editingLog.taskId)?.timeLogs.find(l => l.id === editingLog.id);
        if (originalLog?.endTime) newEnd = originalLog.endTime;
      }
      
      updateTimeLog(editingLog.taskId, editingLog.id, newStart.getTime(), newEnd);
      setEditingLog(null);
    }
  };
  
  const handleDeleteLog = () => {
      if(editingLog) {
          deleteTimeLog(editingLog.taskId, editingLog.id);
          setEditingLog(null);
      }
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <DatePicker 
                label="Date"
                value={selectedDate} 
                onChange={(d) => setSelectedDate(d)}
                slotProps={{ textField: { size: 'small' } }}
            />
            <ToggleButtonGroup
                value={view}
                exclusive
                onChange={(_, v) => v && setView(v)}
                size="small"
                color="primary"
            >
                <ToggleButton value="day">Day</ToggleButton>
                <ToggleButton value="week5">Week (5D)</ToggleButton>
                <ToggleButton value="week7">Week (7D)</ToggleButton>
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
                    <ToggleButton value={60}>Compact (60px)</ToggleButton>
                    <ToggleButton value={120}>Detail (120px)</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Palette fontSize="small" color="action" />
                <FormControl size="small" variant="outlined" sx={{ minWidth: 150 }}>
                    <InputLabel>Color Mode</InputLabel>
                    <Select
                        value={colorMode}
                        label="Color Mode"
                        onChange={(e) => setColorMode(e.target.value as ColorMode)}
                    >
                        <MenuItem value="main">By Main Category</MenuItem>
                        <MenuItem value="sub">By Sub Category</MenuItem>
                    </Select>
                </FormControl>
            </Box>
        </Box>

        {activeTask && (
            <Paper elevation={1} sx={{ px: 2, py: 1, bgcolor: '#e3f2fd', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2"><b>Live:</b> {activeTask.title}</Typography>
                <Button size="small" variant="contained" color="warning" startIcon={<Pause />} onClick={() => stopTimer(activeTask.id)}>Stop</Button>
            </Paper>
        )}
      </Box>

      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box 
            ref={scrollRef}
            sx={{ flexGrow: 1, overflowY: 'auto', position: 'relative', display: 'flex' }}
        >
            <Box sx={{ width: 65, flexShrink: 0, borderRight: '1px solid #ddd', bgcolor: '#fafafa', position: 'sticky', left: 0, zIndex: 30 }}>
                <Box sx={{ height: HEADER_HEIGHT, borderBottom: '2px solid #ddd' }} />
                {hours.map(hour => (
                    <Box key={hour} sx={{ height: hourHeight, borderBottom: '1px solid #eee', position: 'relative' }}>
                        <Typography variant="caption" sx={{ position: 'absolute', top: -10, right: 8, color: 'text.secondary', fontWeight: 'bold', fontSize: '0.75rem' }}>
                            {hour < 10 ? `0${hour}` : hour}:00
                        </Typography>
                        <Box sx={{ position: 'absolute', top: hourHeight/2, right: 0, width: 5, borderTop: '1px solid #ccc' }} />
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
                            borderRight: '1px solid #ddd', 
                            position: 'relative',
                            bgcolor: isToday ? 'rgba(25, 118, 210, 0.02)' : 'transparent'
                        }}>
                            <Box sx={{ 
                                height: HEADER_HEIGHT, borderBottom: '2px solid #ddd', 
                                bgcolor: isToday ? '#e3f2fd' : '#f5f5f5', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                position: 'sticky', top: 0, zIndex: 25 
                            }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: isToday ? 'bold' : 'normal' }}>
                                    {format(date, view === 'day' ? 'EEEE, MMMM do' : 'EEE MM/dd')}
                                </Typography>
                            </Box>

                            {hours.map(hour => (
                                <Box key={hour} sx={{ height: hourHeight, borderBottom: '1px solid #e0e0e0', position: 'relative' }}>
                                     <Box sx={{ position: 'absolute', top: hourHeight/2, left: 0, right: 0, borderTop: '1px dashed #f0f0f0' }} />
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

                                return (
                                    <Box
                                        key={slot.id}
                                        onClick={() => handleSlotClick(slot)}
                                        sx={{
                                            position: 'absolute',
                                            top: HEADER_HEIGHT + topOffset,
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
                                    </Box>
                                );
                            })}

                            {isToday && (
                                <Box sx={{ 
                                    position: 'absolute', 
                                    top: HEADER_HEIGHT + ((new Date().getHours() * 60 + new Date().getMinutes() - (START_HOUR * 60)) * pixelsPerMinute), 
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

      <Dialog open={!!editingLog} onClose={() => setEditingLog(null)}>
        <DialogTitle>Edit Time Log ({editingLog ? format(editingLog.date, 'MM/dd') : ''})</DialogTitle>
        <DialogContent>
           <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <TextField label="Start (HH:mm)" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
              <TextField label="End (HH:mm)" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} disabled={!editingLog?.endTime && editEnd === ''} />
           </Box>
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={handleDeleteLog}>Delete</Button>
          <Button onClick={() => setEditingLog(null)}>Cancel</Button>
          <Button onClick={handleSaveLog} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};