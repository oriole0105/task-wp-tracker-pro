import React, { useState, useMemo } from 'react';
import { Box, Paper, Typography, Grid, IconButton, Autocomplete, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTaskStore } from '../store/useTaskStore';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, differenceInDays, addWeeks, subWeeks, addDays, subDays, isValid } from 'date-fns';
import { AccessTime, ChevronLeft, ChevronRight, AccountTree } from '@mui/icons-material';
import type { Task } from '../types';
import { computeTaskWbsMap } from '../utils/wbs';

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#0288d1', '#7b1fa2', '#388e3c', '#f57c00', '#455a64'];

// 遞迴收集任務節點及其所有子孫 ID
const getAllDescendantIds = (rootId: string, tasks: Task[]): Set<string> => {
  const ids = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ids.add(id);
    tasks.filter(t => t.parentId === id).forEach(child => queue.push(child.id));
  }
  return ids;
};

const formatDuration = (totalMinutes: number) => {
  if (totalMinutes === 0) return '0分';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}時`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}分`);
  return parts.join(' ');
};

export const Stats: React.FC = () => {
  const { tasks, timeslots } = useTaskStore();

  // Default to current week (Sunday to Saturday)
  const [startDate, setStartDate] = useState<Date | null>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [endDate, setEndDate] = useState<Date | null>(endOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // 未封存任務 + WBS 編號（用於選擇器）
  const activeTasks = useMemo(() => tasks.filter(t => !t.archived), [tasks]);
  const { wbsNumbers, sorted: sortedTasks } = useMemo(() => computeTaskWbsMap(activeTasks), [activeTasks]);

  // Navigation Logic
  const diffDays = useMemo(() => {
    if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) return -1;
    return differenceInDays(endOfDay(endDate), startOfDay(startDate));
  }, [startDate, endDate]);

  const isDayMode = diffDays === 0;
  const isWeekMode = diffDays === 6;
  const canNavigate = isDayMode || isWeekMode;

  const handlePrev = () => {
    if (!startDate || !endDate || !canNavigate) return;
    if (isDayMode) {
      setStartDate(subDays(startDate, 1));
      setEndDate(subDays(endDate, 1));
    } else {
      setStartDate(subWeeks(startDate, 1));
      setEndDate(subWeeks(endDate, 1));
    }
  };

  const handleNext = () => {
    if (!startDate || !endDate || !canNavigate) return;
    if (isDayMode) {
      setStartDate(addDays(startDate, 1));
      setEndDate(addDays(endDate, 1));
    } else {
      setStartDate(addWeeks(startDate, 1));
      setEndDate(addWeeks(endDate, 1));
    }
  };

  const { stats, totalMinutes } = useMemo(() => {
    if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate))
        return { stats: { main: [], sub: [] }, totalMinutes: 0 };

    const start = startOfDay(startDate).getTime();
    const end = endOfDay(endDate).getTime();
    const mainMap = new Map<string, number>();
    const subMap = new Map<string, number>();
    let totalMs = 0;

    // 若有選定任務節點，只統計該節點及其子孫任務的 timeslot
    const allowedIds = selectedTaskId ? getAllDescendantIds(selectedTaskId, tasks) : null;

    timeslots.forEach(ts => {
        if (allowedIds !== null && (!ts.taskId || !allowedIds.has(ts.taskId))) return;

        const effectiveStart = Math.max(ts.startTime, start);
        const effectiveEnd = Math.min(ts.endTime || Date.now(), end);
        if (effectiveStart < end && effectiveEnd > start) {
            const duration = effectiveEnd - effectiveStart;
            totalMs += duration;
            const task = ts.taskId ? tasks.find(t => t.id === ts.taskId) : undefined;
            const mainKey = task?.mainCategory || '未分類';
            const subKey = ts.subCategory || '其他';
            mainMap.set(mainKey, (mainMap.get(mainKey) || 0) + duration);
            subMap.set(subKey, (subMap.get(subKey) || 0) + duration);
        }
    });

    const formatData = (map: Map<string, number>) => {
        return Array.from(map.entries()).map(([name, value]) => ({
            name,
            value: Math.round(value / (1000 * 60))
        })).filter(d => d.value > 0);
    };

    const totalMin = Math.round(totalMs / (1000 * 60));

    return {
        stats: { main: formatData(mainMap), sub: formatData(subMap) },
        totalMinutes: totalMin
    };
  }, [tasks, timeslots, startDate, endDate, selectedTaskId]);

  const renderTooltip = (value: any) => {
      const percent = totalMinutes > 0 ? ((value / totalMinutes) * 100).toFixed(1) : 0;
      return `${formatDuration(value)} (${percent}%)`;
  };

  const renderLabel = ({ name, value }: any) => {
      const percent = totalMinutes > 0 ? ((value / totalMinutes) * 100).toFixed(1) : 0;
      return `${name}: ${formatDuration(value)} (${percent}%)`;
  };

  const sortedMain = useMemo(() => [...stats.main].sort((a, b) => b.value - a.value), [stats.main]);
  const sortedSub = useMemo(() => [...stats.sub].sort((a, b) => b.value - a.value), [stats.sub]);

  const renderTable = (data: { name: string; value: number }[], colors: string[], origData: { name: string; value: number }[]) => {
    const nameToIdx = new Map(origData.map((item, idx) => [item.name, idx]));
    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>分類</TableCell>
              <TableCell align="right">花費時間</TableCell>
              <TableCell align="right">百分比</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, idx) => {
              const origIdx = nameToIdx.get(row.name) ?? 0;
              return (
                <TableRow key={`${row.name}-${idx}`}>
                  <TableCell sx={{ width: 16, px: 0.5 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: colors[origIdx % colors.length] }} />
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{formatDuration(row.value)}</TableCell>
                  <TableCell align="right">
                    {totalMinutes > 0 ? ((row.value / totalMinutes) * 100).toFixed(1) : '0.0'}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ mr: 1 }}>統計區間：</Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton onClick={handlePrev} disabled={!canNavigate} size="small" title="向前跳轉">
                            <ChevronLeft />
                        </IconButton>
                        
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mx: 1 }}>
                            <DatePicker 
                                value={startDate} 
                                onChange={setStartDate} 
                                label="開始" 
                                slotProps={{ textField: { size: 'small', sx: { width: 150 } } }} 
                            />
                            <Typography>-</Typography>
                            <DatePicker 
                                value={endDate} 
                                onChange={setEndDate} 
                                label="結束" 
                                slotProps={{ textField: { size: 'small', sx: { width: 150 } } }} 
                            />
                        </Box>

                        <IconButton onClick={handleNext} disabled={!canNavigate} size="small" title="向後跳轉">
                            <ChevronRight />
                        </IconButton>
                    </Box>
                </Box>
                {!canNavigate && (
                    <Typography variant="caption" color="textSecondary" sx={{ ml: 12 }}>
                        * 快速跳轉僅支援「單日」或「整週(7天)」模式
                    </Typography>
                )}
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
                <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'action.selected', borderColor: 'primary.main' }}>
                    <AccessTime color="primary" />
                    <Box>
                        <Typography variant="caption" color="textSecondary" display="block">區間累計總工時</Typography>
                        <Typography variant="h5" color="primary.main" sx={{ fontWeight: 'bold' }}>
                            {formatDuration(totalMinutes)}
                        </Typography>
                    </Box>
                </Paper>
            </Grid>
            <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountTree fontSize="small" color="action" />
                    <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: 'nowrap' }}>
                        篩選任務節點：
                    </Typography>
                    <Autocomplete
                        size="small"
                        options={sortedTasks}
                        value={sortedTasks.find(t => t.id === selectedTaskId) ?? null}
                        onChange={(_, task) => setSelectedTaskId(task ? task.id : null)}
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
                            <TextField
                                {...params}
                                placeholder="全部任務（不篩選）"
                                sx={{ minWidth: 320 }}
                            />
                        )}
                        clearOnEscape
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                    />
                    {selectedTaskId && (
                        <Typography variant="caption" color="warning.main">
                            ＊ 僅統計選定節點及其子孫任務
                        </Typography>
                    )}
                </Box>
            </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" align="center" gutterBottom>按「任務分類」統計</Typography>
                <Box sx={{ height: 450 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={stats.main}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={renderLabel}
                              outerRadius={140}
                              fill="#8884d8"
                              dataKey="value"
                          >
                              {stats.main.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                          </Pie>
                          <Tooltip formatter={renderTooltip} />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
                </Box>
                {sortedMain.length > 0 && renderTable(sortedMain, COLORS, stats.main)}
            </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
             <Paper sx={{ p: 3 }}>
                <Typography variant="h6" align="center" gutterBottom>按「時間分類」統計</Typography>
                <Box sx={{ height: 450 }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={stats.sub}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={renderLabel}
                              outerRadius={140}
                              fill="#82ca9d"
                              dataKey="value"
                          >
                              {stats.sub.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                          </Pie>
                           <Tooltip formatter={renderTooltip} />
                           <Legend />
                      </PieChart>
                  </ResponsiveContainer>
                </Box>
                {sortedSub.length > 0 && renderTable(sortedSub, COLORS, stats.sub)}
            </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};