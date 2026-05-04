import React from 'react';
import { TaskList } from '../components/TaskList';
import { Typography, Box } from '@mui/material';

const TasksPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Tasks</Typography>
      <TaskList />
    </Box>
  );
};

export default TasksPage;
