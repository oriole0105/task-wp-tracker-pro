import React, { useState, useMemo } from 'react';
import { Box, Paper, Typography, Grid } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTaskStore } from '../store/useTaskStore';
import { startOfDay, endOfDay } from 'date-fns';

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#0288d1', '#7b1fa2', '#388e3c', '#f57c00', '#455a64'];

const formatDuration = (totalMinutes: number) => {
  if (totalMinutes === 0) return '0m';
  
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(' ');
};

export const Stats: React.FC = () => {
  const { tasks } = useTaskStore();
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  const stats = useMemo(() => {
    if (!startDate || !endDate) return { main: [], sub: [] };

    const start = startOfDay(startDate).getTime();
    const end = endOfDay(endDate).getTime();

    const mainMap = new Map<string, number>();
    const subMap = new Map<string, number>();

    tasks.forEach(task => {
        task.timeLogs.forEach(log => {
            const effectiveStart = Math.max(log.startTime, start);
            const effectiveEnd = Math.min(log.endTime || Date.now(), end);

            if (effectiveStart < end && effectiveEnd > start) {
                const duration = effectiveEnd - effectiveStart;
                
                // Unified labeling logic: use '其他' for empty categories
                const mainKey = task.mainCategory || '其他';
                const subKey = task.subCategory || '其他';

                mainMap.set(mainKey, (mainMap.get(mainKey) || 0) + duration);
                subMap.set(subKey, (subMap.get(subKey) || 0) + duration);
            }
        });
    });

    const formatData = (map: Map<string, number>) => {
        return Array.from(map.entries()).map(([name, value]) => ({
            name,
            value: Math.round(value / (1000 * 60)) // Minutes for charting
        })).filter(d => d.value > 0);
    };

    return {
        main: formatData(mainMap),
        sub: formatData(subMap)
    };

  }, [tasks, startDate, endDate]);

  const renderTooltip = (value: any) => formatDuration(value);

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
            <Grid>
                <Typography variant="h6">Statistics Range:</Typography>
            </Grid>
            <Grid>
                <DatePicker value={startDate} onChange={setStartDate} label="Start" slotProps={{ textField: { size: 'small' } }} />
            </Grid>
            <Grid>
                <Typography>-</Typography>
            </Grid>
            <Grid>
                <DatePicker value={endDate} onChange={setEndDate} label="End" slotProps={{ textField: { size: 'small' } }} />
            </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, height: 500 }}>
                <Typography variant="h6" align="center" gutterBottom>By Main Category</Typography>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={stats.main}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({name, value}) => `${name}: ${formatDuration(value)}`}
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
            </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
             <Paper sx={{ p: 3, height: 500 }}>
                <Typography variant="h6" align="center" gutterBottom>By Sub Category</Typography>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={stats.sub}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({name, value}) => `${name}: ${formatDuration(value)}`}
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
            </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};