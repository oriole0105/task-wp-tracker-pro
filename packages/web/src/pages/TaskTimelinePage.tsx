import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Autocomplete, TextField, Stack,
  Button, IconButton, Chip,
} from '@mui/material';
import { Add, Delete, Timeline as TimelineIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useTaskStore } from '../store/useTaskStore';
import type { TaskTimelineEntry } from '@tt/shared/types';

const TaskTimelinePage: React.FC = () => {
  const { tasks, updateTask } = useTaskStore();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newContent, setNewContent] = useState('');

  const activeTasks = useMemo(
    () => tasks.filter(t => !t.archived),
    [tasks],
  );

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const entries: TaskTimelineEntry[] = selectedTask?.timelineEntries ?? [];

  const grouped = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.reduce<Record<string, TaskTimelineEntry[]>>((acc, entry) => {
      (acc[entry.date] ??= []).push(entry);
      return acc;
    }, {});
  }, [entries]);

  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const handleAdd = () => {
    if (!selectedTaskId || !newContent.trim() || !newDate) return;
    const updated = [...entries, { id: uuidv4(), date: newDate, content: newContent.trim() }];
    updateTask(selectedTaskId, { timelineEntries: updated });
    setNewContent('');
  };

  const handleDelete = (id: string) => {
    if (!selectedTaskId) return;
    updateTask(selectedTaskId, { timelineEntries: entries.filter(e => e.id !== id) });
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>事件時間軸</Typography>

      {/* Task selector */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Autocomplete
          options={activeTasks}
          getOptionLabel={(t) => {
            const count = (t.timelineEntries ?? []).length;
            return count > 0 ? `${t.title}（${count} 筆事件）` : t.title;
          }}
          value={activeTasks.find(t => t.id === selectedTaskId) ?? null}
          onChange={(_, v) => {
            setSelectedTaskId(v?.id ?? null);
            setNewContent('');
          }}
          renderInput={(params) => (
            <TextField {...params} label="選擇任務" placeholder="搜尋任務名稱..." />
          )}
          noOptionsText="沒有符合的任務"
          isOptionEqualToValue={(option, value) => option.id === value.id}
        />
      </Paper>

      {!selectedTaskId && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          選擇一個任務以檢視或新增事件記錄。
        </Typography>
      )}

      {selectedTaskId && selectedTask && (
        <>
          {/* New entry form */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>新增事件</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="日期"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 160 }}
              />
              <TextField
                size="small"
                label="事件描述"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                sx={{ flex: 1, minWidth: 200 }}
              />
              <Button
                variant="outlined"
                startIcon={<Add />}
                disabled={!newContent.trim() || !newDate}
                onClick={handleAdd}
                sx={{ mt: 0.5 }}
              >
                新增
              </Button>
            </Box>
          </Paper>

          {/* Timeline */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            {selectedTask.title}
            <Chip
              label={`${entries.length} 筆事件`}
              size="small"
              sx={{ ml: 1, verticalAlign: 'middle' }}
            />
          </Typography>

          {dateKeys.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
              尚無事件記錄。使用上方表單新增第一筆。
            </Typography>
          ) : (
            <Box sx={{ position: 'relative', pl: 3 }}>
              {/* Vertical line */}
              <Box sx={{
                position: 'absolute', left: 12, top: 0, bottom: 0,
                width: 2, bgcolor: 'primary.main', opacity: 0.3,
              }} />

              {dateKeys.map((dateKey) => (
                <Box key={dateKey} sx={{ mb: 3 }}>
                  {/* Date marker */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, ml: -3 }}>
                    <Box sx={{
                      width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.main',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mr: 1, flexShrink: 0,
                    }}>
                      <TimelineIcon sx={{ fontSize: 14, color: 'white' }} />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {dateKey}
                    </Typography>
                  </Box>

                  <Stack spacing={0.5} sx={{ ml: 1 }}>
                    {grouped[dateKey].map((entry) => (
                      <Paper key={entry.id} sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1 }} variant="outlined">
                        <Typography sx={{ whiteSpace: 'pre-wrap', flex: 1 }}>{entry.content}</Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(entry.id)}
                          sx={{ flexShrink: 0, mt: -0.5 }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default TaskTimelinePage;
