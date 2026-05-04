import React, { useState } from 'react';
import {
  Alert, Box, Button, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '@mui/material';
import { useTaskStore } from '../store/useTaskStore';

interface Props {
  onComplete: () => Promise<void>;
}

export const MigrationWizard: React.FC<Props> = ({ onComplete }) => {
  const bootstrapRequired = useTaskStore(s => s._bootstrapRequired);
  const setBootstrapRequired = useTaskStore(s => s._setBootstrapRequired);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!bootstrapRequired) return null;

  const doMigrate = async (migrateFromLocalStorage: boolean) => {
    setBusy(true);
    setErrorMsg('');
    try {
      let state: Record<string, unknown> = {};
      if (migrateFromLocalStorage) {
        const raw = localStorage.getItem('task-storage');
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') {
          const p = parsed as Record<string, unknown>;
          state = (p.state && typeof p.state === 'object')
            ? (p.state as Record<string, unknown>)
            : p;
        }
      }

      const res = await fetch('/system/import-localstorage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      const json = await res.json() as { ok?: boolean; error?: { code?: string; message?: string } };

      if (!res.ok && json.error?.code !== 'ALREADY_BOOTSTRAPPED') {
        throw new Error(json.error?.message ?? '操作失敗');
      }

      await onComplete();
      setBootstrapRequired(false);
      setDone(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '未知錯誤');
    } finally {
      setBusy(false);
    }
  };

  const hasLocalStorage = !!localStorage.getItem('task-storage');

  return (
    <Dialog open disableEscapeKeyDown maxWidth="sm" fullWidth>
      <DialogTitle>初始化資料</DialogTitle>
      <DialogContent>
        {done ? (
          <Alert severity="success">初始化完成！</Alert>
        ) : busy ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <DialogContentText>
              偵測到 Server 尚未有資料。
              {hasLocalStorage
                ? '發現瀏覽器中的舊資料，是否要遷移到 Server？'
                : '請選擇初始化方式。'}
            </DialogContentText>
            {errorMsg && <Alert severity="error" sx={{ mt: 1 }}>{errorMsg}</Alert>}
          </>
        )}
      </DialogContent>
      {!done && !busy && (
        <DialogActions>
          {hasLocalStorage && (
            <Button onClick={() => void doMigrate(true)} variant="contained">
              遷移舊資料
            </Button>
          )}
          <Button
            onClick={() => void doMigrate(false)}
            variant={hasLocalStorage ? 'outlined' : 'contained'}
          >
            {hasLocalStorage ? '不，從頭開始' : '建立新資料'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
