import React from 'react';
import { Stats } from '../components/Stats';
import { Typography, Box } from '@mui/material';

const ReportsPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Reports</Typography>
      <Stats />
    </Box>
  );
};

export default ReportsPage;
