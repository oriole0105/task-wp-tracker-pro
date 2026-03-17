import React, { useState, useMemo, useRef } from 'react';
import {
  Box, Typography, TextField, Button, List, ListItem, ListItemIcon, ListItemText,
  Checkbox, IconButton, Chip, Paper, Stack, Collapse, Badge, Snackbar, Alert,
} from '@mui/material';
import {
  Delete, Edit, Check, Close, Add, ExpandMore, ExpandLess,
  FileDownload, FileUpload, DeleteSweep, InfoOutlined,
} from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import type { TodoItem } from '../types';

const TodoPage: React.FC = () => {
  const { todos, addTodo, toggleTodo, updateTodo, deleteTodo, clearDoneTodos, importTodos } = useTaskStore();
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDoneDate, setEditDoneDate] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const importRef = useRef<HTMLInputElement>(null);

  const pending = useMemo(
    () => todos.filter((t) => !t.done).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [todos]
  );
  const done = useMemo(
    () => todos.filter((t) => t.done).sort((a, b) => (b.doneDate ?? '').localeCompare(a.doneDate ?? '')),
    [todos]
  );

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    addTodo(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const startEdit = (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    setEditingId(id);
    setEditDesc(todo.description);
    setEditStartDate(todo.startDate);
    setEditDoneDate(todo.doneDate ?? '');
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateTodo(editingId, {
      description: editDesc,
      startDate: editStartDate,
      doneDate: editDoneDate || undefined,
    });
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  // --- Export helpers ---
  const exportAsJson = (items: TodoItem[], filename: string) => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPending = () => {
    exportAsJson(pending, `todos-pending-${new Date().toISOString().slice(0, 10)}.json`);
    setToast({ msg: `已匯出 ${pending.length} 筆未完成待辦事項`, severity: 'success' });
  };

  const handleExportDone = () => {
    const lines = done.map(
      (t) => `[x] ${t.description}\t開始：${t.startDate}\t完成：${t.doneDate ?? ''}`
    );
    const text = `已完成待辦事項（${done.length} 筆）\n${'─'.repeat(40)}\n${lines.join('\n')}\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todos-done-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Import ---
  const handleImportClick = () => importRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as unknown;
        if (!Array.isArray(data)) throw new Error('格式錯誤：應為陣列');
        const items = data as TodoItem[];
        // Basic validation
        for (const item of items) {
          if (typeof item.id !== 'string' || typeof item.description !== 'string') {
            throw new Error('資料欄位不符合格式');
          }
        }
        const { added, skipped } = importTodos(items);
        setToast({ msg: `匯入完成：新增 ${added} 筆，略過重複 ${skipped} 筆`, severity: 'success' });
      } catch (err) {
        setToast({ msg: `匯入失敗：${(err as Error).message}`, severity: 'error' });
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = '';
  };

  // --- Render todo item ---
  const renderTodoItem = (todo: typeof todos[0]) => (
    <Paper key={todo.id} sx={{ mb: 1 }}>
      {editingId === todo.id ? (
        <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, py: 1.5 }}>
          <TextField
            fullWidth size="small" label="描述"
            value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              size="small" label="開始日期" type="date"
              value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small" label="完成日期" type="date"
              value={editDoneDate} onChange={(e) => setEditDoneDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" startIcon={<Check />} onClick={saveEdit}>儲存</Button>
            <Button size="small" startIcon={<Close />} onClick={cancelEdit}>取消</Button>
          </Stack>
        </ListItem>
      ) : (
        <ListItem
          secondaryAction={
            <Stack direction="row" spacing={0}>
              <IconButton size="small" onClick={() => startEdit(todo.id)}><Edit fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => deleteTodo(todo.id)} color="error"><Delete fontSize="small" /></IconButton>
            </Stack>
          }
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Checkbox edge="start" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography sx={{
                textDecoration: todo.done ? 'line-through' : 'none',
                color: todo.done ? 'text.secondary' : 'text.primary',
              }}>
                {todo.description}
              </Typography>
            }
            secondary={
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                <Chip label={`開始：${todo.startDate}`} size="small" variant="outlined" />
                {todo.doneDate && (
                  <Chip label={`完成：${todo.doneDate}`} size="small" color="success" variant="outlined" />
                )}
              </Stack>
            }
          />
        </ListItem>
      )}
    </Paper>
  );

  return (
    <Box>
      <Typography variant="h5" gutterBottom>待辦事項</Typography>

      {/* Purpose description */}
      <Box sx={{ display: 'flex', gap: 1, p: 1.5, mb: 2, bgcolor: 'action.hover', borderRadius: 1, alignItems: 'flex-start' }}>
        <InfoOutlined fontSize="small" color="info" sx={{ mt: 0.2, flexShrink: 0 }} />
        <Typography variant="body2" color="text.secondary">
          這裡用來快速記錄<strong>短期的個人待辦小事</strong>，例如「寄信給 XX」、「查一下某份文件」。
          若是需要排程、工時追蹤或納入週報的正式工作項目，請改用<strong>任務管理</strong>建立任務。
        </Typography>
      </Box>

      {/* Input area + pending export/import */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            fullWidth size="small" placeholder="輸入待辦事項..."
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
          />
          <Button
            variant="contained" onClick={handleAdd} disabled={!input.trim()}
            startIcon={<Add />} sx={{ whiteSpace: 'nowrap' }}
          >
            新增
          </Button>
        </Stack>

        {/* Pending transfer controls */}
        {pending.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} justifyContent="flex-end">
            <Button size="small" startIcon={<FileDownload />} onClick={handleExportPending}>
              匯出未完成（JSON）
            </Button>
            <Button size="small" startIcon={<FileUpload />} onClick={handleImportClick}>
              匯入
            </Button>
          </Stack>
        )}
        {/* Show import button even when pending is empty */}
        {pending.length === 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} justifyContent="flex-end">
            <Button size="small" startIcon={<FileUpload />} onClick={handleImportClick}>
              匯入待辦事項
            </Button>
          </Stack>
        )}
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
      </Paper>

      {/* Pending list */}
      {pending.length === 0 && done.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          尚無待辦事項
        </Typography>
      ) : (
        <>
          {pending.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', my: 2 }}>
              所有待辦事項皆已完成
            </Typography>
          ) : (
            <List disablePadding>{pending.map(renderTodoItem)}</List>
          )}

          {/* Done section (collapsible) */}
          {done.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Paper
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setShowDone((v) => !v)}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  {showDone ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                  <Typography variant="subtitle2">已完成</Typography>
                  <Badge badgeContent={done.length} color="success" />
                </Stack>
                <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                  <Button size="small" startIcon={<FileDownload />} onClick={handleExportDone}>
                    匯出 .txt
                  </Button>
                  <Button
                    size="small" color="error" startIcon={<DeleteSweep />}
                    onClick={() => {
                      if (window.confirm(`確定清除所有 ${done.length} 筆已完成的待辦事項？`)) {
                        clearDoneTodos();
                        setShowDone(false);
                      }
                    }}
                  >
                    清除
                  </Button>
                </Stack>
              </Paper>
              <Collapse in={showDone}>
                <List disablePadding sx={{ mt: 1 }}>{done.map(renderTodoItem)}</List>
              </Collapse>
            </Box>
          )}
        </>
      )}

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity ?? 'info'} variant="filled" onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TodoPage;
