import React from 'react';
import { Alert } from '@mui/material';
import { useTaskStore } from '../store/useTaskStore';

export const OfflineBanner: React.FC = () => {
  const offline = useTaskStore(s => s._offline);
  if (!offline) return null;
  return (
    <Alert severity="warning" sx={{ borderRadius: 0 }}>
      伺服器離線，目前為唯讀模式。請啟動 server 後重新整理頁面。
    </Alert>
  );
};
