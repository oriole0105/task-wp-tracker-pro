import React, { useState } from 'react';
import {
  Box, Typography, Button, IconButton, Paper,
  Grid, TextField, FormControl, InputLabel, Select, MenuItem,
  Collapse, Tooltip, Divider,
} from '@mui/material';
import { Add, Delete, ContentCopy, Link as LinkIcon, ExpandMore, ExpandLess } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, addDays, parseISO, startOfWeek } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { WorkOutput, WeeklySnapshot, OutputType } from '@tt/shared/types';

interface Props {
  outputs: WorkOutput[];
  onChange: (outputs: WorkOutput[]) => void;
  outputTypes: OutputType[];
}

export const TaskOutputs: React.FC<Props> = ({ outputs, onChange, outputTypes }) => {
  const [expandedSnaps, setExpandedSnaps] = useState<Set<string>>(new Set());
  const [newSnap, setNewSnap] = useState<Record<string, { date: Date | null; value: number | '' }>>({});

  const getTypeMeta = (outputTypeId: string | undefined) =>
    outputTypes.find(t => t.id === outputTypeId) ?? null;

  const handleAdd = () => {
    onChange([...outputs, { id: uuidv4(), name: '', outputTypeId: '', summary: '', link: '', completeness: '' }]);
  };

  const handleUpdate = (id: string, field: keyof WorkOutput, value: string) => {
    onChange(outputs.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const handleDelete = (id: string) => {
    onChange(outputs.filter(o => o.id !== id));
  };

  const handleCopy = (id: string) => {
    const src = outputs.find(o => o.id === id);
    if (!src) return;
    const nextDate = src.effectiveDate
      ? format(addDays(parseISO(src.effectiveDate), 7), 'yyyy-MM-dd')
      : '';
    const copy: WorkOutput = { ...src, id: uuidv4(), completeness: '', effectiveDate: nextDate, weeklySnapshots: [] };
    const idx = outputs.findIndex(o => o.id === id);
    const next = [...outputs];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  const handleUpdateSnapshots = (outputId: string, snapshots: WeeklySnapshot[]) => {
    onChange(outputs.map(o => o.id === outputId ? { ...o, weeklySnapshots: snapshots } : o));
  };

  const handleAddSnapshot = (outputId: string) => {
    const s = newSnap[outputId];
    if (!s?.date || s.value === '') return;
    const ws = format(startOfWeek(s.date, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const existing = outputs.find(o => o.id === outputId)?.weeklySnapshots ?? [];
    const idx = existing.findIndex(sn => sn.weekStart === ws);
    const snap = { weekStart: ws, completeness: s.value as number };
    const updated = idx >= 0 ? existing.map((sn, i) => i === idx ? snap : sn) : [...existing, snap];
    handleUpdateSnapshots(outputId, updated);
    setNewSnap(prev => ({ ...prev, [outputId]: { date: null, value: '' } }));
  };

  const toggleSnap = (outputId: string) => {
    setExpandedSnaps(prev => {
      const next = new Set(prev);
      next.has(outputId) ? next.delete(outputId) : next.add(outputId);
      return next;
    });
  };

  return (
    <Grid size={{ xs: 12 }}>
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">工作產出 (Work Outputs)</Typography>
        <Button startIcon={<Add />} variant="outlined" size="small" onClick={handleAdd}>新增產出</Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {outputs.map((output) => {
          const typeMeta = getTypeMeta(output.outputTypeId);
          const isIntangible = typeMeta !== null && !typeMeta.isTangible;
          const snapshots = output.weeklySnapshots ?? [];
          const isSnapExpanded = expandedSnaps.has(output.id);
          return (
            <Paper key={output.id} variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Grid container spacing={2} alignItems="flex-start">
                {/* 名稱 + 類型 + 完成度 + 操作 */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="產出名稱"
                    size="small"
                    fullWidth
                    required
                    value={output.name}
                    onChange={(e) => handleUpdate(output.id, 'name', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>產出類型</InputLabel>
                    <Select
                      value={output.outputTypeId || ''}
                      label="產出類型"
                      onChange={(e) => handleUpdate(output.id, 'outputTypeId', e.target.value)}
                    >
                      <MenuItem value=""><em>未分類</em></MenuItem>
                      {outputTypes.map(ot => (
                        <MenuItem key={ot.id} value={ot.id}>
                          {ot.name}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            {ot.isTangible ? '（有形）' : '（無形）'}
                          </Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 8, md: 2 }}>
                  <TextField
                    label="完成度 (%)"
                    size="small"
                    type="number"
                    fullWidth
                    placeholder="0-100"
                    inputProps={{ min: 0, max: 100, step: 1 }}
                    value={output.completeness}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0)).toString();
                      handleUpdate(output.id, 'completeness', val);
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 4, md: 2 }} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title={output.effectiveDate ? `複製為下期（${format(addDays(parseISO(output.effectiveDate), 7), 'MM/dd')} 起）` : '複製為下期產出'}>
                    <IconButton size="small" color="primary" onClick={() => handleCopy(output.id)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" color="error" onClick={() => handleDelete(output.id)}>
                    <Delete />
                  </IconButton>
                </Grid>

                {/* 說明或連結（依類型） */}
                {isIntangible ? (
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="說明/摘要（無形產出的描述）"
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="描述這項產出的具體內容或價值..."
                      value={output.summary || ''}
                      onChange={(e) => handleUpdate(output.id, 'summary', e.target.value)}
                    />
                  </Grid>
                ) : (
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="相關連結 (URL/路徑)"
                      size="small"
                      fullWidth
                      value={output.link || ''}
                      InputProps={{ startAdornment: <LinkIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} /> }}
                      onChange={(e) => handleUpdate(output.id, 'link', e.target.value)}
                    />
                  </Grid>
                )}

                {/* 歸屬期間 */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <DatePicker
                    label="歸屬期間（選填，週期型產出）"
                    value={output.effectiveDate ? new Date(output.effectiveDate + 'T00:00:00') : null}
                    onChange={(date: Date | null) => {
                      handleUpdate(output.id, 'effectiveDate', date ? format(date, 'yyyy-MM-dd') : '');
                    }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        helperText: '週期型產出（如每週會議報告）請填歸屬日期；持續型產出（如長期文件）留空',
                      },
                    }}
                  />
                </Grid>

                {/* 完成度快照 */}
                <Grid size={{ xs: 12 }}>
                  <Box
                    onClick={() => toggleSnap(output.id)}
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 0.5, userSelect: 'none' }}
                  >
                    {isSnapExpanded ? <ExpandLess fontSize="small" color="action" /> : <ExpandMore fontSize="small" color="action" />}
                    <Typography variant="caption" color="text.secondary">
                      完成度快照（{snapshots.length} 筆）
                    </Typography>
                  </Box>
                  <Collapse in={isSnapExpanded}>
                    <Box sx={{ pl: 1, pt: 1 }}>
                      {[...snapshots]
                        .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
                        .map(snap => (
                          <Box key={snap.weekStart} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption" sx={{ minWidth: 110, fontFamily: 'monospace', flexShrink: 0 }}>
                              {snap.weekStart}
                            </Typography>
                            <TextField
                              size="small"
                              type="number"
                              label="%"
                              value={snap.completeness}
                              inputProps={{ min: 0, max: 100, step: 5 }}
                              sx={{ width: 75 }}
                              onChange={(e) => {
                                const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                handleUpdateSnapshots(output.id, snapshots.map(s =>
                                  s.weekStart === snap.weekStart ? { ...s, completeness: val } : s
                                ));
                              }}
                            />
                            <IconButton size="small" color="error" onClick={() => {
                              handleUpdateSnapshots(output.id, snapshots.filter(s => s.weekStart !== snap.weekStart));
                            }}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                      {snapshots.length === 0 && (
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                          尚無快照
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', mt: 0.5 }}>
                        <DatePicker
                          label="週次"
                          value={newSnap[output.id]?.date ?? null}
                          onChange={(date) => setNewSnap(prev => ({
                            ...prev,
                            [output.id]: { ...prev[output.id] ?? { value: '' }, date },
                          }))}
                          slotProps={{ textField: { size: 'small', sx: { width: 165 } } }}
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="%"
                          value={newSnap[output.id]?.value ?? ''}
                          inputProps={{ min: 0, max: 100, step: 5 }}
                          sx={{ width: 75 }}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            setNewSnap(prev => ({
                              ...prev,
                              [output.id]: { ...prev[output.id] ?? { date: null }, value: val },
                            }));
                          }}
                        />
                        <IconButton
                          size="small"
                          color="primary"
                          disabled={!newSnap[output.id]?.date || newSnap[output.id]?.value === ''}
                          onClick={() => handleAddSnapshot(output.id)}
                          sx={{ mt: 0.5 }}
                        >
                          <Add />
                        </IconButton>
                      </Box>
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.3 }}>
                        日期自動對齊至該週週日。快照於儲存任務時一起寫入。
                      </Typography>
                    </Box>
                  </Collapse>
                </Grid>
              </Grid>
            </Paper>
          );
        })}
        {outputs.length === 0 && (
          <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 2 }}>
            目前尚無產出紀錄。
          </Typography>
        )}
      </Box>
    </Grid>
  );
};
