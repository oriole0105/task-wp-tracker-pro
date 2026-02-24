import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Grid, Link, Chip, IconButton, TextField, InputAdornment, Tabs, Tab
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import { startOfDay, endOfDay, isValid, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import type { Task } from '../types';

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
}

interface GroupedOutput {
  id: string; // Using ID for consistent keying, could be category name itself
  name: string;
  totalTimeSpent: number;
  outputs: { id: string; name: string; link?: string; completeness?: string; mainCategory?: string; subCategory?: string }[];
  mainCategory?: string; // For subCategory view, to show parent main category
  subCategory?: string; // For mainCategory view, to show child sub category
}

const OutputReportPage: React.FC = () => {
  const { tasks, updateWorkOutput } = useTaskStore();
  
  const [startDate, setStartDate] = useState<Date | null>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState<Date | null>(endOfWeek(new Date(), { weekStartsOn: 1 }));
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

  const filteredTasksInRange = useMemo(() => {
    if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) return [];

    const startTs = startOfDay(startDate).getTime();
    const endTs = endOfDay(endDate).getTime();

    const activeTasks = tasks.filter(task => {
        if (!task.timeLogs) return false;
        return task.timeLogs.some(log => {
            const effectiveStart = Math.max(log.startTime, startTs);
            const effectiveEnd = Math.min(log.endTime || Date.now(), endTs);
            return effectiveStart < effectiveEnd;
        });
    });
    return activeTasks;
  }, [tasks, startDate, endDate]);

  const processedData = useMemo(() => {
    if (filteredTasksInRange.length === 0) return [];

    const startTs = startOfDay(startDate!).getTime(); // startDate and endDate are valid here because of filteredTasksInRange's check
    const endTs = endOfDay(endDate!).getTime();
    
    // Helper to calculate actual time spent for a task within the selected range
    const calculateTaskTimeSpent = (task: Task) => {
        return (task.timeLogs || []).reduce((acc, log) => {
            const effectiveStart = Math.max(log.startTime, startTs);
            const effectiveEnd = Math.min(log.endTime || Date.now(), endTs);
            return effectiveStart < effectiveEnd ? acc + (effectiveEnd - effectiveStart) : acc;
        }, 0);
    };

    if (displayMode === 'task') {
      const result: IndexedTaskWithOutputs[] = [];
      const buildHierarchy = (parentId: string | undefined, prefix: string, tasksToProcess: Task[]) => {
        const children = tasksToProcess.filter(t => t.parentId === parentId);
        children.forEach((child, i) => {
          const currentIndex = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
          result.push({ ...child, totalTimeSpent: calculateTaskTimeSpent(child), indexDisplay: currentIndex });
          buildHierarchy(child.id, currentIndex, tasksToProcess);
        });
      };

      const roots = filteredTasksInRange.filter(t => !t.parentId || !filteredTasksInRange.find(p => p.id === t.parentId));
      roots.forEach((task, i) => {
          const currentIndex = `${i + 1}`;
          result.push({ ...task, totalTimeSpent: calculateTaskTimeSpent(task), indexDisplay: currentIndex });
          buildHierarchy(task.id, currentIndex, filteredTasksInRange);
      });
      return result;

    } else if (displayMode === 'mainCategory') {
      const mainCategoryMap = new Map<string, GroupedOutput>();
      
      filteredTasksInRange.forEach(task => {
        const categoryName = task.mainCategory || '其他';
        const timeSpent = calculateTaskTimeSpent(task);

        if (!mainCategoryMap.has(categoryName)) {
          mainCategoryMap.set(categoryName, {
            id: categoryName,
            name: categoryName,
            totalTimeSpent: 0,
            outputs: [],
          });
        }
        const currentGroup = mainCategoryMap.get(categoryName)!;
        currentGroup.totalTimeSpent += timeSpent;
        task.outputs.forEach(output => currentGroup.outputs.push({ ...output, mainCategory: task.mainCategory, subCategory: task.subCategory }));
      });
      return Array.from(mainCategoryMap.values());

    } else { // subCategory
      const subCategoryMap = new Map<string, GroupedOutput>();

      filteredTasksInRange.forEach(task => {
        const categoryName = task.subCategory || '其他';
        const timeSpent = calculateTaskTimeSpent(task);

        if (!subCategoryMap.has(categoryName)) {
          subCategoryMap.set(categoryName, {
            id: categoryName,
            name: categoryName,
            totalTimeSpent: 0,
            outputs: [],
            mainCategory: task.mainCategory || '其他',
          });
        }
        const currentGroup = subCategoryMap.get(categoryName)!;
        currentGroup.totalTimeSpent += timeSpent;
        task.outputs.forEach(output => currentGroup.outputs.push({ ...output, mainCategory: task.mainCategory, subCategory: task.subCategory }));
      });
      return Array.from(subCategoryMap.values());
    }
  }, [filteredTasksInRange, displayMode, startDate, endDate]);


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
              {displayMode === 'task' && <TableCell>分類</TableCell>}
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

              // Cast item based on displayMode to access specific properties
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
                        <Chip label={taskItem?.mainCategory || '其他'} size="small" variant="outlined" sx={{ mr: 0.5 }} title="任務分類" />
                        <Chip label={taskItem?.subCategory || '其他'} size="small" variant="outlined" color="primary" title="時間分類" />
                      </TableCell>
                    )}
                    <TableCell>{formatTime(item.totalTimeSpent)}</TableCell>
                    {itemOutputs.length === 0 && (
                        <TableCell colSpan={2}>
                            <Typography variant="caption" color="textDisabled">無產出紀錄</Typography>
                        </TableCell>
                    )}
                  </TableRow>
                  
                  {itemOutputs.map((output, index) => (
                      <TableRow key={`${item.id}-${output.id}-${index}`} sx={{ bgcolor: 'rgba(0,0,0,0.01)' }}>
                          <TableCell colSpan={isTaskMode ? 3 : 2} />
                          <TableCell>
                              {output.link ? (
                                  <Link href={output.link} target="_blank" rel="noopener" underline="hover">
                                      {output.name}
                                  </Link>
                              ) : (
                                  <Typography variant="body2">{output.name}</Typography>
                              )}
                              {!isTaskMode && (
                                <Box sx={{ mt: 0.5 }}>
                                  {output.mainCategory && <Chip label={output.mainCategory} size="small" variant="outlined" sx={{ mr: 0.5 }} title="任務分類" />}
                                  {output.subCategory && <Chip label={output.subCategory} size="small" variant="outlined" color="primary" title="時間分類" />}
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
                                    readOnly: !isTaskMode, // Make read-only in aggregated views
                                }}
                                sx={{ width: 80 }}
                              />
                          </TableCell>
                      </TableRow>
                  ))}
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
