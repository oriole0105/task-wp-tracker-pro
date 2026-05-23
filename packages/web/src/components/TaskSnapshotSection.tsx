import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, IconButton, TextField, Button, Divider, Collapse, Grid,
} from '@mui/material';
import { Add, Delete, ExpandMore, ExpandLess } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, startOfWeek } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { WorkOutput } from '@tt/shared/types';
import { useTaskStore } from '../store/useTaskStore';

const CHART_COLORS = ['#1976d2', '#e91e63', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548'];

interface Props {
  taskId: string;
  outputs: WorkOutput[];
}

export const TaskSnapshotSection: React.FC<Props> = ({ taskId, outputs }) => {
  const { tasks, updateTaskSnapshots } = useTaskStore();
  const [show, setShow] = useState(false);
  const [newSnapDate, setNewSnapDate] = useState<Date | null>(null);
  const [newSnapValue, setNewSnapValue] = useState<number | ''>('');

  const snapshots = useMemo(
    () => tasks.find(t => t.id === taskId)?.weeklySnapshots ?? [],
    [tasks, taskId],
  );

  const chartData = useMemo(() => {
    const allDates = new Set<string>();
    snapshots.forEach(s => allDates.add(s.weekStart));
    outputs.forEach(o => (o.weeklySnapshots ?? []).forEach(s => allDates.add(s.weekStart)));
    if (allDates.size === 0) return [];
    return Array.from(allDates).sort().map(date => {
      const point: Record<string, string | number | undefined> = { date: date.slice(5) };
      const taskSnap = snapshots.find(s => s.weekStart === date);
      if (taskSnap !== undefined) point['task'] = taskSnap.completeness;
      outputs.forEach(o => {
        const snap = (o.weeklySnapshots ?? []).find(s => s.weekStart === date);
        if (snap !== undefined) point[o.id] = snap.completeness;
      });
      return point;
    });
  }, [snapshots, outputs]);

  const handleEdit = (weekStart: string, completeness: number) => {
    updateTaskSnapshots(taskId, snapshots.map(s =>
      s.weekStart === weekStart ? { ...s, completeness } : s
    ));
  };

  const handleDelete = (weekStart: string) => {
    updateTaskSnapshots(taskId, snapshots.filter(s => s.weekStart !== weekStart));
  };

  const handleAdd = () => {
    if (!newSnapDate || newSnapValue === '') return;
    const ws = format(startOfWeek(newSnapDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const idx = snapshots.findIndex(s => s.weekStart === ws);
    const snap = { weekStart: ws, completeness: newSnapValue as number };
    const updated = idx >= 0 ? snapshots.map((s, i) => i === idx ? snap : s) : [...snapshots, snap];
    updateTaskSnapshots(taskId, updated);
    setNewSnapDate(null);
    setNewSnapValue('');
  };

  return (
    <Grid size={{ xs: 12 }}>
      <Box
        onClick={() => setShow(v => !v)}
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 0.5, py: 0.5, userSelect: 'none' }}
      >
        {show ? <ExpandLess fontSize="small" color="primary" /> : <ExpandMore fontSize="small" color="primary" />}
        <Typography variant="body2" color="primary">
          完成度歷史快照（{snapshots.length} 筆）
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
          — 補填或修改過去各期的完成度紀錄
        </Typography>
      </Box>
      <Collapse in={show}>
        <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'action.hover' }}>
          {/* 快照列表（最新在上） */}
          {[...snapshots]
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
                    handleEdit(snap.weekStart, val);
                  }}
                />
                <IconButton size="small" color="error" onClick={() => handleDelete(snap.weekStart)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
          {snapshots.length === 0 && (
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
              onClick={handleAdd}
              disabled={!newSnapDate || newSnapValue === ''}
              sx={{ mt: 0.5 }}
            >
              新增
            </Button>
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
            日期自動對齊至該週週日（weekStart）。同週已有快照時會覆蓋。
          </Typography>

          {/* 趨勢圖 */}
          {chartData.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                完成度趨勢（任務整體 + 各工作產出）
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <ChartTooltip formatter={(v: number | string | readonly (string | number)[] | undefined) => typeof v === 'number' ? `${v}%` : ''} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {snapshots.length > 0 && (
                    <Line
                      type="monotone" dataKey="task" name="任務整體"
                      stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} connectNulls
                    />
                  )}
                  {outputs
                    .filter(o => (o.weeklySnapshots ?? []).length > 0)
                    .map((o, idx) => (
                      <Line
                        key={o.id} type="monotone" dataKey={o.id}
                        name={o.name || `產出 ${idx + 1}`}
                        stroke={CHART_COLORS[(idx + 1) % CHART_COLORS.length]}
                        strokeWidth={1.5}
                        strokeDasharray={idx % 2 !== 0 ? '4 2' : undefined}
                        dot={{ r: 2 }} connectNulls
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </Paper>
      </Collapse>
    </Grid>
  );
};
