import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, FormControl, InputLabel, Select, MenuItem,
  Grid, Box, Typography, IconButton, Paper, Divider
} from '@mui/material';
import { Add, Delete, Link as LinkIcon } from '@mui/icons-material';
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
  const { mainCategories, subCategories, addTask, updateTask, getTaskById } = useTaskStore();
  
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
    } else if (parentId) {
      const parent = getTaskById(parentId);
      // Inherit categories from parent
      if (parent) {
        setMainCategory(parent.mainCategory);
        setSubCategory(parent.subCategory);
      }
      setTitle('');
      setAliasTitle('');
      setDescription('');
      setStatus('TODO');
      setOutputs([]);
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
    }
  }, [initialData, parentId, open, getTaskById]);

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
      parentId: parentId || (initialData?.parentId),
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
      <DialogTitle>{initialData ? 'Edit Task' : 'New Task'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField label="Task Title" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="Alias Title (Max 10)" fullWidth value={aliasTitle} onChange={(e) => setAliasTitle(e.target.value)} inputProps={{ maxLength: 10 }} />
          </Grid>
          
          <Grid size={{ xs: 12 }}>
            <TextField label="Description" fullWidth multiline rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Main Category</InputLabel>
              <Select value={mainCategory} label="Main Category" onChange={(e) => setMainCategory(e.target.value)}>
                {mainCategories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Sub Category</InputLabel>
              <Select value={subCategory} label="Sub Category" onChange={(e) => setSubCategory(e.target.value)}>
                {subCategories.map((sc) => <MenuItem key={sc} value={sc}>{sc}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <DatePicker label="Est. Start Date" value={estimatedStartDate} onChange={(newValue) => setEstimatedStartDate(newValue)} slotProps={{ textField: { fullWidth: true } }} />
          </Grid>
           <Grid size={{ xs: 12, md: 6 }}>
            <DatePicker label="Est. End Date" value={estimatedEndDate} onChange={(newValue) => setEstimatedEndDate(newValue)} slotProps={{ textField: { fullWidth: true } }} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="Assignee" fullWidth value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField label="Reporter" fullWidth value={reporter} onChange={(e) => setReporter(e.target.value)} />
          </Grid>
           <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                <MenuItem value="TODO">Todo</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="PAUSED">Paused</MenuItem>
                <MenuItem value="DONE">Done</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Work Outputs Section */}
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">Work Outputs</Typography>
                <Button startIcon={<Add />} variant="outlined" size="small" onClick={handleAddOutput}>Add Output</Button>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {outputs.map((output) => (
                    <Paper key={output.id} variant="outlined" sx={{ p: 2, bgcolor: '#fafafa' }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField 
                                    label="Output Name" 
                                    size="small" 
                                    fullWidth 
                                    required 
                                    value={output.name} 
                                    onChange={(e) => handleUpdateOutput(output.id, 'name', e.target.value)} 
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField 
                                    label="Link (URL/Path)" 
                                    size="small" 
                                    fullWidth 
                                    value={output.link} 
                                    InputProps={{ startAdornment: <LinkIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} /> }}
                                    onChange={(e) => handleUpdateOutput(output.id, 'link', e.target.value)} 
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 3 }}>
                                <TextField 
                                    label="Completeness (%)" 
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
                        No work outputs recorded yet.
                    </Typography>
                )}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!title}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};
