import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, IconButton, Chip, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText,
  Typography, Divider, TextField, InputAdornment, Switch,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Snackbar, Alert, Tooltip,
} from '@mui/material';
import {
  Edit, Delete, Add, SubdirectoryArrowRight, ContentCopy, CopyAll, FileUpload, AccountTree,
  FilterListOff, SelectAll, EventAvailable, EventBusy,
  KeyboardArrowDown, KeyboardArrowRight, KeyboardArrowLeft, UnfoldLess, UnfoldMore, EventNote,
  Search, WarningAmber, Archive, Inventory, ArrowUpward, ArrowDownward, Tune,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers';
import { useTaskStore } from '../store/useTaskStore';
import type { Task, TaskStatus, JsonImportTask } from '@tt/shared/types';
import { TaskForm } from './TaskForm';
import { format } from 'date-fns';
import { getTaskActualStart, getTaskActualEnd } from '@tt/shared/utils/taskDateUtils';
import { computeTaskWbsMap } from '@tt/shared/utils/wbs';

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

const tsToDateStr = (ts: number | undefined): string =>
  ts ? format(ts, 'yyyy-MM-dd') : '';

const dateStrToTs = (s: string): number | undefined => {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

interface IndexedTask extends Task {
  indexDisplay: string;
  depth: number;
  hasChildren: boolean;
}

export const TaskList: React.FC = () => {
  const { tasks, timeslots, mainCategories, deleteTask, duplicateTask, duplicateSubtree, archiveTask, archiveAllDone, undo, reorderTask, importTasksFromJson, updateTask, quickAddAction, setQuickAddAction, preventDuplicateTaskNames } = useTaskStore();

  const [filterStatus, setFilterStatus] = useState<TaskStatus[]>(['BACKLOG', 'TODO', 'IN_PROGRESS', 'PAUSED']);
  const [selectedMainCats, setSelectedMainCats] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsMode, setSettingsMode] = useState(false);
  // 設定模式：inline 標題編輯暫存 { taskId -> draftTitle }
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  // 設定模式：標題有重複名稱的 taskId 集合
  const [titleErrors, setTitleErrors] = useState<Record<string, string>>({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [parentTaskId, setParentTaskId] = useState<string | undefined>(undefined);

  // 手機快速新增：從底部導航「＋」按鈕觸發
  useEffect(() => {
    if (quickAddAction === 'task') {
      setEditingTask(undefined);
      setParentTaskId(undefined);
      setIsFormOpen(true);
      setQuickAddAction(null);
    }
  }, [quickAddAction, setQuickAddAction]);

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

  // JSON 匯入狀態
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJsonTasks, setImportJsonTasks] = useState<JsonImportTask[]>([]);
  const [importParentId, setImportParentId] = useState<string>('');

  // 子樹複製 Dialog 狀態
  const [subtreeCopyTaskId, setSubtreeCopyTaskId] = useState<string | null>(null);
  const [subtreePrefix, setSubtreePrefix] = useState('');
  const [subtreePostfix, setSubtreePostfix] = useState('');
  const [subtreeSearch, setSubtreeSearch] = useState('');
  const [subtreeReplace, setSubtreeReplace] = useState('');

  // 取得某任務的整棵子樹（含自身），回傳 [{ task, depth }]
  const getSubtreePreview = useMemo(() => (rootId: string) => {
    const result: { task: Task; depth: number }[] = [];
    const collect = (taskId: string, depth: number) => {
      const task = tasks.find(t => t.id === taskId && !t.archived);
      if (!task) return;
      result.push({ task, depth });
      tasks.filter(t => t.parentId === taskId && !t.archived).forEach(c => collect(c.id, depth + 1));
    };
    collect(rootId, 0);
    return result;
  }, [tasks]);

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

  // WBS 供父任務下拉使用
  const { wbsNumbers: importWbsNumbers, sorted: importWbsSorted } = useMemo(
    () => computeTaskWbsMap(tasks.filter(t => !t.archived)),
    [tasks]
  );

  // 計算要匯入的任務總數（含子任務，遞迴）
  const countImportTasks = (items: JsonImportTask[]): number =>
    items.reduce((acc, t) => acc + 1 + countImportTasks(t.children ?? []), 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const taskArray: JsonImportTask[] = Array.isArray(json) ? json : json.tasks;
        if (!Array.isArray(taskArray) || taskArray.length === 0) {
          setSnackbarMsg('JSON 格式錯誤：需要 tasks 陣列或頂層陣列');
          setSnackbarOpen(true);
          return;
        }
        setImportJsonTasks(taskArray);
        setImportParentId('');
        setImportDialogOpen(true);
      } catch {
        setSnackbarMsg('解析 JSON 失敗，請確認檔案格式正確');
        setSnackbarOpen(true);
      } finally {
        // 重設 input，讓同一檔案可再次選取
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    importTasksFromJson(importJsonTasks, importParentId || undefined);
    setImportDialogOpen(false);
    const total = countImportTasks(importJsonTasks);
    setSnackbarMsg(`已匯入 ${total} 個任務`);
    setSnackbarOpen(true);
  };

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
    const start = getTaskActualStart(task.id, tasks, timeslots);
    let end: number | undefined = undefined;
    if (task.status === 'DONE') {
      end = getTaskActualEnd(task.id, tasks, timeslots);
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

  const ganttModeMap: Record<'bar' | 'section' | 'hidden', string> = {
    bar: '進度列',
    section: '章節標題',
    hidden: '不顯示',
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
          <Button variant="outlined" size="small" startIcon={<FileUpload />} onClick={() => fileInputRef.current?.click()}>匯入 JSON</Button>
          <Tooltip title={settingsMode ? '切換回一般檢視模式' : '切換至設定模式，可快速批次調整任務設定'}>
            <Button
              variant={settingsMode ? 'contained' : 'outlined'}
              size="small"
              startIcon={<Tune fontSize="small" />}
              color={settingsMode ? 'warning' : 'inherit'}
              onClick={() => setSettingsMode(v => !v)}
            >
              設定模式
            </Button>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => { setEditingTask(undefined); setParentTaskId(undefined); setIsFormOpen(true); }}>建立任務</Button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileChange} />
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

      {/* Settings mode hint */}
      {settingsMode && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          設定模式：每項變更會立即儲存。可使用左上角「復原」按鈕撤銷。
        </Alert>
      )}

      {/* Task Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            {settingsMode ? (
              <TableRow>
                <TableCell width={120}>No.</TableCell>
                <TableCell>任務名稱</TableCell>
                <TableCell width={80} align="center">WBS 顯示</TableCell>
                <TableCell width={130}>甘特圖模式</TableCell>
                <TableCell width={140}>預估開始</TableCell>
                <TableCell width={140}>預估完成</TableCell>
                <TableCell width={140}>任務分類</TableCell>
                <TableCell width={130}>狀態</TableCell>
                <TableCell width={80} align="center">追蹤完成度</TableCell>
                <TableCell width={90}>完成度 %</TableCell>
              </TableRow>
            ) : (
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
            )}
          </TableHead>
          <TableBody>
            {processedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={settingsMode ? 10 : 8} align="center" sx={{ py: 8 }}><Typography color="textSecondary">查無符合條件的任務</Typography></TableCell>
              </TableRow>
            ) : processedTasks.map((task) => {
              // 共用：No. 欄
              const noCell = (
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {task.hasChildren ? (
                      <IconButton size="small" onClick={() => toggleCollapse(task.id)} sx={{ mr: 0.5, p: 0.25 }}>
                        {collapsedTaskIds.has(task.id) ? <KeyboardArrowRight fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                      </IconButton>
                    ) : <Box sx={{ width: 26 }} />}
                    <Typography variant="body2" color="textSecondary" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: task.depth === 1 ? 'bold' : 'normal' }}>
                      {task.indexDisplay}
                    </Typography>
                  </Box>
                </TableCell>
              );

              // 共用：任務名稱欄
              const titleDraft = titleDrafts[task.id] ?? task.title;
              const titleError = titleErrors[task.id];
              const handleTitleCommit = (draft: string) => {
                const trimmed = draft.trim();
                if (!trimmed) {
                  // 空白：還原，清除錯誤
                  setTitleDrafts(p => { const n = { ...p }; delete n[task.id]; return n; });
                  setTitleErrors(p => { const n = { ...p }; delete n[task.id]; return n; });
                  return;
                }
                if (preventDuplicateTaskNames) {
                  const conflict = tasks.find(t => t.id !== task.id && t.title === trimmed);
                  if (conflict) {
                    setTitleErrors(p => ({ ...p, [task.id]: `「${trimmed}」已被其他任務使用` }));
                    return; // 不儲存
                  }
                }
                setTitleErrors(p => { const n = { ...p }; delete n[task.id]; return n; });
                setTitleDrafts(p => { const n = { ...p }; delete n[task.id]; return n; });
                if (trimmed !== task.title) updateTask(task.id, { title: trimmed });
              };
              const titleCell = settingsMode ? (
                <TableCell sx={{ minWidth: 200 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={titleDraft}
                    error={!!titleError}
                    helperText={titleError}
                    onChange={(e) => {
                      setTitleDrafts(p => ({ ...p, [task.id]: e.target.value }));
                      if (titleErrors[task.id]) setTitleErrors(p => { const n = { ...p }; delete n[task.id]; return n; });
                    }}
                    onBlur={() => handleTitleCommit(titleDraft)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleTitleCommit(titleDraft); }
                      if (e.key === 'Escape') {
                        setTitleDrafts(p => { const n = { ...p }; delete n[task.id]; return n; });
                        setTitleErrors(p => { const n = { ...p }; delete n[task.id]; return n; });
                      }
                    }}
                    slotProps={{ htmlInput: { style: { fontWeight: task.depth === 1 ? 'bold' : 'normal', fontSize: '0.875rem' } } }}
                  />
                </TableCell>
              ) : (
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
              );

              if (settingsMode) {
                return (
                  <TableRow key={task.id} hover>
                    {noCell}
                    {titleCell}
                    {/* WBS 顯示 */}
                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={task.showInWbs !== false}
                        onChange={(e) => updateTask(task.id, { showInWbs: e.target.checked })}
                      />
                    </TableCell>
                    {/* 甘特圖模式 */}
                    <TableCell>
                      <Select
                        size="small"
                        value={task.ganttDisplayMode ?? 'bar'}
                        onChange={(e) => updateTask(task.id, { ganttDisplayMode: e.target.value as 'bar' | 'section' | 'hidden' })}
                        sx={{ minWidth: 110 }}
                      >
                        {Object.entries(ganttModeMap).map(([k, v]) => (
                          <MenuItem key={k} value={k}>{v}</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    {/* 預估開始 */}
                    <TableCell>
                      <TextField
                        type="date"
                        size="small"
                        value={tsToDateStr(task.estimatedStartDate)}
                        onChange={(e) => updateTask(task.id, { estimatedStartDate: dateStrToTs(e.target.value) })}
                        sx={{ width: 130 }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.8rem', padding: '4px 8px' } } }}
                      />
                    </TableCell>
                    {/* 預估完成 */}
                    <TableCell>
                      <TextField
                        type="date"
                        size="small"
                        value={tsToDateStr(task.estimatedEndDate)}
                        onChange={(e) => updateTask(task.id, { estimatedEndDate: dateStrToTs(e.target.value) })}
                        sx={{ width: 130 }}
                        slotProps={{ htmlInput: { style: { fontSize: '0.8rem', padding: '4px 8px' } } }}
                      />
                    </TableCell>
                    {/* 任務分類 */}
                    <TableCell>
                      <Select
                        size="small"
                        value={task.mainCategory || '其他'}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateTask(task.id, { mainCategory: val === '其他' ? undefined : val });
                        }}
                        sx={{ minWidth: 110 }}
                      >
                        {[...mainCategories, '其他'].map(c => (
                          <MenuItem key={c} value={c}>{c}</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    {/* 狀態 */}
                    <TableCell>
                      <Select
                        size="small"
                        value={task.status}
                        onChange={(e) => updateTask(task.id, { status: e.target.value as TaskStatus })}
                        sx={{ minWidth: 100 }}
                      >
                        {Object.entries(statusMap).map(([k, v]) => (
                          <MenuItem key={k} value={k}>{v}</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    {/* 追蹤完成度 */}
                    <TableCell align="center">
                      <Switch
                        size="small"
                        checked={task.trackCompleteness !== false}
                        onChange={(e) => updateTask(task.id, { trackCompleteness: e.target.checked })}
                      />
                    </TableCell>
                    {/* 完成度 % */}
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={task.completeness ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? undefined : Math.min(100, Math.max(0, Number(e.target.value)));
                          updateTask(task.id, { completeness: v });
                        }}
                        disabled={task.trackCompleteness === false}
                        sx={{ width: 72 }}
                        slotProps={{ htmlInput: { min: 0, max: 100, step: 5, style: { fontSize: '0.8rem', padding: '4px 8px' } } }}
                      />
                    </TableCell>
                  </TableRow>
                );
              }

              // 一般模式
              const actual = getActualDates(task);
              const isDoneOrCancelled = task.status === 'DONE' || task.status === 'CANCELLED';
              const isOverdue = !isDoneOrCancelled && !!task.estimatedEndDate && task.estimatedEndDate < now;
              const totalTime = taskTotalTimeMap.get(task.id) || 0;

              return (
                <TableRow key={task.id} hover>
                  {noCell}
                  {titleCell}
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
                    <Tooltip title="複製任務">
                      <IconButton size="small" onClick={() => duplicateTask(task.id)}><ContentCopy fontSize="small" /></IconButton>
                    </Tooltip>
                    {task.hasChildren && (
                      <Tooltip title="複製整棵子樹（含所有子任務）">
                        <IconButton size="small" onClick={() => { setSubtreeCopyTaskId(task.id); setSubtreePrefix(''); setSubtreePostfix(''); setSubtreeSearch(''); setSubtreeReplace(''); }}>
                          <CopyAll fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
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

      {/* 子樹複製 Dialog */}
      {subtreeCopyTaskId && (() => {
        const preview = getSubtreePreview(subtreeCopyTaskId);
        // 套用所有改名規則：先取代，再加前後綴
        const transformTitle = (original: string) => {
          const mid = subtreeSearch ? original.replaceAll(subtreeSearch, subtreeReplace) : original;
          return `${subtreePrefix}${mid}${subtreePostfix}`;
        };
        return (
          <Dialog open onClose={() => setSubtreeCopyTaskId(null)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CopyAll fontSize="small" /> 複製整棵子樹
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <DialogContentText>
                將複製 <strong>{preview.length}</strong> 個任務（含自身與所有子任務），新任務狀態重置為 BACKLOG。
              </DialogContentText>

              {/* 前綴 / 後綴 */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  label="前綴 (Prefix)"
                  size="small"
                  fullWidth
                  value={subtreePrefix}
                  onChange={(e) => setSubtreePrefix(e.target.value)}
                  placeholder="例如：IP-B "
                />
                <TextField
                  label="後綴 (Postfix)"
                  size="small"
                  fullWidth
                  value={subtreePostfix}
                  onChange={(e) => setSubtreePostfix(e.target.value)}
                  placeholder="例如： v2"
                />
              </Box>

              {/* 字串取代 */}
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <TextField
                  label="搜尋字串"
                  size="small"
                  fullWidth
                  value={subtreeSearch}
                  onChange={(e) => setSubtreeSearch(e.target.value)}
                  placeholder="例如：IP-A"
                />
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>→</Typography>
                <TextField
                  label="取代為"
                  size="small"
                  fullWidth
                  value={subtreeReplace}
                  onChange={(e) => setSubtreeReplace(e.target.value)}
                  placeholder="例如：IP-B"
                  disabled={!subtreeSearch}
                />
              </Box>

              {/* 預覽 */}
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, maxHeight: 240, overflowY: 'auto' }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  新任務名稱預覽：
                </Typography>
                {preview.map(({ task, depth }) => {
                  const newTitle = transformTitle(task.title);
                  const changed = newTitle !== task.title;
                  return (
                    <Box key={task.id} sx={{ display: 'flex', alignItems: 'baseline', pl: depth * 2 }}>
                      <Typography variant="caption" color="text.disabled" sx={{ mr: 0.5, fontFamily: 'monospace' }}>{'└ '}</Typography>
                      <Typography variant="body2" sx={{ wordBreak: 'break-all', color: changed ? 'text.primary' : 'text.disabled' }}>
                        {subtreePrefix && <Box component="span" sx={{ color: 'primary.main', fontWeight: 'bold' }}>{subtreePrefix}</Box>}
                        {subtreeSearch
                          ? task.title.split(subtreeSearch).map((seg, i, arr) => (
                              <React.Fragment key={i}>
                                {seg}
                                {i < arr.length - 1 && (
                                  <Box component="span" sx={{ color: 'warning.main', fontWeight: 'bold', textDecoration: 'line-through', mx: 0.25 }}>{subtreeSearch}</Box>
                                )}
                                {i < arr.length - 1 && (
                                  <Box component="span" sx={{ color: 'success.main', fontWeight: 'bold' }}>{subtreeReplace}</Box>
                                )}
                              </React.Fragment>
                            ))
                          : task.title
                        }
                        {subtreePostfix && <Box component="span" sx={{ color: 'secondary.main', fontWeight: 'bold' }}>{subtreePostfix}</Box>}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSubtreeCopyTaskId(null)}>取消</Button>
              <Button
                variant="contained"
                startIcon={<CopyAll />}
                onClick={() => {
                  duplicateSubtree(subtreeCopyTaskId, subtreePrefix, subtreePostfix, subtreeSearch || undefined, subtreeReplace);
                  setSubtreeCopyTaskId(null);
                  setSnackbarMsg(`已複製子樹，共 ${preview.length} 個任務`);
                  setSnackbarOpen(true);
                }}
              >
                確認複製
              </Button>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* JSON 匯入 Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>匯入任務 JSON</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <DialogContentText>
            共 <strong>{countImportTasks(importJsonTasks)}</strong> 個任務（含子任務）將被匯入。
            請選擇要掛在哪個父任務下，留空則放在最上層。
          </DialogContentText>
          <FormControl fullWidth size="small">
            <InputLabel>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccountTree sx={{ fontSize: 16 }} /> 上層任務（留空 = 最上層）
              </Box>
            </InputLabel>
            <Select
              value={importParentId}
              onChange={(e) => setImportParentId(e.target.value)}
              label="上層任務（留空 = 最上層）"
            >
              <MenuItem value=""><em>最上層（無父任務）</em></MenuItem>
              {importWbsSorted.map((task) => {
                const wbs = importWbsNumbers.get(task.id);
                const depth = wbs ? wbs.split('.').length - 1 : 0;
                return (
                  <MenuItem key={task.id} value={task.id} sx={{ pl: 2 + depth * 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1, fontFamily: 'monospace' }}>{wbs}</Typography>
                    {task.title}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, maxHeight: 200, overflowY: 'auto' }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>預覽（前 10 個）</Typography>
            {importJsonTasks.slice(0, 10).map((t, i) => (
              <Typography key={i} variant="body2">・{t.title}{t.children?.length ? ` (含 ${t.children.length} 個子任務)` : ''}</Typography>
            ))}
            {importJsonTasks.length > 10 && (
              <Typography variant="caption" color="text.secondary">…等共 {importJsonTasks.length} 個頂層任務</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>取消</Button>
          <Button variant="contained" startIcon={<FileUpload />} onClick={handleImportConfirm}>確認匯入</Button>
        </DialogActions>
      </Dialog>

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
