import React, { useEffect, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Container, Box, Button, IconButton, Tooltip, Snackbar, Alert,
  useTheme, useMediaQuery,
} from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import {
  Dashboard, ListAlt, PieChart, Settings, AssignmentTurnedIn, Description,
  DarkMode, LightMode, Undo, Inventory, HelpOutline,
} from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import { MobileBottomNav } from './MobileBottomNav';

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: '待規劃', TODO: '待處理', IN_PROGRESS: '進行中',
  PAUSED: '已暫停', DONE: '已完成', CANCELLED: '已取消',
};

export const Layout: React.FC = () => {
  const { darkMode, toggleDarkMode, undo, _history, _lastAutoStatusChange, clearLastAutoStatusChange } = useTaskStore();
  const canUndo = _history.length > 0;
  const [toastMsg, setToastMsg] = useState('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (_lastAutoStatusChange) {
      const label = STATUS_LABELS[_lastAutoStatusChange.newStatus] ?? _lastAutoStatusChange.newStatus;
      setToastMsg(`「${_lastAutoStatusChange.taskTitle}」已自動更新為 ${label}`);
      clearLastAutoStatusChange();
    }
  }, [_lastAutoStatusChange, clearLastAutoStatusChange]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop: full AppBar */}
      {!isMobile && (
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              WorkScope Planner
            </Typography>
            <Button color="inherit" component={RouterLink} to="/tasks" startIcon={<ListAlt />}>
              任務管理
            </Button>
            <Button color="inherit" component={RouterLink} to="/" startIcon={<Dashboard />}>
              排程視圖
            </Button>
            <Button color="inherit" component={RouterLink} to="/outputs" startIcon={<AssignmentTurnedIn />}>
              工作產出
            </Button>
            <Button color="inherit" component={RouterLink} to="/reports" startIcon={<PieChart />}>
              統計報表
            </Button>
            <Button color="inherit" component={RouterLink} to="/weekly" startIcon={<Description />}>
              週報生成
            </Button>
            <Button color="inherit" component={RouterLink} to="/archive" startIcon={<Inventory />}>
              封存庫
            </Button>
            <Button color="inherit" component={RouterLink} to="/settings" startIcon={<Settings />}>
              系統設定
            </Button>

            <Tooltip title="使用者手冊">
              <IconButton color="inherit" component={RouterLink} to="/help">
                <HelpOutline />
              </IconButton>
            </Tooltip>

            <Tooltip title={canUndo ? '復原上一步 (Undo)' : '沒有可復原的操作'}>
              <span>
                <IconButton color="inherit" onClick={undo} disabled={!canUndo}>
                  <Undo />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title={darkMode ? '切換亮色模式' : '切換深色模式'}>
              <IconButton color="inherit" onClick={toggleDarkMode}>
                {darkMode ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>
      )}

      {/* Mobile: compact top bar */}
      {isMobile && (
        <AppBar position="static" sx={{ minHeight: 48 }}>
          <Toolbar variant="dense" sx={{ minHeight: 48 }}>
            <Typography variant="subtitle1" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
              WorkScope Planner
            </Typography>
            <Tooltip title={canUndo ? '復原' : '沒有可復原的操作'}>
              <span>
                <IconButton color="inherit" size="small" onClick={undo} disabled={!canUndo}>
                  <Undo fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton color="inherit" size="small" onClick={toggleDarkMode}>
              {darkMode ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      <Container
        component="main"
        maxWidth={false}
        sx={{ mt: isMobile ? 1 : 4, mb: isMobile ? '80px' : 4, px: isMobile ? 1 : 3, flexGrow: 1 }}
      >
        <Outlet />
      </Container>

      {/* Mobile: bottom navigation */}
      {isMobile && <MobileBottomNav />}

      <Snackbar
        open={!!toastMsg}
        autoHideDuration={4000}
        onClose={() => setToastMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={isMobile ? { bottom: 72 } : undefined}
      >
        <Alert severity="info" variant="filled" onClose={() => setToastMsg('')}>{toastMsg}</Alert>
      </Snackbar>
    </Box>
  );
};
