import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Grid, Link, Chip, IconButton, TextField, InputAdornment
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import { startOfDay, endOfDay, isValid, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import type { Task } from '../types';

const formatTime = (ms: number) => {
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)));
  return `${hours}h ${minutes}m`;
};

interface IndexedTaskWithOutputs extends Task {
  indexDisplay: string;
}

const OutputReportPage: React.FC = () => {
  const { tasks, updateWorkOutput } = useTaskStore();
  
  // Default to current week
  const [startDate, setStartDate] = useState<Date | null>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState<Date | null>(endOfWeek(new Date(), { weekStartsOn: 1 }));

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

  const processedData = useMemo(() => {
    if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) return [];

    const startTs = startOfDay(startDate).getTime();
    const endTs = endOfDay(endDate).getTime();

    const activeTasksInRange = tasks.filter(task => {
        if (!task.timeLogs) return false;
        return task.timeLogs.some(log => {
            const effectiveStart = Math.max(log.startTime, startTs);
            const effectiveEnd = Math.min(log.endTime || Date.now(), endTs);
            return effectiveStart < effectiveEnd;
        });
    });

    if (activeTasksInRange.length === 0) return [];

    const result: IndexedTaskWithOutputs[] = [];
    const buildHierarchy = (parentId: string | undefined, prefix: string) => {
      const children = activeTasksInRange.filter(t => t.parentId === parentId);
      children.forEach((child, i) => {
        const currentIndex = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        result.push({ ...child, indexDisplay: currentIndex });
        buildHierarchy(child.id, currentIndex);
      });
    };

    const roots = activeTasksInRange.filter(t => !t.parentId || !activeTasksInRange.find(p => p.id === t.parentId));
    roots.forEach((task, i) => {
        const currentIndex = `${i + 1}`;
        result.push({ ...task, indexDisplay: currentIndex });
        buildHierarchy(task.id, currentIndex);
    });

    return result;
  }, [tasks, startDate, endDate]);

  const handleCompletenessChange = (taskId: string, outputId: string, value: string) => {
    const val = value === '' ? '' : Math.min(100, Math.max(0, parseInt(value) || 0)).toString();
    updateWorkOutput(taskId, outputId, { completeness: val });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Work Outputs Tracking</Typography>
      
      <Paper sx={{ p: 2, mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
            <Grid>
                <Typography variant="h6">Activity Range:</Typography>
            </Grid>
            <Grid sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={handlePrevWeek} title="Previous Week"><ChevronLeft /></IconButton>
                <DatePicker value={startDate} onChange={setStartDate} label="Start" slotProps={{ textField: { size: 'small' } }} />
                <Typography>-</Typography>
                <DatePicker value={endDate} onChange={setEndDate} label="End" slotProps={{ textField: { size: 'small' } }} />
                <IconButton onClick={handleNextWeek} title="Next Week"><ChevronRight /></IconButton>
            </Grid>
            <Grid sx={{ ml: 2 }}>
                <Typography variant="body2" color="textSecondary">
                    * Showing tasks with activity in this period.
                </Typography>
            </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell width={80}>WBS</TableCell>
              <TableCell>Task Name</TableCell>
              <TableCell>Categories</TableCell>
              <TableCell>Time Spent</TableCell>
              <TableCell>Work Outputs</TableCell>
              <TableCell width={150}>Completeness (%)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {processedData.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <Typography color="textSecondary">No activity found in the selected range.</Typography>
                    </TableCell>
                 </TableRow>
            ) : processedData.map((task) => {
              const taskOutputs = task.outputs || [];
              return (
                <React.Fragment key={task.id}>
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{task.indexDisplay}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>{task.title}</TableCell>
                    <TableCell>
                      <Chip label={task.mainCategory || '其他'} size="small" variant="outlined" sx={{ mr: 0.5 }} />
                      <Chip label={task.subCategory || '其他'} size="small" variant="outlined" color="primary" />
                    </TableCell>
                    <TableCell>{formatTime(task.totalTimeSpent)}</TableCell>
                    <TableCell colSpan={2}>
                        {taskOutputs.length === 0 && <Typography variant="caption" color="textDisabled">No outputs</Typography>}
                    </TableCell>
                  </TableRow>
                  
                  {taskOutputs.map((output) => (
                      <TableRow key={output.id} sx={{ bgcolor: 'rgba(0,0,0,0.01)' }}>
                          <TableCell colSpan={4} />
                          <TableCell>
                              {output.link ? (
                                  <Link href={output.link} target="_blank" rel="noopener" underline="hover">
                                      {output.name}
                                  </Link>
                              ) : (
                                  <Typography variant="body2">{output.name}</Typography>
                              )}
                          </TableCell>
                          <TableCell>
                              <TextField
                                size="small"
                                type="number"
                                variant="standard"
                                value={output.completeness || ''}
                                onChange={(e) => handleCompletenessChange(task.id, output.id, e.target.value)}
                                inputProps={{ min: 0, max: 100, style: { textAlign: 'right', fontWeight: 'bold' } }}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                    disableUnderline: false
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