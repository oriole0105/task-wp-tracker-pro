import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, IconButton, Chip, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText,
  Typography, Divider, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Snackbar, Alert, Tooltip,
} from '@mui/material';
import {
  Edit, Delete, Add, SubdirectoryArrowRight,
  FilterListOff, SelectAll, EventAvailable, EventBusy,
  KeyboardArrowDown, KeyboardArrowRight, KeyboardArrowLeft, UnfoldLess, UnfoldMore, EventNote,
  Search, WarningAmber, Archive, Inventory, ArrowUpward, ArrowDownward,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
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

const formatDateOnly = (ts: number | undefined) => {
  if (!ts) return '-';
  return format(ts, 'yyyy-MM-dd');
};

interface IndexedTask extends Task {
  indexDisplay: string;
  depth: number;
  hasChildren: boolean;
}

export const TaskList: React.FC = () => {
  const { tasks, timeslots, mainCategories, deleteTask, archiveTask, archiveAllDone, undo, reorderTask } = useTaskStore();

  const [filterStatus, setFilterStatus] = useState<TaskStatus[]>(['BACKLOG', 'TODO', 'IN_PROGRESS', 'PAUSED']);
  const [selectedMainCats, setSelectedMainCats] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [parentTaskId, setParentTaskId] = useState<string | undefined>(undefined);

  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(new Set());

  // Delete confirmation state
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const taskToDeleteHasChildren = useMemo(
    () => !!taskToDelete && tasks.some((t) => t.parentId === taskToDelete.id),
    [taskToDelete, tasks]
  );

  // Undo snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  // 預先計算每個任務的累計工時
  const taskTotalTimeMap = useMemo(() => {
    const map = new Map<string, number>();
    timeslots.forEach(ts => {
      if (ts.taskId && ts.endTime) {
        const existing = map.get(ts.taskId) || 0;
        map.set(ts.taskId, existing + (ts.endTime - ts.startTime));
      }
    });
    return map;
  }, [timeslots]);

  const toggleCollapse = (id: string) => {
    const newCollapsed = new Set(collapsedTaskIds);
    if (newCollapsed.has(id)) newCollapsed.delete(id);
    else newCollapsed.add(id);
    setCollapsedTaskIds(newCollapsed);
  };

  const expandAll = () => setCollapsedTaskIds(new Set());
  const collapseAll = () => {
    const allParentIds = new Set(tasks.filter(t => tasks.some(child => child.parentId === t.id)).map(t => t.id));
    setCollapsedTaskIds(allParentIds);
  };

  const allAvailableLabels = useMemo(() => {
    const labels = new Set<string>();
    tasks.forEach(t => (t.labels || []).forEach(l => labels.add(l)));
    return Array.from(labels).sort();
  }, [tasks]);

  const archivedCount = useMemo(() => tasks.filter(t => t.archived).length, [tasks]);

  const processedTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const baseFiltered = tasks.filter(task => {
      if (task.archived) return false;
      if (q) {
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchAlias = (task.aliasTitle || '').toLowerCase().includes(q);
        const matchDesc = (task.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchAlias && !matchDesc) return false;
      }
      if (filterStatus.length > 0 && !filterStatus.includes(task.status)) return false;
      if (selectedMainCats.length > 0 && !selectedMainCats.includes(task.mainCategory || '其他')) return false;
      if (selectedLabels.length > 0 && !(task.labels || []).some(l => selectedLabels.includes(l))) return false;
      if (dateRange[0] && task.estimatedStartDate && task.estimatedStartDate < dateRange[0].getTime()) return false;
      if (dateRange[1] && task.estimatedEndDate && task.estimatedEndDate > dateRange[1].getTime()) return false;
      return true;
    });

    const result: IndexedTask[] = [];
    const buildHierarchy = (parentId: string | undefined, prefix: string, depth: number, isHiddenByParent: boolean) => {
      const children = baseFiltered.filter(t => t.parentId === parentId);
      children.forEach((child, i) => {
        const currentIndex = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        const hasChildren = baseFiltered.some(t => t.parentId === child.id);
        const isCurrentlyCollapsed = collapsedTaskIds.has(child.id);
        if (!isHiddenByParent) result.push({ ...child, indexDisplay: currentIndex, depth, hasChildren });
        if (depth < 5) buildHierarchy(child.id, currentIndex, depth + 1, isHiddenByParent || isCurrentlyCollapsed);
      });
    };

    const rootTasks = baseFiltered.filter(t => !t.parentId || !baseFiltered.find(p => p.id === t.parentId));
    rootTasks.forEach((task, i) => {
      const currentIndex = `${i + 1}`;
      const hasChildren = baseFiltered.some(t => t.parentId === task.id);
      const isCurrentlyCollapsed = collapsedTaskIds.has(task.id);
      result.push({ ...task, indexDisplay: currentIndex, depth: 1, hasChildren });
      buildHierarchy(task.id, currentIndex, 2, isCurrentlyCollapsed);
    });
    return result;
  }, [tasks, filterStatus, selectedMainCats, selectedLabels, dateRange, collapsedTaskIds, searchQuery]);

  const getActualDates = (task: Task) => {
    const logs = timeslots.filter(ts => ts.taskId === task.id);
    if (logs.length === 0) return { start: undefined, end: undefined };
    const start = Math.min(...logs.map(l => l.startTime));
    let end = undefined;
    if (task.status === 'DONE') {
      const endedLogs = logs.filter(l => l.endTime);
      if (endedLogs.length > 0) end = Math.max(...endedLogs.map(l => l.endTime!));
    }
    return { start, end };
  };

  const handleArchiveTask = (task: Task) => {
    archiveTask(task.id);
    setSnackbarMsg(`已封存「${task.title}」`);
    setSnackbarOpen(true);
  };

  const handleArchiveAllDone = () => {
    const count = tasks.filter(t => (t.status === 'DONE' || t.status === 'CANCELLED') && !t.archived).length;
    archiveAllDone();
    setSnackbarMsg(`已封存 ${count} 筆已完成/已取消任務`);
    setSnackbarOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!taskToDelete) return;
    const taskTitle = taskToDelete.title;
    deleteTask(taskToDelete.id);
    setTaskToDelete(null);
    setSnackbarMsg(`已刪除「${taskTitle}」`);
    setSnackbarOpen(true);
  };

  const handleUndo = () => {
    undo();
    setSnackbarOpen(false);
  };

  const statusMap: Record<TaskStatus, string> = {
    'BACKLOG': '待規劃',
    'TODO': '待處理',
    'IN_PROGRESS': '進行中',
    'PAUSED': '已暫停',
    'DONE': '已完成',
    'CANCELLED': '已取消',
  };

  const now = Date.now();

  return (
    <Box>
      {/* Filter Bar */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>

        {/* Search */}
        <TextField
          size="small"
          placeholder="搜尋任務名稱 / 別名 / 說明..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel>狀態</InputLabel>
          <Select multiple value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as TaskStatus[])} renderValue={(selected) => selected.length === 6 ? '全部' : selected.map(s => statusMap[s]).join(', ')} label="狀態">
            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setFilterStatus(['BACKLOG', 'TODO', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED']); }}>全選</Button>
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
              <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setSelectedMainCats([...mainCategories, '其他']); }}>全選</Button>
              <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setSelectedMainCats([]); }}>清除</Button>
            </Box>
            <Divider />
            {[...mainCategories, '其他'].map((c) => (
              <MenuItem key={c} value={c}>
                <Checkbox checked={selectedMainCats.includes(c)} />
                <ListItemText primary={c} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel>標籤篩選</InputLabel>
          <Select multiple value={selectedLabels} onChange={(e) => setSelectedLabels(e.target.value as string[])} renderValue={(selected) => selected.length === 0 ? '全部標籤' : `已選 (${selected.length})`} label="標籤篩選">
            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setSelectedLabels(allAvailableLabels); }}>全選</Button>
              <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setSelectedLabels([]); }}>清除</Button>
            </Box>
            <Divider />
            {allAvailableLabels.map((l) => (
              <MenuItem key={l} value={l}>
                <Checkbox checked={selectedLabels.includes(l)} />
                <ListItemText primary={l} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <DatePicker label="篩選開始日" value={dateRange[0]} onChange={(d) => setDateRange([d, dateRange[1]])} slotProps={{ textField: { size: 'small' } }} />
        <DatePicker label="篩選完成日" value={dateRange[1]} onChange={(d) => setDateRange([dateRange[0], d])} slotProps={{ textField: { size: 'small' } }} />

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<UnfoldLess />} onClick={collapseAll}>縮合</Button>
          <Button variant="outlined" size="small" startIcon={<UnfoldMore />} onClick={expandAll}>展開</Button>
          <Tooltip title={tasks.some(t => (t.status === 'DONE' || t.status === 'CANCELLED') && !t.archived) ? '將所有已完成/已取消任務移至封存庫' : '目前沒有可封存的任務'}>
            <span>
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                startIcon={<Inventory fontSize="small" />}
                onClick={handleArchiveAllDone}
                disabled={!tasks.some(t => (t.status === 'DONE' || t.status === 'CANCELLED') && !t.archived)}
              >
                封存所有已完成
              </Button>
            </span>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setEditingTask(undefined); setParentTaskId(undefined); setIsFormOpen(true); }}>建立任務</Button>
        </Box>
      </Box>

      {/* Archive Banner */}
      {archivedCount > 0 && (
        <Alert
          severity="info"
          icon={<Archive fontSize="inherit" />}
          sx={{ mb: 2 }}
          action={
            <Button component={RouterLink} to="/archive" size="small" color="inherit" startIcon={<Archive fontSize="small" />}>
              前往封存庫
            </Button>
          }
        >
          已封存 <strong>{archivedCount}</strong> 筆任務（未顯示於此列表）
        </Alert>
      )}

      {/* Task Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell width={120}>No.</TableCell>
              <TableCell>任務名稱</TableCell>
              <TableCell>任務分類</TableCell>
              <TableCell>預估日期</TableCell>
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
              const isCollapsed = collapsedTaskIds.has(task.id);
              const isDoneOrCancelled = task.status === 'DONE' || task.status === 'CANCELLED';
              const isOverdue = !isDoneOrCancelled && !!task.estimatedEndDate && task.estimatedEndDate < now;
              const totalTime = taskTotalTimeMap.get(task.id) || 0;

              return (
                <TableRow key={task.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {task.hasChildren ? (
                        <IconButton size="small" onClick={() => toggleCollapse(task.id)} sx={{ mr: 0.5, p: 0.25 }}>
                          {isCollapsed ? <KeyboardArrowRight fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                        </IconButton>
                      ) : <Box sx={{ width: 26 }} />}
                      <Typography variant="body2" color="textSecondary" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: task.depth === 1 ? 'bold' : 'normal' }}>
                        {task.indexDisplay}
                      </Typography>
                    </Box>
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
                    <Chip label={task.mainCategory || '其他'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EventNote sx={{ fontSize: 14, color: 'action.active' }} />
                        <Typography variant="caption">始: {formatDateOnly(task.estimatedStartDate)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EventNote sx={{ fontSize: 14, color: isOverdue ? 'error.main' : 'action.active' }} />
                        <Typography variant="caption" color={isOverdue ? 'error' : 'inherit'}>末: {formatDateOnly(task.estimatedEndDate)}</Typography>
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
                        <EventBusy sx={{ fontSize: 14, color: isDoneOrCancelled ? 'error.main' : 'text.disabled' }} />
                        <Typography variant="caption">終: {formatDate(actual.end)}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={statusMap[task.status]}
                        color={
                          task.status === 'IN_PROGRESS' ? 'primary' :
                          task.status === 'DONE' ? 'success' :
                          task.status === 'PAUSED' ? 'warning' :
                          task.status === 'CANCELLED' ? 'error' :
                          'default'
                        }
                        size="small"
                      />
                      {task.completeness !== undefined && (
                        <Typography variant="caption" color="text.secondary">{task.completeness}%</Typography>
                      )}
                      {isOverdue && (
                        <Tooltip title={`已逾期！預估完成：${formatDateOnly(task.estimatedEndDate)}`}>
                          <WarningAmber fontSize="small" color="error" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(totalTime)}</TableCell>
                  <TableCell align="right">
                    {(() => {
                      const allSiblings = tasks.filter(t => t.parentId === task.parentId && !t.archived);
                      const sibIdx = allSiblings.findIndex(t => t.id === task.id);
                      return (
                        <Box component="span" sx={{ mr: 0.5 }}>
                          <Tooltip title="向上移（與上一個同層任務互換）">
                            <span>
                              <IconButton size="small" disabled={sibIdx <= 0} onClick={() => reorderTask(task.id, 'up')}><ArrowUpward sx={{ fontSize: 14 }} /></IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="向下移（與下一個同層任務互換）">
                            <span>
                              <IconButton size="small" disabled={sibIdx >= allSiblings.length - 1} onClick={() => reorderTask(task.id, 'down')}><ArrowDownward sx={{ fontSize: 14 }} /></IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="向前（提升層級）">
                            <span>
                              <IconButton size="small" disabled={!task.parentId} onClick={() => reorderTask(task.id, 'promote')}><KeyboardArrowLeft sx={{ fontSize: 14 }} /></IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="向後（降低層級，成為上一任務的子任務）">
                            <span>
                              <IconButton size="small" disabled={sibIdx <= 0} onClick={() => reorderTask(task.id, 'demote')}><KeyboardArrowRight sx={{ fontSize: 14 }} /></IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      );
                    })()}
                    <IconButton size="small" onClick={() => { setEditingTask(task); setParentTaskId(undefined); setIsFormOpen(true); }}><Edit fontSize="small" /></IconButton>
                    {task.depth < 5 ? (
                      <IconButton size="small" onClick={() => { setEditingTask(undefined); setParentTaskId(task.id); setIsFormOpen(true); }} title="建立子任務"><SubdirectoryArrowRight fontSize="small" /></IconButton>
                    ) : <IconButton size="small" disabled><SubdirectoryArrowRight fontSize="small" sx={{ opacity: 0.1 }} /></IconButton>}
                    {isDoneOrCancelled && (
                      <Tooltip title="封存此任務">
                        <IconButton size="small" color="secondary" onClick={() => handleArchiveTask(task)}>
                          <Archive fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton size="small" onClick={() => setTaskToDelete(task)} color="error"><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TaskForm open={isFormOpen} onClose={() => setIsFormOpen(false)} initialData={editingTask} parentId={parentTaskId} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!taskToDelete} onClose={() => setTaskToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>確認刪除任務</DialogTitle>
        <DialogContent>
          <DialogContentText>
            確定要刪除任務「<strong>{taskToDelete?.title}</strong>」嗎？
            {taskToDeleteHasChildren && (
              <Typography component="span" color="error" display="block" sx={{ mt: 1 }}>
                ⚠️ 此任務底下還有子任務，將會一併刪除。
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskToDelete(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>確認刪除</Button>
        </DialogActions>
      </Dialog>

      {/* Undo Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          onClose={() => setSnackbarOpen(false)}
          action={
            <Button color="inherit" size="small" onClick={handleUndo}>
              復原
            </Button>
          }
        >
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};
