import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Autocomplete, TextField, Stack,
} from '@mui/material';
import { Timeline as TimelineIcon } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';

const TaskTimelinePage: React.FC = () => {
  const { tasks } = useTaskStore();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Only show tasks that have timeline entries
  const tasksWithTimeline = useMemo(
    () => tasks.filter((t) => (t.timelineEntries ?? []).length > 0),
    [tasks]
  );

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const entries = selectedTask?.timelineEntries ?? [];

  // Group by date, sorted desc
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const grouped = sorted.reduce<Record<string, typeof sorted>>((acc, entry) => {
    (acc[entry.date] ??= []).push(entry);
    return acc;
  }, {});
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <Box>
      <Typography variant="h5" gutterBottom>事件時間軸</Typography>

      {/* Task selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Autocomplete
          options={tasksWithTimeline}
          getOptionLabel={(t) => `${t.title}（${(t.timelineEntries ?? []).length} 筆事件）`}
          value={tasksWithTimeline.find((t) => t.id === selectedTaskId) ?? null}
          onChange={(_, v) => setSelectedTaskId(v?.id ?? null)}
          renderInput={(params) => (
            <TextField {...params} label="選擇有事件記錄的任務" placeholder="搜尋任務名稱..." />
          )}
          noOptionsText="尚無任何任務有事件記錄。請在任務編輯畫面中新增事件。"
          isOptionEqualToValue={(option, value) => option.id === value.id}
        />
      </Paper>

      {/* Prompt when nothing selected */}
      {!selectedTaskId && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          {tasksWithTimeline.length === 0
            ? '尚無任何任務有事件記錄。請在「任務管理 → 編輯任務 → 事件時間軸」中新增事件。'
            : '請選擇一個任務以檢視其事件時間軸。'}
        </Typography>
      )}

      {/* Timeline display */}
      {selectedTaskId && selectedTask && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>{selectedTask.title}</Typography>

          {dateKeys.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
              此任務尚無事件記錄。
            </Typography>
          ) : (
            <Box sx={{ position: 'relative', pl: 3 }}>
              {/* Vertical line */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 12,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  bgcolor: 'primary.main',
                  opacity: 0.3,
                }}
              />

              {dateKeys.map((dateKey) => (
                <Box key={dateKey} sx={{ mb: 3 }}>
                  {/* Date marker */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, ml: -3 }}>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 1,
                        flexShrink: 0,
                      }}
                    >
                      <TimelineIcon sx={{ fontSize: 14, color: 'white' }} />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {dateKey}
                    </Typography>
                  </Box>

                  {/* Entries for this date */}
                  <Stack spacing={0.5} sx={{ ml: 1 }}>
                    {grouped[dateKey].map((entry) => (
                      <Paper key={entry.id} sx={{ p: 1.5 }} variant="outlined">
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{entry.content}</Typography>
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
