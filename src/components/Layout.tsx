import React from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Button } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, ListTodo, PieChart, Settings } from 'lucide-react';

export const Layout: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Task Time Tracker
          </Typography>
          <Button color="inherit" component={RouterLink} to="/" startIcon={<LayoutDashboard size={18} />}>
            Dashboard
          </Button>
          <Button color="inherit" component={RouterLink} to="/tasks" startIcon={<ListTodo size={18} />}>
            Tasks
          </Button>
          <Button color="inherit" component={RouterLink} to="/outputs" startIcon={<ListTodo size={18} />}>
            Outputs
          </Button>
          <Button color="inherit" component={RouterLink} to="/reports" startIcon={<PieChart size={18} />}>
            Reports
          </Button>
          <Button color="inherit" component={RouterLink} to="/settings" startIcon={<Settings size={18} />}>
            Settings
          </Button>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth={false} sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
};
