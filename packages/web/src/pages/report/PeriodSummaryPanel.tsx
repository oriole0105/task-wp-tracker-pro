import React from 'react';
import {
  Box, Typography, Paper, Chip, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { Summarize } from '@mui/icons-material';
import { format } from 'date-fns';
import type { TaskStatus, OutputType } from '@tt/shared/types';
import type { Period } from '@tt/shared/reports/common';
import type { PeriodSummary } from './report.types';

const fmtHours = (ms: number) => `${(ms / 3600000).toFixed(1)}h`;

interface PeriodSummaryPanelProps {
  periodSummary: PeriodSummary;
  progressPeriod: Period;
  outputTypes: OutputType[];
}

export const PeriodSummaryPanel: React.FC<PeriodSummaryPanelProps> = ({
  periodSummary, progressPeriod, outputTypes,
}) => {
  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Summarize /> 期間工作成果彙總
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
        工作成果區間：{format(progressPeriod.start, 'yyyy-MM-dd')} ～ {format(progressPeriod.end, 'yyyy-MM-dd')}
      </Typography>

      {/* Block 1: 任務狀態統計 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>任務狀態統計</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {([
            { status: 'DONE' as TaskStatus, label: '完成', color: 'success' as const, variant: 'filled' as const },
            { status: 'IN_PROGRESS' as TaskStatus, label: '進行中', color: 'primary' as const, variant: 'filled' as const },
            { status: 'PAUSED' as TaskStatus, label: '暫停', color: 'warning' as const, variant: 'outlined' as const },
            { status: 'CANCELLED' as TaskStatus, label: '取消', color: 'default' as const, variant: 'outlined' as const },
            { status: 'TODO' as TaskStatus, label: '待執行', color: 'default' as const, variant: 'outlined' as const },
            { status: 'BACKLOG' as TaskStatus, label: '待規劃', color: 'default' as const, variant: 'outlined' as const },
          ]).filter(({ status }) => periodSummary.statusCount[status] > 0).map(({ status, label, color, variant }) => (
            <Chip key={status} label={`${label}：${periodSummary.statusCount[status]}`} color={color} variant={variant} size="medium" />
          ))}
          <Chip label={`合計：${periodSummary.filteredTotal}`} variant="outlined" size="medium" />
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Block 2: 期間實際工時彙總 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>期間實際工時彙總</Typography>
        {periodSummary.hourEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">此期間無工時紀錄</Typography>
        ) : (
          <TableContainer sx={{ maxWidth: 420 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell><b>主分類</b></TableCell>
                  <TableCell align="right"><b>工時</b></TableCell>
                  <TableCell align="right"><b>佔比</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {periodSummary.hourEntries.map(([cat, ms]) => (
                  <TableRow key={cat}>
                    <TableCell>{cat}</TableCell>
                    <TableCell align="right">{fmtHours(ms)}</TableCell>
                    <TableCell align="right">{((ms / periodSummary.totalMs) * 100).toFixed(0)}%</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'action.selected' }}>
                  <TableCell><b>合計</b></TableCell>
                  <TableCell align="right"><b>{fmtHours(periodSummary.totalMs)}</b></TableCell>
                  <TableCell align="right"><b>100%</b></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Block 3: 工作產出清單 */}
      <Box>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          工作產出清單
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>（effectiveDate 落在此期間）</Typography>
        </Typography>
        {periodSummary.completedOutputs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">此期間無標記 effectiveDate 的工作產出</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>任務</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>工作產出</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>類型</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">完成度</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>對應日期</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {periodSummary.completedOutputs.map(({ task, output }) => {
                  const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
                  return (
                    <TableRow key={output.id}>
                      <TableCell>
                        <Typography variant="body2">{task.title}</Typography>
                        {task.mainCategory && <Typography variant="caption" color="text.secondary">{task.mainCategory}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{output.name}</Typography>
                        {output.link && (
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            <a href={output.link} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
                              {output.link.length > 50 ? `${output.link.slice(0, 50)}…` : output.link}
                            </a>
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {otMeta && <Chip label={otMeta.name} size="small" color={otMeta.isTangible ? 'primary' : 'secondary'} variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
                      </TableCell>
                      <TableCell align="right">
                        {output.completeness
                          ? <Typography variant="body2">{output.completeness}%</Typography>
                          : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{output.effectiveDate}</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Paper>
  );
};
