import React, { useState } from 'react';
import {
  BottomNavigation, BottomNavigationAction, Paper, Fab, Menu, MenuItem,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box,
} from '@mui/material';
import {
  Dashboard, ListAlt, Add, AssignmentTurnedIn, MoreHoriz,
  PieChart, Description, Inventory, Settings, HelpOutline, CheckBox, Timeline,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTaskStore } from '../store/useTaskStore';

const NAV_ROUTES = ['/tasks', '/', '__fab__', '/todos', '__more__'];

const MORE_ITEMS = [
  { label: '事件時間軸', icon: <Timeline />, path: '/task-timeline' },
  { label: '產出管理', icon: <AssignmentTurnedIn />, path: '/outputs' },
  { label: '統計報表', icon: <PieChart />, path: '/reports' },
  { label: '週報生成', icon: <Description />, path: '/weekly' },
  { label: '封存庫', icon: <Inventory />, path: '/archive' },
  { label: '系統設定', icon: <Settings />, path: '/settings' },
  { label: '說明', icon: <HelpOutline />, path: '/help' },
];

function pathToNav(pathname: string): number {
  if (pathname === '/tasks') return 0;
  if (pathname === '/') return 1;
  if (pathname === '/todos') return 3;
  // "更多" pages
  if (['/task-timeline', '/outputs', '/reports', '/weekly', '/archive', '/settings', '/help'].includes(pathname)) return 4;
  return 0;
}

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setQuickAddAction = useTaskStore(s => s.setQuickAddAction);

  const [fabAnchor, setFabAnchor] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navValue = pathToNav(location.pathname);

  const handleNavChange = (_: React.SyntheticEvent, newValue: number) => {
    const route = NAV_ROUTES[newValue];
    if (route === '__fab__') return; // handled by FAB
    if (route === '__more__') {
      setDrawerOpen(true);
      return;
    }
    navigate(route);
  };

  const handleFabClick = (e: React.MouseEvent<HTMLElement>) => {
    setFabAnchor(e.currentTarget);
  };

  const handleQuickAdd = (action: 'task' | 'timeslot') => {
    setFabAnchor(null);
    setQuickAddAction(action);
    if (action === 'task' && location.pathname !== '/tasks') {
      navigate('/tasks');
    } else if (action === 'timeslot' && location.pathname !== '/') {
      navigate('/');
    }
  };

  const handleMoreNav = (path: string) => {
    setDrawerOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <Paper
        sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200 }}
        elevation={3}
      >
        <BottomNavigation value={navValue} onChange={handleNavChange} showLabels>
          <BottomNavigationAction label="任務" icon={<ListAlt />} />
          <BottomNavigationAction label="時間軸" icon={<Dashboard />} />
          {/* Placeholder for FAB */}
          <BottomNavigationAction
            label=""
            icon={<Box sx={{ width: 40 }} />}
            sx={{ pointerEvents: 'none', minWidth: 56 }}
          />
          <BottomNavigationAction label="待辦事項" icon={<CheckBox />} />
          <BottomNavigationAction label="更多" icon={<MoreHoriz />} />
        </BottomNavigation>

        {/* Floating "＋" button */}
        <Fab
          color="primary"
          size="medium"
          onClick={handleFabClick}
          sx={{
            position: 'absolute',
            top: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1,
          }}
        >
          <Add />
        </Fab>
      </Paper>

      {/* Quick Add Menu */}
      <Menu
        anchorEl={fabAnchor}
        open={Boolean(fabAnchor)}
        onClose={() => setFabAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MenuItem onClick={() => handleQuickAdd('timeslot')}>新增時段</MenuItem>
        <MenuItem onClick={() => handleQuickAdd('task')}>新增任務</MenuItem>
      </Menu>

      {/* "更多" Drawer */}
      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <List sx={{ pb: 2 }}>
          {MORE_ITEMS.map(item => (
            <ListItemButton
              key={item.path}
              onClick={() => handleMoreNav(item.path)}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
    </>
  );
};
