import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Download } from '@mui/icons-material';
import { format } from 'date-fns';
import type { ReportType, Period } from '@tt/shared/reports/common';

interface ReportInfoBarProps {
  reportType: ReportType;
  ganttPeriod: Period;
  progressPeriod: Period;
  onExportAsciiDoc: () => void;
}

export const ReportInfoBar: React.FC<ReportInfoBarProps> = ({
  reportType, ganttPeriod, progressPeriod, onExportAsciiDoc,
}) => {
  const reportTypeLabel = reportType === 'weekly' ? '週報' : reportType === 'bimonthly' ? '雙月盤點' : '半年報';
  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: 'action.selected' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography variant="body2" fontWeight="bold" gutterBottom>{reportTypeLabel}</Typography>
          {reportType === 'bimonthly' ? (
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Typography variant="body2">
                <b>工作成果區間：</b>{format(progressPeriod.start, 'yyyy-MM-dd')} ～ {format(progressPeriod.end, 'yyyy-MM-dd')}
              </Typography>
              <Typography variant="body2">
                <b>計畫展望區間：</b>{format(ganttPeriod.start, 'yyyy-MM-dd')} ～ {format(ganttPeriod.end, 'yyyy-MM-dd')}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2">
              <b>統計範圍：</b>{format(ganttPeriod.start, 'yyyy-MM-dd')} ～ {format(ganttPeriod.end, 'yyyy-MM-dd')}
            </Typography>
          )}
        </Box>
        <Button variant="outlined" size="small" startIcon={<Download />} onClick={onExportAsciiDoc} sx={{ flexShrink: 0 }}>
          匯出 AsciiDoc
        </Button>
      </Box>
    </Paper>
  );
};
