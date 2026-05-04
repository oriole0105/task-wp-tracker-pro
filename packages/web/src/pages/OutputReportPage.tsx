import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Grid, Link, Chip, IconButton, TextField, InputAdornment, Tabs, Tab
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import { startOfDay, endOfDay, isValid, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import type { Task } from '@tt/shared/types';

const formatDuration = (totalMinutes: number) => {
  if (totalMinutes === 0) return '0分';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}時`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}分`);
  return parts.join(' ');
};

const formatTime = (ms: number) => {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  return formatDuration(totalMinutes);
};

interface IndexedTaskWithOutputs extends Task {
  indexDisplay: string;
  timeSpentInRange: number;
}

interface GroupedOutput {
  id: string;
  name: string;
  totalTimeSpent: number;
  outputs: { id: string; name: string; link?: string; completeness?: string; mainCategory?: string; outputTypeId?: string; summary?: string }[];
}

const OutputReportPage: React.FC = () => {
  const { tasks, timeslots, outputTypes, updateWorkOutput } = useTaskStore();

  const [startDate, setStartDate] = useState<Date | null>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [endDate, setEndDate] = useState<Date | null>(endOfWeek(new Date(), { weekStartsOn: 0 }));
  const [displayMode, setDisplayMode] = useState<'task' | 'mainCategory' | 'subCategory'>('task');

  const handleDisplayModeChange = (_: React.SyntheticEvent, newValue: 'task' | 'mainCategory' | 'subCategory') => {
    setDisplayMode(newValue);
  };

  const handlePrevWeek = () => {
    if (startDate && endDate) {
      setStartDate(subWeeks(startDate, 1));
      setEndDate(subWeeks(endDate, 1));
    }
  };

  const handleNextWeek = () => {
    if (startDate && endDate) {
      setStartDate(addWeeks(startDate, 1));
      setEndDate(addWeeks(endDate, 1));
    }
  };

  const startTs = useMemo(() =>
    startDate && isValid(startDate) ? startOfDay(startDate).getTime() : null,
    [startDate]
  );
  const endTs = useMemo(() =>
    endDate && isValid(endDate) ? endOfDay(endDate).getTime() : null,
    [endDate]
  );

  const filteredTasksInRange = useMemo(() => {
    if (startTs === null || endTs === null) return [];
    return tasks.filter(task =>
      timeslots.some(ts => {
        if (ts.taskId !== task.id) return false;
        const effectiveStart = Math.max(ts.startTime, startTs);
        const effectiveEnd = Math.min(ts.endTime || Date.now(), endTs);
        return effectiveStart < effectiveEnd;
      })
    );
  }, [tasks, timeslots, startTs, endTs]);

  const processedData = useMemo(() => {
    if (startTs === null || endTs === null) return [];

    const calculateTaskTimeSpent = (task: Task) => {
      return timeslots
        .filter(ts => ts.taskId === task.id)
        .reduce((acc, ts) => {
          const effectiveStart = Math.max(ts.startTime, startTs!);
          const effectiveEnd = Math.min(ts.endTime || Date.now(), endTs!);
          return effectiveStart < effectiveEnd ? acc + (effectiveEnd - effectiveStart) : acc;
        }, 0);
    };

    if (displayMode === 'task') {
      const result: IndexedTaskWithOutputs[] = [];
      const buildHierarchy = (parentId: string | undefined, prefix: string, tasksToProcess: Task[]) => {
        const children = tasksToProcess.filter(t => t.parentId === parentId);
        children.forEach((child, i) => {
          const currentIndex = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
          result.push({ ...child, timeSpentInRange: calculateTaskTimeSpent(child), indexDisplay: currentIndex });
          buildHierarchy(child.id, currentIndex, tasksToProcess);
        });
      };

      const roots = filteredTasksInRange.filter(t => !t.parentId || !filteredTasksInRange.find(p => p.id === t.parentId));
      roots.forEach((task, i) => {
        const currentIndex = `${i + 1}`;
        result.push({ ...task, timeSpentInRange: calculateTaskTimeSpent(task), indexDisplay: currentIndex });
        buildHierarchy(task.id, currentIndex, filteredTasksInRange);
      });
      return result;

    } else if (displayMode === 'mainCategory') {
      const mainCategoryMap = new Map<string, GroupedOutput>();

      // Sum time from timeslots grouped by task.mainCategory
      timeslots.forEach(ts => {
        if (!ts.taskId) return;
        const effectiveStart = Math.max(ts.startTime, startTs!);
        const effectiveEnd = Math.min(ts.endTime || Date.now(), endTs!);
        if (effectiveStart >= effectiveEnd) return;

        const task = tasks.find(t => t.id === ts.taskId);
        const categoryName = task?.mainCategory || '其他';
        const timeSpent = effectiveEnd - effectiveStart;

        if (!mainCategoryMap.has(categoryName)) {
          mainCategoryMap.set(categoryName, { id: categoryName, name: categoryName, totalTimeSpent: 0, outputs: [] });
        }
        mainCategoryMap.get(categoryName)!.totalTimeSpent += timeSpent;
      });

      // Collect outputs from filtered tasks
      filteredTasksInRange.forEach(task => {
        const categoryName = task.mainCategory || '其他';
        if (!mainCategoryMap.has(categoryName)) {
          mainCategoryMap.set(categoryName, { id: categoryName, name: categoryName, totalTimeSpent: 0, outputs: [] });
        }
        const group = mainCategoryMap.get(categoryName)!;
        task.outputs.forEach(output => {
          if (!group.outputs.some(o => o.id === output.id)) {
            group.outputs.push({ ...output, mainCategory: task.mainCategory });
          }
        });
      });

      return Array.from(mainCategoryMap.values());

    } else { // subCategory
      const subCategoryMap = new Map<string, GroupedOutput>();

      // Sum time from timeslots grouped by ts.subCategory
      timeslots.forEach(ts => {
        const effectiveStart = Math.max(ts.startTime, startTs!);
        const effectiveEnd = Math.min(ts.endTime || Date.now(), endTs!);
        if (effectiveStart >= effectiveEnd) return;

        const categoryName = ts.subCategory || '其他';
        const timeSpent = effectiveEnd - effectiveStart;

        if (!subCategoryMap.has(categoryName)) {
          subCategoryMap.set(categoryName, { id: categoryName, name: categoryName, totalTimeSpent: 0, outputs: [] });
        }
        const group = subCategoryMap.get(categoryName)!;
        group.totalTimeSpent += timeSpent;

        // Collect outputs from linked task (avoid duplicates)
        if (ts.taskId) {
          const task = tasks.find(t => t.id === ts.taskId);
          if (task) {
            task.outputs.forEach(output => {
              if (!group.outputs.some(o => o.id === output.id)) {
                group.outputs.push({ ...output, mainCategory: task.mainCategory });
              }
            });
          }
        }
      });

      return Array.from(subCategoryMap.values());
    }
  }, [filteredTasksInRange, displayMode, startTs, endTs, tasks, timeslots]);

  const handleCompletenessChange = (taskId: string, outputId: string, value: string) => {
    const val = value === '' ? '' : Math.min(100, Math.max(0, parseInt(value) || 0)).toString();
    updateWorkOutput(taskId, outputId, { completeness: val });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>工作產出追蹤</Typography>

      <Paper sx={{ p: 2, mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid>
            <Typography variant="h6">統計區間：</Typography>
          </Grid>
          <Grid sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handlePrevWeek} title="前一週"><ChevronLeft /></IconButton>
            <DatePicker value={startDate} onChange={setStartDate} label="開始日期" slotProps={{ textField: { size: 'small' } }} />
            <Typography>-</Typography>
            <DatePicker value={endDate} onChange={setEndDate} label="結束日期" slotProps={{ textField: { size: 'small' } }} />
            <IconButton onClick={handleNextWeek} title="後一週"><ChevronRight /></IconButton>
          </Grid>
          <Grid sx={{ ml: 2 }}>
            <Typography variant="body2" color="textSecondary">
              * 僅顯示在此區間內有執行紀錄（工時紀錄）的任務。
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={displayMode} onChange={handleDisplayModeChange} aria-label="work output display modes">
          <Tab label="按任務" value="task" />
          <Tab label="按任務分類" value="mainCategory" />
          <Tab label="按時間分類" value="subCategory" />
        </Tabs>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell>{displayMode === 'task' ? '任務名稱' : '分類名稱'}</TableCell>
              {displayMode === 'task' && <TableCell>任務分類</TableCell>}
              <TableCell>累計工時</TableCell>
              <TableCell>工作產出名稱</TableCell>
              <TableCell width={150}>完成度 (%)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {processedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={displayMode === 'task' ? 5 : 4} align="center" sx={{ py: 8 }}>
                  <Typography color="textSecondary">此區間內無工作紀錄。</Typography>
                </TableCell>
              </TableRow>
            ) : processedData.map((item) => {
              const itemOutputs = item.outputs || [];
              const isTaskMode = displayMode === 'task';
              const taskItem = isTaskMode ? (item as IndexedTaskWithOutputs) : undefined;
              const groupedItem = !isTaskMode ? (item as GroupedOutput) : undefined;

              return (
                <React.Fragment key={item.id}>
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {isTaskMode ? taskItem?.title : groupedItem?.name}
                    </TableCell>
                    {isTaskMode && (
                      <TableCell>
                        <Chip label={taskItem?.mainCategory || '其他'} size="small" variant="outlined" title="任務分類" />
                      </TableCell>
                    )}
                    <TableCell>{formatTime(isTaskMode ? (taskItem?.timeSpentInRange ?? 0) : (item as GroupedOutput).totalTimeSpent)}</TableCell>
                    {itemOutputs.length === 0 && (
                      <TableCell colSpan={2}>
                        <Typography variant="caption" color="textDisabled">無產出紀錄</Typography>
                      </TableCell>
                    )}
                  </TableRow>

                  {itemOutputs.map((output, index) => {
                    const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
                    const isIntangible = otMeta !== undefined && !otMeta.isTangible;
                    return (
                    <TableRow key={`${item.id}-${output.id}-${index}`} sx={{ bgcolor: 'rgba(0,0,0,0.01)' }}>
                      <TableCell colSpan={isTaskMode ? 3 : 2} />
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                          {output.link && !isIntangible ? (
                            <Link href={output.link} target="_blank" rel="noopener" underline="hover">
                              {output.name}
                            </Link>
                          ) : (
                            <Typography variant="body2">{output.name}</Typography>
                          )}
                          {otMeta && (
                            <Chip
                              label={otMeta.name}
                              size="small"
                              color={otMeta.isTangible ? 'primary' : 'secondary'}
                              variant="outlined"
                            />
                          )}
                        </Box>
                        {isIntangible && output.summary && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {output.summary}
                          </Typography>
                        )}
                        {!isTaskMode && output.mainCategory && (
                          <Box sx={{ mt: 0.5 }}>
                            <Chip label={output.mainCategory} size="small" variant="outlined" title="任務分類" />
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          variant="standard"
                          value={output.completeness || ''}
                          onChange={isTaskMode ? (e) => handleCompletenessChange(item.id, output.id, e.target.value) : undefined}
                          inputProps={{ min: 0, max: 100, style: { textAlign: 'right', fontWeight: 'bold' } }}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">%</InputAdornment>,
                            disableUnderline: false,
                            readOnly: !isTaskMode,
                          }}
                          sx={{ width: 80 }}
                        />
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default OutputReportPage;
