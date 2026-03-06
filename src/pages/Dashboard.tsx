import React from 'react';
import { TimeTracker } from '../components/TimeTracker';
import { Typography, Box } from '@mui/material';

const Dashboard: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>排程視圖</Typography>
      <TimeTracker />
    </Box>
  );
};

export default Dashboard;
