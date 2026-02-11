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
  
  const [filterStatus, setFilterStatus] = useState<TaskStatus[]>(['TODO', 'IN_PROGRESS', 'PAUSED']);
  const [selectedMainCats, setSelectedMainCats] = useState<string[]>([]); 
  const [selectedSubCats, setSelectedSubCats] = useState<string[]>([]);   
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [parentTaskId, setParentTaskId] = useState<string | undefined>(undefined);

  // Extract unique labels from all tasks
  const allAvailableLabels = useMemo(() => {
    const labels = new Set<string>();
    tasks.forEach(t => (t.labels || []).forEach(l => labels.add(l)));
    return Array.from(labels).sort();
  }, [tasks]);

  const processedTasks = useMemo(() => {
    const baseFiltered = tasks.filter(task => {
      if (filterStatus.length > 0 && !filterStatus.includes(task.status)) return false;
      if (selectedMainCats.length > 0) {
          const taskCat = task.mainCategory || '其他';
          if (!selectedMainCats.includes(taskCat)) return false;
      }
      if (selectedSubCats.length > 0) {
          const taskSubCat = task.subCategory || '其他';
          if (!selectedSubCats.includes(taskSubCat)) return false;
      }
      // Label Filter: Show task if it has AT LEAST ONE of the selected labels
      if (selectedLabels.length > 0) {
          const taskLabels = task.labels || [];
          if (!taskLabels.some(l => selectedLabels.includes(l))) return false;
      }

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
  }, [tasks, filterStatus, selectedMainCats, selectedSubCats, selectedLabels, dateRange]);

  const getActualDates = (task: Task) => {
      if (!task.timeLogs || task.timeLogs.length === 0) return { start: undefined, end: undefined };
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

  const mainOptions = [...mainCategories, '其他'];
  const subOptions = [...subCategories, '其他'];

  const statusMap: Record<TaskStatus, string> = {
      'TODO': '待處理',
      'IN_PROGRESS': '進行中',
      'PAUSED': '已暫停',
      'DONE': '已完成'
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', p: 2, bgcolor: 'white', borderRadius: 1, boxShadow: 1 }}>
        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel>狀態</InputLabel>
          <Select multiple value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as TaskStatus[])} renderValue={(selected) => selected.length === 4 ? '全部' : selected.map(s => statusMap[s]).join(', ')} label="狀態">
             <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setFilterStatus(['TODO', 'IN_PROGRESS', 'PAUSED', 'DONE']); }}>全選</Button>
                <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setFilterStatus([]); }}>清除</Button>
            </Box>
            <Divider />
            {Object.entries(statusMap).map(([key, label]) => (
              <MenuItem key={key} value={key}>
                <Checkbox checked={filterStatus.indexOf(key as TaskStatus) > -1} />
                <ListItemText primary={label} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel>任務分類</InputLabel>
          <Select multiple value={selectedMainCats} onChange={(e) => setSelectedMainCats(e.target.value as string[])} renderValue={(selected) => selected.length === 0 ? '全部任務分類' : `已選 (${selected.length})`} label="任務分類">
            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setSelectedMainCats(mainOptions); }}>全選</Button>
                <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setSelectedMainCats([]); }}>清除</Button>
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

        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel>時間分類</InputLabel>
          <Select multiple value={selectedSubCats} onChange={(e) => setSelectedSubCats(e.target.value as string[])} renderValue={(selected) => selected.length === 0 ? '全部時間分類' : `已選 (${selected.length})`} label="時間分類">
            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setSelectedSubCats(subOptions); }}>全選</Button>
                <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setSelectedSubCats([]); }}>清除</Button>
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

        {/* Labels Filter */}
        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel>標籤篩選</InputLabel>
          <Select multiple value={selectedLabels} onChange={(e) => setSelectedLabels(e.target.value as string[])} renderValue={(selected) => selected.length === 0 ? '全部標籤' : `已選 (${selected.length})`} label="標籤篩選">
            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setSelectedLabels(allAvailableLabels); }}>全選</Button>
                <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setSelectedLabels([]); }}>清除</Button>
            </Box>
            <Divider />
            {allAvailableLabels.length === 0 ? (
                <MenuItem disabled>無可用標籤</MenuItem>
            ) : allAvailableLabels.map((l) => (
              <MenuItem key={l} value={l}>
                <Checkbox checked={selectedLabels.includes(l)} />
                <ListItemText primary={l} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <DatePicker label="預估開始日" value={dateRange[0]} onChange={(d) => setDateRange([d, dateRange[1]])} slotProps={{ textField: { size: 'small' } }} />
        <DatePicker label="預估完成日" value={dateRange[1]} onChange={(d) => setDateRange([dateRange[0], d])} slotProps={{ textField: { size: 'small' } }} />
        
        <Button variant="contained" startIcon={<Add />} onClick={handleCreateNew} sx={{ ml: 'auto' }}>建立任務</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell width={80}>No.</TableCell>
              <TableCell>任務名稱</TableCell>
              <TableCell>分類</TableCell>
              <TableCell>人員</TableCell>
              <TableCell>實際日期</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>累計工時</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {processedTasks.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}><Typography color="textSecondary">查無符合條件的任務</Typography></TableCell>
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
                      {task.aliasTitle && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>別名: {task.aliasTitle}</Typography>}
                      {task.labels && task.labels.length > 0 && (
                          <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {task.labels.map(l => <Chip key={l} label={l} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />)}
                          </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                      <Chip label={task.mainCategory || '其他'} size="small" variant="outlined" sx={{ mr: 0.5 }} title="任務分類" />
                      <Chip label={task.subCategory || '其他'} size="small" variant="outlined" color="primary" title="時間分類" />
                  </TableCell>
                  <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Person sx={{ fontSize: 14, color: 'primary.main' }} />
                              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>主: {task.assignee || '-'}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="textSecondary">派: {task.reporter || '-'}</Typography>
                          </Box>
                      </Box>
                  </TableCell>
                  <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EventAvailable sx={{ fontSize: 14, color: 'success.main' }} />
                              <Typography variant="caption">始: {formatDate(actual.start)}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EventBusy sx={{ fontSize: 14, color: task.status === 'DONE' ? 'error.main' : 'text.disabled' }} />
                              <Typography variant="caption">終: {formatDate(actual.end)}</Typography>
                          </Box>
                      </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={statusMap[task.status]} color={task.status === 'IN_PROGRESS' ? 'primary' : task.status === 'DONE' ? 'success' : task.status === 'PAUSED' ? 'warning' : 'default'} size="small" />
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
                      <IconButton size="small" onClick={() => handleCreateSubTask(task.id)} title="建立子任務"><SubdirectoryArrowRight fontSize="small" /></IconButton>
                    ) : (
                      <IconButton size="small" disabled title="已達最大深度"><SubdirectoryArrowRight fontSize="small" sx={{ opacity: 0.1 }} /></IconButton>
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