import React from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Button, IconButton, Tooltip } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import {
  Dashboard, ListAlt, PieChart, Settings, AssignmentTurnedIn, Description,
  DarkMode, LightMode, Undo, Inventory,
} from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';

export const Layout: React.FC = () => {
  const { darkMode, toggleDarkMode, undo, _history } = useTaskStore();
  const canUndo = _history.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            WorkScope Planner
          </Typography>
          <Button color="inherit" component={RouterLink} to="/tasks" startIcon={<ListAlt />}>
            任務管理
          </Button>
          <Button color="inherit" component={RouterLink} to="/outputs" startIcon={<AssignmentTurnedIn />}>
            工作產出
          </Button>
          <Button color="inherit" component={RouterLink} to="/" startIcon={<Dashboard />}>
            排程視圖
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
      <Container component="main" maxWidth={false} sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
};
