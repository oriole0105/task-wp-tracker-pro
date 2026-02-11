import React, { useState } from 'react';
import { 
  Box, Typography, Button, TextField, Paper, 
  List, ListItem, ListItemText, IconButton, Alert,
  Grid, Card, CardContent
} from '@mui/material';
import { Delete, Edit, Add, Download, Upload, Save, Cancel, Backup, Restore } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import type { CategoryData } from '../types';

export const CategoryManager: React.FC = () => {
  const { 
    tasks, mainCategories, subCategories, 
    addMainCategory, updateMainCategory, deleteMainCategory,
    addSubCategory, updateSubCategory, deleteSubCategory,
    importCategories, importFullData
  } = useTaskStore();

  const [newMain, setNewMain] = useState('');
  const [newSub, setNewSub] = useState('');
  const [editing, setEditing] = useState<{ type: 'main' | 'sub', oldName: string, newName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFullExport = () => {
    const data = { tasks, mainCategories, subCategories };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    setSuccess('全系統資料匯出成功。');
  };

  const handleFullImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (Array.isArray(parsed.tasks) && Array.isArray(parsed.mainCategories)) {
            if (window.confirm('警告：這將覆蓋目前所有的任務與分類設定。確定要執行嗎？')) {
                importFullData(parsed);
                setSuccess('全系統資料還原成功。');
                setError(null);
            }
          } else {
            throw new Error('無效的備份檔案格式。');
          }
        } catch (err: any) {
          setError(`匯入失敗: ${err.message}`);
          setSuccess(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCategoryExport = () => {
    const data: CategoryData = { mainCategories, subCategories };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'categories.json';
    link.click();
  };

  const handleCategoryImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed.mainCategories && parsed.subCategories) {
            importCategories(parsed);
            setSuccess('分類資料匯入成功。');
            setError(null);
          } else {
            throw new Error('無效的 JSON 格式');
          }
        } catch (err) {
          setError('匯入失敗：無效的 JSON 結構');
        }
      };
      reader.readAsText(file);
    }
  };

  const startEdit = (type: 'main' | 'sub', name: string) => {
    setEditing({ type, oldName: name, newName: name });
  };

  const saveEdit = () => {
    if (!editing || !editing.newName.trim()) return;
    if (editing.type === 'main') {
      updateMainCategory(editing.oldName, editing.newName.trim());
    } else {
      updateSubCategory(editing.oldName, editing.newName.trim());
    }
    setEditing(null);
  };

  const renderCategoryList = (type: 'main' | 'sub', list: string[], addFn: (n: string) => void, deleteFn: (n: string) => void, inputVal: string, setInputVal: (v: string) => void) => (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom color="primary">
          {type === 'main' ? '任務分類' : '時間分類'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={`新增${type === 'main' ? '任務' : '時間'}分類...`}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (addFn(inputVal), setInputVal(''))}
          />
          <Button variant="contained" onClick={() => { addFn(inputVal); setInputVal(''); }} disabled={!inputVal.trim()}>
            <Add />
          </Button>
        </Box>
        <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
          {list.map((name) => (
            <ListItem
              key={name}
              secondaryAction={
                editing?.type === type && editing?.oldName === name ? (
                  <Box>
                    <IconButton size="small" onClick={saveEdit} color="success"><Save fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setEditing(null)}><Cancel fontSize="small" /></IconButton>
                  </Box>
                ) : (
                  <Box>
                    <IconButton size="small" onClick={() => startEdit(type, name)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => deleteFn(name)}><Delete fontSize="small" /></IconButton>
                  </Box>
                )
              }
            >
              {editing?.type === type && editing?.oldName === name ? (
                <TextField
                  size="small"
                  value={editing.newName}
                  onChange={(e) => setEditing({ ...editing, newName: e.target.value })}
                  autoFocus
                  fullWidth
                />
              ) : (
                <ListItemText primary={name} />
              )}
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ width: '100%', mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>系統設定</Typography>

      <Paper sx={{ p: 3, mb: 4, border: '1px solid #ddd', bgcolor: '#fcfcfc' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Backup color="primary" /> 系統資料備份與還原
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
            匯出所有的任務、時間紀錄、分類與工作產出至單一 JSON 檔案。可用於在不同裝置間同步或定期備份。
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" startIcon={<Download />} onClick={handleFullExport} color="primary">
            匯出完整資料
          </Button>
          <Button variant="outlined" component="label" startIcon={<Restore />} color="warning">
            還原備份資料
            <input type="file" hidden accept=".json" onChange={handleFullImport} />
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 4 }}>
        <Typography variant="h5">分類管理</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button size="small" variant="text" startIcon={<Download />} onClick={handleCategoryExport}>僅匯出分類</Button>
          <Button size="small" variant="text" component="label" startIcon={<Upload />}>
            僅匯入分類
            <input type="file" hidden accept=".json" onChange={handleCategoryImport} />
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderCategoryList('main', mainCategories, addMainCategory, deleteMainCategory, newMain, setNewMain)}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderCategoryList('sub', subCategories, addSubCategory, deleteSubCategory, newSub, setNewSub)}
        </Grid>
      </Grid>
      
      <Paper sx={{ p: 2, mt: 4, bgcolor: '#fff3e0' }}>
        <Typography variant="subtitle2" color="warning.dark">
          註：修改或刪除分類將會同步更新所有已使用該分類的現有任務。
        </Typography>
      </Paper>
    </Box>
  );
};
