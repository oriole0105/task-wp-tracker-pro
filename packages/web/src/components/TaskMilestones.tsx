import React from 'react';
import {
  Box, Typography, Button, IconButton, Paper,
  Grid, TextField, FormControl, InputLabel, Select, MenuItem,
  FormControlLabel, Checkbox, Divider,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Milestone } from '@tt/shared/types';

const MILESTONE_COLORS: { value: string; label: string; css: string }[] = [
  { value: 'Red',         label: '紅',  css: '#f44336' },
  { value: 'Orange',      label: '橙',  css: '#ff9800' },
  { value: 'Gold',        label: '金',  css: '#ffc107' },
  { value: 'LimeGreen',   label: '草綠', css: '#8bc34a' },
  { value: 'DeepSkyBlue', label: '藍',  css: '#03a9f4' },
  { value: 'Violet',      label: '紫',  css: '#9c27b0' },
  { value: 'HotPink',     label: '粉',  css: '#e91e63' },
  { value: 'Silver',      label: '灰',  css: '#9e9e9e' },
];

interface Props {
  milestones: Milestone[];
  onChange: (milestones: Milestone[]) => void;
}

export const TaskMilestones: React.FC<Props> = ({ milestones, onChange }) => {
  const handleAdd = () => {
    onChange([...milestones, {
      id: uuidv4(),
      title: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      showInGantt: true,
    }]);
  };

  const handleUpdate = (id: string, updates: Partial<Omit<Milestone, 'id'>>) => {
    onChange(milestones.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleDelete = (id: string) => {
    onChange(milestones.filter(m => m.id !== id));
  };

  return (
    <Grid size={{ xs: 12 }}>
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">里程碑 (Milestones)</Typography>
        <Button startIcon={<Add />} variant="outlined" size="small" onClick={handleAdd}>新增里程碑</Button>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {milestones.map((ms) => (
          <Paper key={ms.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
            <Grid container spacing={1.5} alignItems="center">
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="里程碑名稱"
                  size="small"
                  fullWidth
                  value={ms.title}
                  onChange={(e) => handleUpdate(ms.id, { title: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <DatePicker
                  label="日期"
                  value={ms.date ? new Date(ms.date) : null}
                  onChange={(d) => d && handleUpdate(ms.id, { date: format(d, 'yyyy-MM-dd') })}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>顏色</InputLabel>
                  <Select
                    value={ms.color ?? ''}
                    label="顏色"
                    onChange={(e) => handleUpdate(ms.id, { color: e.target.value || undefined })}
                    renderValue={(val) => {
                      if (!val) return <em>預設</em>;
                      const c = MILESTONE_COLORS.find(x => x.value === val);
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c?.css ?? '#999', flexShrink: 0 }} />
                          {c?.label ?? val}
                        </Box>
                      );
                    }}
                  >
                    <MenuItem value=""><em>預設</em></MenuItem>
                    {MILESTONE_COLORS.map(c => (
                      <MenuItem key={c.value} value={c.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c.css, flexShrink: 0 }} />
                          {c.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 'auto' }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={ms.showInGantt}
                      onChange={(e) => handleUpdate(ms.id, { showInGantt: e.target.checked })}
                    />
                  }
                  label={<Typography variant="caption">甘特圖</Typography>}
                  sx={{ mr: 0 }}
                />
                <IconButton size="small" color="error" onClick={() => handleDelete(ms.id)}>
                  <Delete />
                </IconButton>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="備註（選填）"
                  size="small"
                  fullWidth
                  value={ms.note ?? ''}
                  onChange={(e) => handleUpdate(ms.id, { note: e.target.value || undefined })}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
        {milestones.length === 0 && (
          <Typography variant="body2" color="text.disabled" sx={{ pl: 1 }}>尚無里程碑</Typography>
        )}
      </Box>
    </Grid>
  );
};
