import React, { useState } from 'react';
import {
  Box, Typography, Button, TextField, Paper,
  List, ListItem, ListItemText, IconButton, Alert,
  Grid, Card, CardContent, Chip, Checkbox, FormControlLabel, Divider,
} from '@mui/material';
import { Delete, Edit, Add, Download, Save, Cancel, Backup, Restore, BeachAccess, Tune, Person } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { useTaskStore } from '../store/useTaskStore';

export const CategoryManager: React.FC = () => {
  const {
    tasks, timeslots, mainCategories, subCategories, outputTypes, holidays, members,
    addMainCategory, updateMainCategory, deleteMainCategory,
    addSubCategory, updateSubCategory, deleteSubCategory,
    addOutputType, updateOutputType, deleteOutputType,
    addHoliday, deleteHoliday,
    addMember, updateMember, deleteMember,
    importFullData, importSettings,
  } = useTaskStore();

  const [newMain, setNewMain] = useState('');
  const [newSub, setNewSub] = useState('');
  const [editing, setEditing] = useState<{ type: 'main' | 'sub', oldName: string, newName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Holiday state
  const [newHolidayDate, setNewHolidayDate] = useState<Date | null>(null);

  // OutputType state
  const [newOtName, setNewOtName] = useState('');
  const [newOtIsTangible, setNewOtIsTangible] = useState(true);
  const [editingOt, setEditingOt] = useState<{ id: string; name: string; isTangible: boolean } | null>(null);

  // Member state
  const [newMemberName, setNewMemberName] = useState('');
  const [selfNameInput, setSelfNameInput] = useState<string | null>(null); // null = not editing

  const handleFullExport = () => {
    const data = { tasks, timeslots, mainCategories, subCategories, outputTypes, holidays, members };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    setSuccess('全系統資料匯出成功。');
  };

  const handleSettingsExport = () => {
    const data = { mainCategories, subCategories, outputTypes, holidays, members };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task_tracker_settings_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    setSuccess('設定匯出成功。');
  };

  const handleSettingsImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed.mainCategories || parsed.subCategories || parsed.members) {
            if (window.confirm('這將覆蓋目前的分類、產出類型、假日與人員名單設定（不影響任務資料）。確定要執行嗎？')) {
              importSettings(parsed);
              setSuccess('設定匯入成功。');
              setError(null);
            }
          } else {
            throw new Error('無效的設定檔格式。');
          }
        } catch (err: any) {
          setError(`匯入失敗: ${err.message}`);
          setSuccess(null);
        }
      };
      reader.readAsText(file);
    }
    event.target.value = '';
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

      <Paper sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
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

      <Paper sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tune color="primary" /> 設定備份與還原
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          匯出分類、工作產出類型、假日與人員名單。不含任務與時間紀錄資料。
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" startIcon={<Download />} onClick={handleSettingsExport} color="secondary">
            匯出設定
          </Button>
          <Button variant="outlined" component="label" startIcon={<Restore />} color="secondary">
            匯入設定
            <input type="file" hidden accept=".json" onChange={handleSettingsImport} />
          </Button>
        </Box>
      </Paper>

      <Typography variant="h5" sx={{ mb: 2, mt: 4 }}>分類管理</Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderCategoryList('main', mainCategories, addMainCategory, deleteMainCategory, newMain, setNewMain)}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderCategoryList('sub', subCategories, addSubCategory, deleteSubCategory, newSub, setNewSub)}
        </Grid>
      </Grid>

      {/* OutputType Management */}
      <Typography variant="h5" sx={{ mt: 5, mb: 2 }}>工作產出類型</Typography>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            定義工作產出的類型，並標記是否為「有形產出」（有形 → 記錄連結；無形 → 記錄說明/摘要）。
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="新增產出類型名稱..."
              value={newOtName}
              onChange={(e) => setNewOtName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newOtName.trim()) {
                  addOutputType({ name: newOtName.trim(), isTangible: newOtIsTangible });
                  setNewOtName('');
                }
              }}
              sx={{ minWidth: 200 }}
            />
            <FormControlLabel
              control={<Checkbox size="small" checked={newOtIsTangible} onChange={(e) => setNewOtIsTangible(e.target.checked)} />}
              label={<Typography variant="body2">有形產出</Typography>}
            />
            <Button
              variant="contained"
              onClick={() => {
                if (newOtName.trim()) {
                  addOutputType({ name: newOtName.trim(), isTangible: newOtIsTangible });
                  setNewOtName('');
                }
              }}
              disabled={!newOtName.trim()}
            >
              <Add />
            </Button>
          </Box>
          <Divider sx={{ my: 1 }} />
          <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
            {outputTypes.map((ot) => (
              <ListItem
                key={ot.id}
                secondaryAction={
                  editingOt?.id === ot.id ? (
                    <Box>
                      <IconButton size="small" color="success" onClick={() => {
                        if (editingOt.name.trim()) {
                          updateOutputType(ot.id, { name: editingOt.name.trim(), isTangible: editingOt.isTangible });
                        }
                        setEditingOt(null);
                      }}><Save fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => setEditingOt(null)}><Cancel fontSize="small" /></IconButton>
                    </Box>
                  ) : (
                    <Box>
                      <IconButton size="small" onClick={() => setEditingOt({ id: ot.id, name: ot.name, isTangible: ot.isTangible })}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteOutputType(ot.id)}><Delete fontSize="small" /></IconButton>
                    </Box>
                  )
                }
              >
                {editingOt?.id === ot.id ? (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%', mr: 10 }}>
                    <TextField
                      size="small"
                      value={editingOt.name}
                      onChange={(e) => setEditingOt({ ...editingOt, name: e.target.value })}
                      autoFocus
                    />
                    <FormControlLabel
                      control={<Checkbox size="small" checked={editingOt.isTangible} onChange={(e) => setEditingOt({ ...editingOt, isTangible: e.target.checked })} />}
                      label={<Typography variant="body2">有形</Typography>}
                    />
                  </Box>
                ) : (
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {ot.name}
                        <Chip
                          label={ot.isTangible ? '有形' : '無形'}
                          size="small"
                          color={ot.isTangible ? 'primary' : 'secondary'}
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                )}
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
      
      {/* Holiday Management */}
      <Typography variant="h5" sx={{ mt: 5, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <BeachAccess /> 假日 / 個人休息日
      </Typography>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            設定假日或個人休息日。這些日期在甘特圖中會以淺藍色標示，方便辨識非上班日。
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <DatePicker
              label="選擇日期"
              value={newHolidayDate}
              onChange={setNewHolidayDate}
              slotProps={{ textField: { size: 'small' } }}
            />
            <Button
              variant="contained"
              startIcon={<Add />}
              disabled={!newHolidayDate}
              onClick={() => {
                if (newHolidayDate) {
                  addHoliday(format(newHolidayDate, 'yyyy-MM-dd'));
                  setNewHolidayDate(null);
                }
              }}
            >
              加入
            </Button>
          </Box>
          <Divider sx={{ my: 1 }} />
          {holidays.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              尚未設定任何假日
            </Typography>
          ) : (
            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
              {holidays.map(date => (
                <ListItem
                  key={date}
                  secondaryAction={
                    <IconButton size="small" color="error" onClick={() => deleteHoliday(date)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText primary={date} />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Member Management */}
      <Typography variant="h5" sx={{ mt: 5, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Person /> 人員名單
      </Typography>
      <Card variant="outlined">
        <CardContent>
          {/* 我的名字 */}
          <Typography variant="subtitle1" gutterBottom color="text.secondary">
            我的名字（用於預設負責人）
          </Typography>
          {(() => {
            const selfMember = members.find(m => m.isSelf);
            const selfName = selfMember?.name || '';
            const isEditing = selfNameInput !== null;
            return (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
                <TextField
                  size="small"
                  placeholder="輸入你的名字..."
                  value={isEditing ? selfNameInput : selfName}
                  onChange={(e) => setSelfNameInput(e.target.value)}
                  onFocus={() => setSelfNameInput(selfName)}
                  helperText={!selfName ? '設定後，新建任務的負責人欄位將自動填入' : ''}
                  sx={{ minWidth: 200 }}
                />
                {isEditing && (
                  <>
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => {
                        if (selfNameInput !== null) updateMember('self', selfNameInput);
                        setSelfNameInput(null);
                      }}
                    >
                      <Save fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setSelfNameInput(null)}>
                      <Cancel fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            );
          })()}

          <Divider sx={{ my: 2 }} />

          {/* 成員清單 */}
          <Typography variant="subtitle1" gutterBottom color="text.secondary">成員清單</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="新增成員名稱..."
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newMemberName.trim()) {
                  addMember(newMemberName.trim());
                  setNewMemberName('');
                }
              }}
              sx={{ minWidth: 200 }}
            />
            <Button
              variant="contained"
              onClick={() => {
                if (newMemberName.trim()) {
                  addMember(newMemberName.trim());
                  setNewMemberName('');
                }
              }}
              disabled={!newMemberName.trim()}
            >
              <Add />
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {members.filter(m => !m.isSelf).map(m => (
              <Chip
                key={m.id}
                label={m.name}
                onDelete={() => deleteMember(m.id)}
                deleteIcon={<Delete />}
              />
            ))}
            {members.filter(m => !m.isSelf).length === 0 && (
              <Typography variant="body2" color="text.secondary">尚未新增任何成員</Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      <Paper sx={{ p: 2, mt: 4, bgcolor: 'warning.dark' }}>
        <Typography variant="subtitle2" sx={{ color: 'warning.contrastText' }}>
          註：修改或刪除分類將會同步更新所有已使用該分類的現有任務。
        </Typography>
      </Paper>
    </Box>
  );
};
