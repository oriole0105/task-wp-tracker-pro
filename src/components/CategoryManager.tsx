import React, { useState, useRef, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Paper,
  List, ListItem, ListItemText, IconButton, Alert,
  Grid, Card, CardContent, Chip, Checkbox, FormControlLabel, Divider,
  Collapse, Autocomplete, Switch, FormGroup,
} from '@mui/material';
import { Delete, Edit, Add, Download, Save, Cancel, Backup, Restore, BeachAccess, Tune, Person, MergeType, PhoneAndroid, ExpandMore, ExpandLess, HelpOutline, QrCode, QrCodeScanner, AssignmentReturn } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { useTaskStore } from '../store/useTaskStore';
import { computeTaskWbsMap } from '../utils/wbs';
import { SettingsQrDialog } from './SettingsQrDialog';

export const CategoryManager: React.FC = () => {
  const {
    tasks, timeslots, mainCategories, subCategories, outputTypes, holidays, members,
    preventDuplicateTaskNames, togglePreventDuplicateTaskNames,
    addMainCategory, updateMainCategory, deleteMainCategory,
    addSubCategory, updateSubCategory, deleteSubCategory,
    addOutputType, updateOutputType, deleteOutputType,
    addHoliday, deleteHoliday,
    addMember, updateMember, deleteMember,
    importFullData, importSettings, mergeImport,
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

  // 設定 QR Code 對話框
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrDialogMode, setQrDialogMode] = useState<'show' | 'scan'>('show');
  const currentSettings = { mainCategories, subCategories, outputTypes, holidays, members };

  // 手機端優先用 Web Share API 丟給其他 app；桌機 fallback 為一般下載
  const shareOrDownload = async (blob: Blob, filename: string): Promise<boolean> => {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return true;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return false; // 使用者取消，不顯示成功
        // 其他錯誤（瀏覽器限制等）fallthrough 改走下載
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  };

  const handleFullExport = async () => {
    const data = { tasks, timeslots, mainCategories, subCategories, outputTypes, holidays, members };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const filename = `task_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    if (await shareOrDownload(blob, filename)) setSuccess('全系統資料匯出成功。');
  };

  const handleSettingsExport = async () => {
    const data = { mainCategories, subCategories, outputTypes, holidays, members };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const filename = `task_tracker_settings_${new Date().toISOString().split('T')[0]}.json`;
    if (await shareOrDownload(blob, filename)) setSuccess('設定匯出成功。');
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


  // 跨裝置說明展開狀態
  const [syncGuideOpen, setSyncGuideOpen] = useState(false);

  // 差異匯出：匯出近 N 天新建或修改的 tasks + timeslots
  const [deltaExportDays, setDeltaExportDays] = useState(7);
  const [deltaParentTaskId, setDeltaParentTaskId] = useState<string | null>(null);
  const [delegationRootTaskId, setDelegationRootTaskId] = useState<string | null>(null);
  const delegationFileRef = useRef<HTMLInputElement>(null);
  const [delegationGuideOpen, setDelegationGuideOpen] = useState(false);

  // 供父節點選單使用：非封存任務依 WBS 排序
  const { wbsNumbers: deltaWbsNumbers, sorted: deltaSortedTasks } = useMemo(
    () => computeTaskWbsMap(tasks.filter(t => !t.archived)),
    [tasks]
  );

  const handleDeltaExport = async () => {
    let deltaTasks: typeof tasks;
    let deltaTimeslots: typeof timeslots;

    const since = Date.now() - deltaExportDays * 24 * 60 * 60 * 1000;

    if (deltaParentTaskId) {
      // 遞迴收集指定父節點及所有子孫任務
      const subtreeIds = new Set<string>();
      const collect = (id: string) => {
        subtreeIds.add(id);
        tasks.filter(t => t.parentId === id).forEach(c => collect(c.id));
      };
      collect(deltaParentTaskId);
      deltaTasks = tasks.filter(t =>
        subtreeIds.has(t.id) && ((t.createdAt ?? 0) >= since || (t.updatedAt ?? 0) >= since)
      );
      deltaTimeslots = timeslots.filter(ts =>
        ts.taskId != null && subtreeIds.has(ts.taskId) &&
        ((ts.createdAt ?? 0) >= since || (ts.updatedAt ?? 0) >= since)
      );
    } else {
      deltaTasks = tasks.filter(t => (t.createdAt ?? 0) >= since || (t.updatedAt ?? 0) >= since);
      deltaTimeslots = timeslots.filter(ts => (ts.createdAt ?? 0) >= since || (ts.updatedAt ?? 0) >= since);
    }

    if (deltaTasks.length === 0 && deltaTimeslots.length === 0) {
      setError(
        deltaParentTaskId
          ? '指定節點下沒有任何任務或時段資料。'
          : `過去 ${deltaExportDays} 天內沒有新增或修改的資料。`
      );
      return;
    }
    const data = {
      tasks: deltaTasks,
      timeslots: deltaTimeslots,
      exportedAt: Date.now(),
      ...(deltaParentTaskId ? { parentTaskId: deltaParentTaskId } : { deltaDays: deltaExportDays }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const filename = `task_tracker_delta_${new Date().toISOString().split('T')[0]}.json`;
    if (await shareOrDownload(blob, filename))
      setSuccess(`差異匯出成功：${deltaTasks.length} 筆任務、${deltaTimeslots.length} 筆時段。`);
  };

  const handleDelegationExport = async () => {
    if (!delegationRootTaskId) {
      setError('請先選擇要交辦的根節點任務。');
      return;
    }
    const subtreeIds = new Set<string>();
    const collect = (id: string) => {
      subtreeIds.add(id);
      tasks.filter(t => t.parentId === id).forEach(c => collect(c.id));
    };
    collect(delegationRootTaskId);
    const delegationTasks = tasks.filter(t => subtreeIds.has(t.id));
    const data = {
      tasks: delegationTasks,
      exportedAt: Date.now(),
      delegationRootTaskId,
      exportType: 'delegation',
    };
    const rootTitle = tasks.find(t => t.id === delegationRootTaskId)?.title ?? 'task';
    const safeName = rootTitle.replace(/[^\w\u4e00-\u9fff]/g, '_').slice(0, 30);
    const filename = `task_delegation_${safeName}_${new Date().toISOString().split('T')[0]}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    if (await shareOrDownload(blob, filename)) {
      setSuccess(`任務交辦匯出成功：共 ${delegationTasks.length} 筆任務（含子孫）。不含個人時間紀錄。`);
      setError(null);
    }
  };

  const handleDelegationImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!Array.isArray(parsed.tasks)) {
          throw new Error('JSON 檔案中未找到 tasks 陣列，請確認是否為正確的任務交辦檔。');
        }
        const taskCount = parsed.tasks.length;
        if (!window.confirm(
          `即將匯入 ${taskCount} 筆任務（含工作產出）。\n同 ID 任務以較新版本覆蓋，新任務直接加入。\n個人時間紀錄不受影響。\n\n確定執行嗎？`
        )) return;
        const stats = mergeImport({ tasks: parsed.tasks, timeslots: [] });
        setSuccess(`任務交辦匯入完成：新增 ${stats.tasksAdded} 筆，更新 ${stats.tasksUpdated} 筆。時間紀錄未變動。`);
        setError(null);
      } catch (err: any) {
        setError(`任務交辦匯入失敗: ${err.message}`);
        setSuccess(null);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // 智慧合併匯入
  const mergeFileRef = useRef<HTMLInputElement>(null);
  const handleMergeImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const incoming = { tasks: parsed.tasks, timeslots: parsed.timeslots };
        if (!Array.isArray(incoming.tasks) && !Array.isArray(incoming.timeslots)) {
          throw new Error('JSON 檔案中未找到 tasks 或 timeslots 陣列。');
        }
        const taskCount = incoming.tasks?.length ?? 0;
        const tsCount = incoming.timeslots?.length ?? 0;
        if (!window.confirm(`即將合併匯入 ${taskCount} 筆任務、${tsCount} 筆時段。\n\n同 ID 資料將以較新版本覆蓋，新 ID 資料將直接加入。確定要執行嗎？`)) return;
        const stats = mergeImport(incoming);
        setSuccess(`合併匯入完成：新增 ${stats.tasksAdded} 筆任務 + ${stats.timeslotsAdded} 筆時段，更新 ${stats.tasksUpdated} 筆任務 + ${stats.timeslotsUpdated} 筆時段。`);
        setError(null);
      } catch (err: any) {
        setError(`合併匯入失敗: ${err.message}`);
        setSuccess(null);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
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
          <Tune color="primary" /> 行為設定
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={preventDuplicateTaskNames}
                onChange={togglePreventDuplicateTaskNames}
              />
            }
            label={
              <Box>
                <Typography variant="body2">防止任務同名</Typography>
                <Typography variant="caption" color="text.secondary">
                  複製任務時自動加上流水號後綴（-1、-2…），確保任務名稱唯一，避免 PlantUML 同名節點衝突。
                </Typography>
              </Box>
            }
          />
        </FormGroup>
      </Paper>

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

      <Paper sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PhoneAndroid color="primary" /> 跨裝置資料同步
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          在手機/平板上新增的任務與時段，可匯出差異資料後在電腦端合併匯入。合併時同 ID 資料以較新版本為準，新 ID 資料直接加入。
        </Typography>

        {/* 使用說明（可展開） */}
        <Button
          size="small"
          startIcon={<HelpOutline />}
          endIcon={syncGuideOpen ? <ExpandLess /> : <ExpandMore />}
          onClick={() => setSyncGuideOpen(!syncGuideOpen)}
          sx={{ mb: 1, textTransform: 'none' }}
          color="inherit"
          variant="text"
        >
          如何使用？（點擊展開）
        </Button>
        <Collapse in={syncGuideOpen}>
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              第一次設定手機：
            </Typography>
            <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
              <li>電腦端：系統設定 → <strong>匯出設定</strong> → 下載 settings JSON</li>
              <li>將檔案傳送到手機（AirDrop / LINE / Email / 雲端硬碟）</li>
              <li>手機端：系統設定 → <strong>匯入設定</strong></li>
            </Typography>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 1.5 }}>
              日常使用（手機新增資料後同步回電腦）：
            </Typography>
            <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
              <li>手機上新增任務 / 時段</li>
              <li>手機端：系統設定 → <strong>差異匯出</strong>（匯出近 N 天修改的資料）</li>
              <li>將 delta JSON 傳送到電腦</li>
              <li>電腦端：系統設定 → <strong>合併匯入</strong></li>
            </Typography>
          </Box>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            type="number"
            label="匯出近 N 天"
            value={deltaExportDays}
            onChange={(e) => setDeltaExportDays(Math.max(1, parseInt(e.target.value) || 1))}
            sx={{ width: 120 }}
            slotProps={{ htmlInput: { min: 1 } }}
          />
          <Autocomplete
            size="small"
            options={deltaSortedTasks}
            getOptionLabel={(t) => {
              const wbs = deltaWbsNumbers.get(t.id);
              return wbs ? `${wbs} ${t.title}` : t.title;
            }}
            value={deltaSortedTasks.find(t => t.id === deltaParentTaskId) ?? null}
            onChange={(_, val) => setDeltaParentTaskId(val?.id ?? null)}
            renderInput={(params) => (
              <TextField {...params} label="指定父節點（選填）" placeholder="預設＝全部" />
            )}
            sx={{ minWidth: 260 }}
            clearOnEscape
          />
          <Button variant="contained" startIcon={<Download />} onClick={handleDeltaExport} color="info" sx={{ mt: 0.25 }}>
            差異匯出
          </Button>
          <Button variant="outlined" component="label" startIcon={<MergeType />} color="success" sx={{ mt: 0.25 }}>
            合併匯入
            <input type="file" hidden accept=".json" ref={mergeFileRef} onChange={handleMergeImport} />
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentReturn color="primary" /> 任務交辦工作流
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          用於主管交辦任務給同仁，或同仁回報進度給主管。匯出的 JSON 僅含任務結構與工作產出，不包含個人時間紀錄。
        </Typography>

        <Button
          size="small"
          startIcon={<HelpOutline />}
          endIcon={delegationGuideOpen ? <ExpandLess /> : <ExpandMore />}
          onClick={() => setDelegationGuideOpen(!delegationGuideOpen)}
          sx={{ mb: 1, textTransform: 'none' }}
          color="inherit"
          variant="text"
        >
          如何使用？（點擊展開）
        </Button>
        <Collapse in={delegationGuideOpen}>
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
              主管端（交辦）：
            </Typography>
            <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
              <li>建立任務並填寫需求說明</li>
              <li>在下方選擇此任務為根節點 → 點擊「交辦匯出」→ 將 JSON 傳給同仁</li>
            </Typography>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 1.5 }}>
              同仁端（接收＋執行）：
            </Typography>
            <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
              <li>收到 JSON → 點擊「交辦匯入」</li>
              <li>建立子任務、記錄工作產出</li>
              <li>完成後再次選取根節點 → 點擊「交辦匯出」→ 將 JSON 傳回主管</li>
            </Typography>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 1.5 }}>
              主管端（收報）：
            </Typography>
            <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
              <li>收到 JSON → 點擊「交辦匯入」</li>
            </Typography>
          </Box>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Autocomplete
            size="small"
            options={deltaSortedTasks}
            getOptionLabel={(t) => {
              const wbs = deltaWbsNumbers.get(t.id);
              return wbs ? `${wbs} ${t.title}` : t.title;
            }}
            value={deltaSortedTasks.find(t => t.id === delegationRootTaskId) ?? null}
            onChange={(_, val) => setDelegationRootTaskId(val?.id ?? null)}
            renderInput={(params) => (
              <TextField {...params} label="根節點任務（必填）" placeholder="選擇要交辦的任務" />
            )}
            sx={{ minWidth: 260 }}
            clearOnEscape
          />
          <Button variant="contained" startIcon={<Download />} onClick={handleDelegationExport} color="warning" sx={{ mt: 0.25 }}>
            交辦匯出
          </Button>
          <Button variant="outlined" component="label" startIcon={<MergeType />} color="success" sx={{ mt: 0.25 }}>
            交辦匯入
            <input type="file" hidden accept=".json" ref={delegationFileRef} onChange={handleDelegationImport} />
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
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<Download />} onClick={handleSettingsExport} color="secondary">
            匯出設定
          </Button>
          <Button
            variant="contained"
            startIcon={<QrCode />}
            onClick={() => { setQrDialogMode('show'); setQrDialogOpen(true); }}
            color="secondary"
            sx={{ bgcolor: 'secondary.dark' }}
          >
            顯示 QR Code
          </Button>
          <Button variant="outlined" component="label" startIcon={<Restore />} color="secondary">
            匯入設定
            <input type="file" hidden accept=".json" onChange={handleSettingsImport} />
          </Button>
          <Button
            variant="outlined"
            startIcon={<QrCodeScanner />}
            onClick={() => { setQrDialogMode('scan'); setQrDialogOpen(true); }}
            color="secondary"
          >
            掃描 / 貼上匯入
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

      <SettingsQrDialog
        open={qrDialogOpen}
        onClose={() => setQrDialogOpen(false)}
        mode={qrDialogMode}
        settingsData={qrDialogMode === 'show' ? currentSettings : undefined}
        onImport={(data) => {
          if (window.confirm('這將覆蓋目前的分類、產出類型、假日與人員名單設定（不影響任務資料）。確定要執行嗎？')) {
            importSettings(data as Parameters<typeof importSettings>[0]);
            setError(null);
          }
        }}
        onSuccess={(msg) => { setSuccess(msg); setError(null); }}
      />
    </Box>
  );
};
