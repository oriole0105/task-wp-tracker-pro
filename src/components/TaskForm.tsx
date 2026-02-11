import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Grid, Box, Typography, IconButton, Paper, Divider, Chip
} from '@mui/material';
import { Add, Delete, Link as LinkIcon, Label as LabelIcon, AccountTree } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatus, WorkOutput } from '../types';
import { useTaskStore } from '../store/useTaskStore';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: Task;
  parentId?: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({ open, onClose, initialData, parentId }) => {
  const { tasks, mainCategories, subCategories, addTask, updateTask, getTaskById } = useTaskStore();
  
  const [title, setTitle] = useState('');
  const [aliasTitle, setAliasTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mainCategory, setMainCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [estimatedStartDate, setEstimatedStartDate] = useState<Date | null>(null);
  const [estimatedEndDate, setEstimatedEndDate] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState('');
  const [reporter, setReporter] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [outputs, setOutputs] = useState<WorkOutput[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [currentParentId, setCurrentParentId] = useState<string>('');

  // Helper to get all descendants of a task to prevent circular references
  const getDescendantIds = (taskId: string): string[] => {
    const children = tasks.filter(t => t.parentId === taskId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getDescendantIds(c.id)];
    });
    return ids;
  };

  // Filter tasks that can be valid parents
  const validParentCandidates = useMemo(() => {
    if (!initialData) return tasks; // For new tasks, all are candidates
    
    const descendants = getDescendantIds(initialData.id);
    return tasks.filter(t => 
      t.id !== initialData.id && // Cannot be its own parent
      !descendants.includes(t.id) // Cannot be a child of its own descendant
    );
  }, [tasks, initialData]);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setAliasTitle(initialData.aliasTitle || '');
      setDescription(initialData.description);
      setMainCategory(initialData.mainCategory);
      setSubCategory(initialData.subCategory);
      setEstimatedStartDate(initialData.estimatedStartDate ? new Date(initialData.estimatedStartDate) : null);
      setEstimatedEndDate(initialData.estimatedEndDate ? new Date(initialData.estimatedEndDate) : null);
      setAssignee(initialData.assignee);
      setReporter(initialData.reporter);
      setStatus(initialData.status);
      setOutputs(initialData.outputs || []);
      setLabels(initialData.labels || []);
      setCurrentParentId(initialData.parentId || '');
    } else if (parentId) {
      const parent = getTaskById(parentId);
      if (parent) {
        setMainCategory(parent.mainCategory);
        setSubCategory(parent.subCategory);
      }
      setTitle('');
      setAliasTitle('');
      setDescription('');
      setStatus('TODO');
      setOutputs([]);
      setLabels([]);
      setCurrentParentId(parentId);
    } else {
      setTitle('');
      setAliasTitle('');
      setDescription('');
      setMainCategory('');
      setSubCategory('');
      setEstimatedStartDate(null);
      setEstimatedEndDate(null);
      setAssignee('');
      setReporter('');
      setStatus('TODO');
      setOutputs([]);
      setLabels([]);
      setCurrentParentId('');
    }
    setNewLabel('');
  }, [initialData, parentId, open, getTaskById]);

  const handleAddLabel = () => {
    const trimmed = newLabel.trim();
    if (trimmed && labels.length < 3 && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
      setNewLabel('');
    }
  };

  const handleDeleteLabel = (labelToDelete: string) => {
    setLabels(labels.filter(l => l !== labelToDelete));
  };

  const handleAddOutput = () => {
    setOutputs([...outputs, { id: uuidv4(), name: '', link: '', completeness: '' }]);
  };

  const handleUpdateOutput = (id: string, field: keyof WorkOutput, value: string) => {
    setOutputs(outputs.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const handleDeleteOutput = (id: string) => {
    setOutputs(outputs.filter(o => o.id !== id));
  };

  const handleSubmit = () => {
    const taskData = {
      title,
      aliasTitle,
      description,
      mainCategory,
      subCategory,
      estimatedStartDate: estimatedStartDate?.getTime(),
      estimatedEndDate: estimatedEndDate?.getTime(),
      assignee,
      reporter,
      status,
      outputs,
      labels,
      parentId: currentParentId || undefined,
    };

    if (initialData) {
      updateTask(initialData.id, taskData);
    } else {
      addTask(taskData as any);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {initialData ? '編輯任務' : '建立任務'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField label="任務名稱" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="別名 (Alias Title)" fullWidth value={aliasTitle} onChange={(e) => setAliasTitle(e.target.value)} inputProps={{ maxLength: 10 }} />
          </Grid>

          {/* Parent Task Selector */}
          <Grid size={{ xs: 12 }}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccountTree sx={{ fontSize: 18 }} /> 上層任務 (WBS 歸類)
              </InputLabel>
              <Select
                value={currentParentId}
                label="上層任務 (WBS 歸類)"
                onChange={(e) => setCurrentParentId(e.target.value)}
              >
                <MenuItem value=""><em>無 (設為第一階任務)</em></MenuItem>
                {validParentCandidates.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.title} {t.aliasTitle ? `(${t.aliasTitle})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid size={{ xs: 12 }}>
            <TextField label="任務詳細說明" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LabelIcon fontSize="small" color="action" />
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>標籤 (最多 3 個)</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                {labels.map((label) => (
                    <Chip key={label} label={label} onDelete={() => handleDeleteLabel(label)} color="secondary" variant="outlined" size="small" />
                ))}
                {labels.length < 3 && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField 
                            size="small" 
                            placeholder="新增標籤..." 
                            value={newLabel} 
                            onChange={(e) => setNewLabel(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLabel())}
                            sx={{ width: 150 }}
                        />
                        <Button size="small" onClick={handleAddLabel} disabled={!newLabel.trim()}>加入</Button>
                    </Box>
                )}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>任務分類</InputLabel>
              <Select value={mainCategory} label="任務分類" onChange={(e) => setMainCategory(e.target.value)}>
                {mainCategories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>時間分類</InputLabel>
              <Select value={subCategory} label="時間分類" onChange={(e) => setSubCategory(e.target.value)}>
                {subCategories.map((sc) => <MenuItem key={sc} value={sc}>{sc}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <DatePicker label="預估開始日期" value={estimatedStartDate} onChange={(newValue) => setEstimatedStartDate(newValue)} slotProps={{ textField: { fullWidth: true } }} />
          </Grid>
           <Grid size={{ xs: 12, md: 6 }}>
            <DatePicker label="預估完成日期" value={estimatedEndDate} onChange={(newValue) => setEstimatedEndDate(newValue)} slotProps={{ textField: { fullWidth: true } }} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="任務負責人" fullWidth value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="任務指派人" fullWidth value={reporter} onChange={(e) => setReporter(e.target.value)} />
          </Grid>
           <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>任務狀態</InputLabel>
              <Select value={status} label="任務狀態" onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                <MenuItem value="TODO">待處理 (Todo)</MenuItem>
                <MenuItem value="IN_PROGRESS">進行中 (Ongoing)</MenuItem>
                <MenuItem value="PAUSED">已暫停 (Paused)</MenuItem>
                <MenuItem value="DONE">已完成 (Done)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">工作產出 (Work Outputs)</Typography>
                <Button startIcon={<Add />} variant="outlined" size="small" onClick={handleAddOutput}>新增產出</Button>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {outputs.map((output) => (
                    <Paper key={output.id} variant="outlined" sx={{ p: 2, bgcolor: '#fafafa' }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField 
                                    label="產出名稱" 
                                    size="small" 
                                    fullWidth 
                                    required 
                                    value={output.name} 
                                    onChange={(e) => handleUpdateOutput(output.id, 'name', e.target.value)} 
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField 
                                    label="相關連結 (URL/路徑)" 
                                    size="small" 
                                    fullWidth 
                                    value={output.link} 
                                    InputProps={{ startAdornment: <LinkIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} /> }}
                                    onChange={(e) => handleUpdateOutput(output.id, 'link', e.target.value)} 
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 3 }}>
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
                                        handleUpdateOutput(output.id, 'completeness', val);
                                    }} 
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 1 }}>
                                <IconButton color="error" onClick={() => handleDeleteOutput(output.id)}>
                                    <Delete />
                                </IconButton>
                            </Grid>
                        </Grid>
                    </Paper>
                ))}
                {outputs.length === 0 && (
                    <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 2 }}>
                        目前尚無產出紀錄。
                    </Typography>
                )}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!title}>儲存任務</Button>
      </DialogActions>
    </Dialog>
  );
};
