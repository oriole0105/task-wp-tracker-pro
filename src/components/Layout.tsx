import React from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Button } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import { Dashboard, ListAlt, PieChart, Settings, AssignmentTurnedIn } from '@mui/icons-material';

export const Layout: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Task Time Tracker
          </Typography>
          <Button color="inherit" component={RouterLink} to="/" startIcon={<Dashboard />}>
            儀表板
          </Button>
          <Button color="inherit" component={RouterLink} to="/tasks" startIcon={<ListAlt />}>
            任務管理
          </Button>
          <Button color="inherit" component={RouterLink} to="/outputs" startIcon={<AssignmentTurnedIn />}>
            工作產出
          </Button>
          <Button color="inherit" component={RouterLink} to="/reports" startIcon={<PieChart />}>
            統計報表
          </Button>
          <Button color="inherit" component={RouterLink} to="/settings" startIcon={<Settings />}>
            系統設定
          </Button>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth={false} sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
};
