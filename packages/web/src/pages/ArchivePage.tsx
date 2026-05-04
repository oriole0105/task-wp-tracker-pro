import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, IconButton, Chip, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText,
  Typography, TextField, InputAdornment, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Snackbar, Alert, Tooltip,
} from '@mui/material';
import {
  Search, FilterListOff, SelectAll, Unarchive, DeleteForever, Archive,
} from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import type { Task } from '@tt/shared/types';
import { format } from 'date-fns';

const formatTime = (ms: number) => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  return `${hours}h ${minutes}m`;
};

const formatDateOnly = (ts: number | undefined) => {
  if (!ts) return '-';
  return format(ts, 'yyyy-MM-dd');
};

const ArchivePage: React.FC = () => {
  const { tasks, timeslots, mainCategories, unarchiveTask, deleteTask, undo } = useTaskStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMainCats, setSelectedMainCats] = useState<string[]>([]);

  // Delete confirmation
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const taskToDeleteHasChildren = useMemo(
    () => !!taskToDelete && tasks.some(t => t.parentId === taskToDelete.id),
    [taskToDelete, tasks]
  );

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [lastAction, setLastAction] = useState<'unarchive' | 'delete' | null>(null);

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

  const archivedTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks
      .filter(t => {
        if (!t.archived) return false;
        if (q) {
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchAlias = (t.aliasTitle || '').toLowerCase().includes(q);
          const matchDesc = (t.description || '').toLowerCase().includes(q);
          if (!matchTitle && !matchAlias && !matchDesc) return false;
        }
        if (selectedMainCats.length > 0 && !selectedMainCats.includes(t.mainCategory || '其他')) return false;
        return true;
      })
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
  }, [tasks, searchQuery, selectedMainCats]);

  const getParentTitle = (task: Task): string | undefined => {
    if (!task.parentId) return undefined;
    const parent = tasks.find(t => t.id === task.parentId);
    return parent?.aliasTitle || parent?.title;
  };

  const statusMap: Record<string, string> = {
    BACKLOG: '待規劃', TODO: '待處理', IN_PROGRESS: '進行中', PAUSED: '已暫停', DONE: '已完成', CANCELLED: '已取消',
  };

  const handleUnarchive = (task: Task) => {
    unarchiveTask(task.id);
    setLastAction('unarchive');
    setSnackbarMsg(`已還原「${task.title}」至任務列表`);
    setSnackbarOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!taskToDelete) return;
    const title = taskToDelete.title;
    deleteTask(taskToDelete.id);
    setTaskToDelete(null);
    setLastAction('delete');
    setSnackbarMsg(`已永久刪除「${title}」`);
    setSnackbarOpen(true);
  };

  const handleUndo = () => {
    undo();
    setSnackbarOpen(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Archive color="action" />
        <Typography variant="h4">封存庫</Typography>
        <Chip label={`${archivedTasks.length} 筆`} size="small" sx={{ ml: 1 }} />
      </Box>

      {/* Filter Bar */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', p: 2, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
        <TextField
          size="small"
          placeholder="搜尋封存任務名稱 / 別名 / 說明..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ minWidth: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel>任務分類</InputLabel>
          <Select
            multiple
            value={selectedMainCats}
            onChange={(e) => setSelectedMainCats(e.target.value as string[])}
            renderValue={(s) => s.length === 0 ? '全部' : `已選 (${s.length})`}
            label="任務分類"
          >
            <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<SelectAll />} onClick={(e) => { e.stopPropagation(); setSelectedMainCats([...mainCategories, '其他']); }}>全選</Button>
              <Button size="small" startIcon={<FilterListOff />} onClick={(e) => { e.stopPropagation(); setSelectedMainCats([]); }}>清除</Button>
            </Box>
            <Divider />
            {[...mainCategories, '其他'].map(c => (
              <MenuItem key={c} value={c}>
                <Checkbox checked={selectedMainCats.includes(c)} />
                <ListItemText primary={c} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Archive Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell>任務名稱</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>任務分類</TableCell>
              <TableCell>預估完成</TableCell>
              <TableCell>累計工時</TableCell>
              <TableCell>封存時間</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {archivedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                  <Archive sx={{ fontSize: 48, color: 'text.disabled', mb: 1, display: 'block', mx: 'auto' }} />
                  <Typography color="textSecondary">
                    {searchQuery || selectedMainCats.length > 0
                      ? '查無符合條件的封存任務'
                      : '封存庫是空的，可從任務管理頁封存已完成的任務'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : archivedTasks.map(task => {
              const parentTitle = getParentTitle(task);
              const totalTime = taskTotalTimeMap.get(task.id) || 0;
              return (
                <TableRow key={task.id} hover sx={{ opacity: 0.85 }}>
                  <TableCell>
                    <Box>
                      {parentTitle && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          ↳ {parentTitle}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ fontWeight: task.parentId ? 'normal' : 'bold' }}>
                        {task.title}
                      </Typography>
                      {task.aliasTitle && (
                        <Typography variant="caption" color="text.secondary">別名: {task.aliasTitle}</Typography>
                      )}
                      {task.labels && task.labels.length > 0 && (
                        <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {task.labels.map(l => (
                            <Chip key={l} label={l} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                          ))}
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusMap[task.status] ?? task.status}
                      color={task.status === 'DONE' ? 'success' : task.status === 'CANCELLED' ? 'error' : task.status === 'PAUSED' ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={task.mainCategory || '其他'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{formatDateOnly(task.estimatedEndDate)}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    <Typography variant="caption">{formatTime(totalTime)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{formatDateOnly(task.archivedAt)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="還原至任務列表">
                      <IconButton size="small" color="primary" onClick={() => handleUnarchive(task)}>
                        <Unarchive fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="永久刪除（無法復原）">
                      <IconButton size="small" color="error" onClick={() => setTaskToDelete(task)}>
                        <DeleteForever fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!taskToDelete} onClose={() => setTaskToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>確認永久刪除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            確定要永久刪除「<strong>{taskToDelete?.title}</strong>」嗎？此操作將刪除任務資料，<strong>無法透過 Undo 復原</strong>。
            {taskToDeleteHasChildren && (
              <Typography component="span" color="error" display="block" sx={{ mt: 1 }}>
                ⚠️ 此任務底下還有子任務，將會一併刪除。
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskToDelete(null)}>取消</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>永久刪除</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={lastAction === 'delete' ? 'warning' : 'success'}
          onClose={() => setSnackbarOpen(false)}
          action={
            lastAction !== 'delete' ? (
              <Button color="inherit" size="small" onClick={handleUndo}>復原</Button>
            ) : undefined
          }
        >
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ArchivePage;
