import React, { useState } from 'react';
import { TaskList } from '../components/TaskList';
import { Typography, Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { Group, Person } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';

const TasksPage: React.FC = () => {
  const { currentUser } = useTaskStore();
  const [workspace, setWorkspace] = useState<'shared' | 'personal'>('shared');

  // 只有雲端多人模式（有 currentUser 且不是 local-admin）才顯示切換器
  const showToggle = !!currentUser && currentUser.id !== 'local-admin';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Tasks</Typography>
        {showToggle && (
          <ToggleButtonGroup
            value={workspace}
            exclusive
            onChange={(_, v) => { if (v) setWorkspace(v); }}
            size="small"
          >
            <ToggleButton value="shared">
              <Group fontSize="small" sx={{ mr: 0.5 }} />共用工作區
            </ToggleButton>
            <ToggleButton value="personal">
              <Person fontSize="small" sx={{ mr: 0.5 }} />個人工作區
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>
      <TaskList
        workspaceFilter={showToggle ? workspace : undefined}
        currentUserId={currentUser?.id}
      />
    </Box>
  );
};

export default TasksPage;
