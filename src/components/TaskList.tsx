import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, IconButton, Chip, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText,
  Typography, Divider
} from '@mui/material';
import { PlayArrow, Pause, Edit, Delete, Add, SubdirectoryArrowRight, FilterListOff, SelectAll, Person, EventAvailable, EventBusy } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { useTaskStore } from '../store/useTaskStore';
import type { Task, TaskStatus } from '../types';
import { TaskForm } from './TaskForm';
import { format } from 'date-fns';

const formatTime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)));
  return `${hours}h ${minutes}m ${seconds}s`;
};

const formatDate = (ts: number | undefined) => {
    if (!ts) return '-';
    return format(ts, 'yyyy-MM-dd HH:mm');
};

interface IndexedTask extends Task {
  indexDisplay: string;
  depth: number;
}

export const TaskList: React.FC = () => {
  const { tasks, mainCategories, subCategories, startTimer, stopTimer, deleteTask } = useTaskStore();
  
  // Default: Show all unfinished tasks, ignore categories initially
  const [filterStatus, setFilterStatus] = useState<TaskStatus[]>(['TODO', 'IN_PROGRESS', 'PAUSED']);
  const [selectedMainCats, setSelectedMainCats] = useState<string[]>([]); // Empty means ALL
  const [selectedSubCats, setSelectedSubCats] = useState<string[]>([]);   // Empty means ALL
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [parentTaskId, setParentTaskId] = useState<string | undefined>(undefined);

  const processedTasks = useMemo(() => {
    const baseFiltered = tasks.filter(task => {
      // 1. Status Filter (Always applied)
      if (filterStatus.length > 0 && !filterStatus.includes(task.status)) return false;
      
      // 2. Main Category Filter (If empty, show all)
      if (selectedMainCats.length > 0) {
          const taskCat = task.mainCategory || '其他';
          if (!selectedMainCats.includes(taskCat)) return false;
      }
      
      // 3. Sub Category Filter (If empty, show all)
      if (selectedSubCats.length > 0) {
          const taskSubCat = task.subCategory || '其他';
          if (!selectedSubCats.includes(taskSubCat)) return false;
      }

      // 4. Date Range Filter
      if (dateRange[0] && task.estimatedStartDate && task.estimatedStartDate < dateRange[0].getTime()) return false;
      if (dateRange[1] && task.estimatedEndDate && task.estimatedEndDate > dateRange[1].getTime()) return false;
      
      return true;
    });

    const result: IndexedTask[] = [];
    const buildHierarchy = (parentId: string | undefined, prefix: string, depth: number) => {
      const children = baseFiltered.filter(t => t.parentId === parentId);
      children.forEach((child, i) => {
        const currentIndex = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        result.push({ ...child, indexDisplay: currentIndex, depth });
        if (depth < 5) {
            buildHierarchy(child.id, currentIndex, depth + 1);
        }
      });
    };

    const rootTasks = baseFiltered.filter(t => !t.parentId || !baseFiltered.find(p => p.id === t.parentId));
    rootTasks.forEach((task, i) => {
        const currentIndex = `${i + 1}`;
        result.push({ ...task, indexDisplay: currentIndex, depth: 1 });
        buildHierarchy(task.id, currentIndex, 2);
    });

    return result;
  }, [tasks, filterStatus, selectedMainCats, selectedSubCats, dateRange]);

  const getActualDates = (task: Task) => {
      if (task.timeLogs.length === 0) return { start: undefined, end: undefined };
      const start = Math.min(...task.timeLogs.map(l => l.startTime));
      let end = undefined;
      if (task.status === 'DONE') {
          const endedLogs = task.timeLogs.filter(l => l.endTime);
          if (endedLogs.length > 0) end = Math.max(...endedLogs.map(l => l.endTime!));
      }
      return { start, end };
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setParentTaskId(undefined);
    setIsFormOpen(true);
  };

  const handleCreateSubTask = (taskId: string) => {
    setEditingTask(undefined);
    setParentTaskId(taskId);
    setIsFormOpen(true);
  };
  
  const handleCreateNew = () => {
      setEditingTask(undefined);
      setParentTaskId(undefined);
      setIsFormOpen(true);
  }

  // Define Category Options with "其他"
  const mainOptions = [...mainCategories, '其他'];
  const subOptions = [...subCategories, '其他'];

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
        {/* Status Filter */}
        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel>Status</InputLabel>
          <Select multiple value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as TaskStatus[])} renderValue={(selected) => selected.length === 4 ? 'All' : selected.join(', ')} label="Status">
             <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setFilterStatus(['TODO', 'IN_PROGRESS', 'PAUSED', 'DONE']); }}>All</Button>
                <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setFilterStatus([]); }}>Clear</Button>
            </Box>
            <Divider />
            {['TODO', 'IN_PROGRESS', 'PAUSED', 'DONE'].map((s) => (
              <MenuItem key={s} value={s}>
                <Checkbox checked={filterStatus.indexOf(s as TaskStatus) > -1} />
                <ListItemText primary={s} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Main Category Filter */}
        <FormControl sx={{ minWidth: 180 }} size="small">
          <InputLabel>Main Category</InputLabel>
          <Select 
            multiple 
            value={selectedMainCats} 
            onChange={(e) => setSelectedMainCats(e.target.value as string[])} 
            renderValue={(selected) => selected.length === 0 ? 'All Categories' : `Selected (${selected.length})`} 
            label="Main Category"
          >
            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setSelectedMainCats(mainOptions); }}>All</Button>
                <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setSelectedMainCats([]); }}>Clear</Button>
            </Box>
            <Divider />
            {mainOptions.map((c) => (
              <MenuItem key={c} value={c}>
                <Checkbox checked={selectedMainCats.includes(c)} />
                <ListItemText primary={c} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Sub Category Filter */}
        <FormControl sx={{ minWidth: 180 }} size="small">
          <InputLabel>Sub Category</InputLabel>
          <Select 
            multiple 
            value={selectedSubCats} 
            onChange={(e) => setSelectedSubCats(e.target.value as string[])} 
            renderValue={(selected) => selected.length === 0 ? 'All Categories' : `Selected (${selected.length})`} 
            label="Sub Category"
          >
            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setSelectedSubCats(subOptions); }}>All</Button>
                <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setSelectedSubCats([]); }}>Clear</Button>
            </Box>
            <Divider />
            {subOptions.map((sc) => (
              <MenuItem key={sc} value={sc}>
                <Checkbox checked={selectedSubCats.includes(sc)} />
                <ListItemText primary={sc} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <DatePicker label="Est. Start Date" value={dateRange[0]} onChange={(d) => setDateRange([d, dateRange[1]])} slotProps={{ textField: { size: 'small' } }} />
        <DatePicker label="Est. End Date" value={dateRange[1]} onChange={(d) => setDateRange([dateRange[0], d])} slotProps={{ textField: { size: 'small' } }} />
        
        <Button variant="contained" startIcon={<Add />} onClick={handleCreateNew} sx={{ ml: 'auto' }}>New Task</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell width={80}>No.</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Personnel</TableCell>
              <TableCell>Actual Dates</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Time Spent</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {processedTasks.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}><Typography color="textSecondary">No tasks match your filters</Typography></TableCell>
                 </TableRow>
            ) : processedTasks.map((task) => {
              const actual = getActualDates(task);
              return (
                <TableRow key={task.id} hover>
                  <TableCell>
                      <Typography variant="body2" color="textSecondary" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: task.depth === 1 ? 'bold' : 'normal' }}>
                          {task.indexDisplay}
                      </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: task.depth === 1 ? 'bold' : 'normal' }}>{task.title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{task.aliasTitle}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                      <Chip label={task.mainCategory || '其他'} size="small" variant="outlined" sx={{ mr: 0.5 }} />
                      <Chip label={task.subCategory || '其他'} size="small" variant="outlined" color="primary" />
                  </TableCell>
                  <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Person sx={{ fontSize: 14, color: 'primary.main' }} />
                              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>A: {task.assignee || '-'}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="textSecondary">R: {task.reporter || '-'}</Typography>
                          </Box>
                      </Box>
                  </TableCell>
                  <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EventAvailable sx={{ fontSize: 14, color: 'success.main' }} />
                              <Typography variant="caption">S: {formatDate(actual.start)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EventBusy sx={{ fontSize: 14, color: task.status === 'DONE' ? 'error.main' : 'text.disabled' }} />
                              <Typography variant="caption">F: {formatDate(actual.end)}</Typography>
                          </Box>
                      </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={task.status} color={task.status === 'IN_PROGRESS' ? 'primary' : task.status === 'DONE' ? 'success' : task.status === 'PAUSED' ? 'warning' : 'default'} size="small" />
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(task.totalTimeSpent)}</TableCell>
                  <TableCell align="right">
                    {task.status === 'IN_PROGRESS' ? (
                      <IconButton size="small" color="warning" onClick={() => stopTimer(task.id)}><Pause /></IconButton>
                    ) : (
                      <IconButton size="small" color="primary" onClick={() => startTimer(task.id)}><PlayArrow /></IconButton>
                    )}
                    <IconButton size="small" onClick={() => handleEdit(task)}><Edit fontSize="small" /></IconButton>
                    {task.depth < 5 ? (
                      <IconButton size="small" onClick={() => handleCreateSubTask(task.id)} title="Add Subtask"><SubdirectoryArrowRight fontSize="small" /></IconButton>
                    ) : (
                      <IconButton size="small" disabled title="Max depth reached"><SubdirectoryArrowRight fontSize="small" sx={{ opacity: 0.1 }} /></IconButton>
                    )}
                     <IconButton size="small" onClick={() => deleteTask(task.id)} color="error"><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TaskForm open={isFormOpen} onClose={() => setIsFormOpen(false)} initialData={editingTask} parentId={parentTaskId} />
    </Box>
  );
};