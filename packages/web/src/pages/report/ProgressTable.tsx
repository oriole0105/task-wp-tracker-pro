import React from 'react';
import {
  Box, Typography, Paper, TextField, Button, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  ContentCopy, ChevronLeft, ChevronRight, TrendingUp, AddCircleOutline, ShowChart,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { Task, TaskStatus, OutputType } from '@tt/shared/types';
import { getSnapshotAtOrBefore, getSnapshotInPeriod, getSnapshotNoteInPeriod, calcSPI } from '@tt/shared/reports/common';
import type { PeriodLabels, ProgressSplit } from '@tt/shared/reports/common';
import type { Period } from '@tt/shared/reports/common';
import type { ChartTarget } from './report.types';

const STATUS_COLORS: Record<TaskStatus, 'default' | 'primary' | 'warning' | 'success' | 'error' | 'secondary'> = {
  BACKLOG: 'default', TODO: 'primary', IN_PROGRESS: 'primary',
  PAUSED: 'warning', DONE: 'success', CANCELLED: 'secondary',
};
const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: '待規劃', TODO: '待執行', IN_PROGRESS: '進行中',
  PAUSED: '暫停', DONE: '完成', CANCELLED: '取消',
};

function renderSPI(spiData: { planned: number; spi: number } | null) {
  if (!spiData) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const { planned, spi } = spiData;
  const color = spi >= 1.0 ? 'success' : spi >= 0.8 ? 'warning' : 'error';
  const label = spi >= 1.0 ? '正常/超前' : spi >= 0.8 ? '落後' : '嚴重落後';
  return (
    <Box>
      <Chip label={`SPI ${spi.toFixed(2)}　${label}`} size="small" color={color} variant="outlined" />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>計畫進度 {planned}%</Typography>
    </Box>
  );
}

function renderDeltaChip(delta: number | undefined) {
  if (delta === undefined) return <Typography variant="caption" color="text.disabled">—</Typography>;
  if (delta > 0) return <Chip label={`↑ +${delta}%`} size="small" color="success" variant="outlined" />;
  if (delta < 0) return <Chip label={`↓ ${delta}%`} size="small" color="error" variant="outlined" />;
  return <Chip label="→ 持平" size="small" color="default" variant="outlined" />;
}

function renderCompleteness(value: number | undefined, isFallback: boolean, completenessType?: 'real' | 'confidence') {
  if (value === undefined) return <Typography variant="caption" color="text.disabled">尚無記錄</Typography>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      <Typography variant="body2">{value}%</Typography>
      {isFallback && <Typography variant="caption" color="text.disabled">(目前)</Typography>}
      <Typography variant="caption" sx={{ px: 0.4, py: 0, borderRadius: '3px', fontSize: '0.6rem', lineHeight: 1.4, bgcolor: completenessType === 'real' ? 'primary.main' : 'warning.main', color: 'white' }}>
        {completenessType === 'real' ? '真' : '信'}
      </Typography>
    </Box>
  );
}

interface ProgressTableProps {
  progressSplit: ProgressSplit;
  periodLabels: PeriodLabels;
  progressPeriod: Period;
  outputTypes: OutputType[];
  isCurrentPeriod: boolean;
  navigatePeriod: (dir: 1 | -1) => void;
  setReportAnchorDate: (date: Date) => void;
  progressAsciiDoc: string;
  editingNoteTaskId: string | null;
  editingNoteText: string;
  setEditingNoteText: (v: string) => void;
  onStartEditNote: (taskId: string, note: string) => void;
  onSaveNote: () => void;
  onCancelEditNote: () => void;
  onOpenQuickOutput: (task: Task) => void;
  onOpenChart: (target: ChartTarget) => void;
}

export const ProgressTable: React.FC<ProgressTableProps> = ({
  progressSplit, periodLabels, progressPeriod, outputTypes,
  isCurrentPeriod, navigatePeriod, setReportAnchorDate,
  progressAsciiDoc, editingNoteTaskId, editingNoteText, setEditingNoteText,
  onStartEditNote, onSaveNote, onCancelEditNote, onOpenQuickOutput, onOpenChart,
}) => {
  const { withProgress, prevEndStr, currStartStr, currEndStr } = progressSplit;

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUp /> 進度追蹤表
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" startIcon={<ContentCopy />} onClick={() => { navigator.clipboard.writeText(progressAsciiDoc); alert('AsciiDoc 已複製！'); }}>
            複製 AsciiDoc
          </Button>
          <IconButton size="small" onClick={() => navigatePeriod(-1)}><ChevronLeft /></IconButton>
          <Box sx={{ textAlign: 'center', minWidth: 240 }}>
            <Typography variant="body2">{periodLabels.rangeDisplay}</Typography>
            {!isCurrentPeriod && <Typography variant="caption" color="text.secondary">（非目前期間）</Typography>}
          </Box>
          <IconButton size="small" onClick={() => navigatePeriod(1)}><ChevronRight /></IconButton>
          {!isCurrentPeriod && (
            <Tooltip title="回到目前期間">
              <Button size="small" variant="outlined" onClick={() => setReportAnchorDate(new Date())}>目前</Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 'bold', width: '22%' }}>任務 / 工作產出</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '7%' }}>預期完成日</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '6%' }}>{periodLabels.prevShort}</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '6%' }}>{periodLabels.currShort}</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '8%' }}>{periodLabels.deltaLabel}</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '16%' }}>時程績效 SPI</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '7%' }}>狀態</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '28%' }}>說明</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {withProgress.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">此範圍內無進展中的任務</Typography>
                </TableCell>
              </TableRow>
            ) : withProgress.map(task => {
              const noTrack = task.trackCompleteness === false;
              const prevTask = noTrack ? undefined : getSnapshotAtOrBefore(task.weeklySnapshots, prevEndStr);
              const thisTaskSnap = noTrack ? undefined : getSnapshotInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
              const thisTask = noTrack ? undefined : (thisTaskSnap ?? task.completeness);
              const taskDelta = prevTask !== undefined && thisTask !== undefined ? thisTask - prevTask : undefined;
              const spiData = noTrack ? null : calcSPI(task);
              const periodOutputs = task.outputs.filter(o =>
                !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr)
              );
              const hasChartData = !noTrack && ((task.weeklySnapshots?.length ?? 0) > 0 ||
                task.outputs.some(o => (o.weeklySnapshots?.length ?? 0) > 0));

              return (
                <React.Fragment key={task.id}>
                  <TableRow sx={{ '& td': { borderTop: '2px solid', borderTopColor: 'divider' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">{task.title}</Typography>
                          {task.mainCategory && <Typography variant="caption" color="text.secondary">{task.mainCategory}</Typography>}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                          <Tooltip title={`新增本期產出（${format(progressPeriod.start, 'MM/dd')}）`}>
                            <IconButton size="small" color="success" onClick={() => onOpenQuickOutput(task)}>
                              <AddCircleOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {hasChartData && (
                            <Tooltip title="查看完成度趨勢">
                              <IconButton size="small" onClick={() => onOpenChart({
                                title: task.title,
                                taskSnapshots: task.weeklySnapshots ?? [],
                                outputLines: task.outputs.filter(o => (o.weeklySnapshots?.length ?? 0) > 0).map(o => ({ name: o.name || '未命名產出', snapshots: o.weeklySnapshots ?? [] })),
                              })}>
                                <ShowChart fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {task.estimatedEndDate
                        ? <Typography variant="body2">{format(task.estimatedEndDate, 'MM/dd')}</Typography>
                        : <Typography variant="caption" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell>
                      {noTrack ? <Typography variant="caption" color="text.disabled">—</Typography>
                        : prevTask !== undefined ? <Typography variant="body2">{prevTask}%</Typography>
                        : <Typography variant="caption" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell>
                      {noTrack ? <Typography variant="caption" color="text.disabled">—</Typography>
                        : renderCompleteness(thisTask, thisTaskSnap === undefined && thisTask !== undefined, task.completenessType)}
                    </TableCell>
                    <TableCell>{noTrack ? null : renderDeltaChip(taskDelta)}</TableCell>
                    <TableCell>{spiData ? renderSPI(spiData) : null}</TableCell>
                    <TableCell>
                      <Chip label={STATUS_LABELS[task.status]} size="small" color={STATUS_COLORS[task.status]} variant="outlined" />
                    </TableCell>
                    <TableCell
                      onDoubleClick={() => {
                        const note = getSnapshotNoteInPeriod(task.weeklySnapshots, currStartStr, currEndStr) ?? '';
                        onStartEditNote(task.id, note);
                      }}
                      sx={{ cursor: 'pointer', minWidth: 120 }}
                    >
                      {editingNoteTaskId === task.id ? (
                        <TextField
                          autoFocus fullWidth multiline size="small"
                          value={editingNoteText}
                          onChange={e => setEditingNoteText(e.target.value)}
                          onBlur={onSaveNote}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveNote(); }
                            if (e.key === 'Escape') onCancelEditNote();
                          }}
                          placeholder="輸入說明..." variant="outlined"
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                        />
                      ) : (() => {
                        const weeklyNote = getSnapshotNoteInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
                        if (!weeklyNote) return <Typography variant="caption" color="text.disabled">雙擊編輯</Typography>;
                        return <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{weeklyNote}</Typography>;
                      })()}
                    </TableCell>
                  </TableRow>

                  {periodOutputs.map(output => {
                    const prevOut = getSnapshotAtOrBefore(output.weeklySnapshots, prevEndStr);
                    const thisOutSnap = getSnapshotInPeriod(output.weeklySnapshots, currStartStr, currEndStr);
                    const thisOut = thisOutSnap ?? (output.completeness ? parseInt(output.completeness) : undefined);
                    const outDelta = prevOut !== undefined && thisOut !== undefined ? thisOut - prevOut : undefined;
                    const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
                    return (
                      <TableRow key={output.id} sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ pl: 4 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="caption">↳ {output.name}</Typography>
                            {otMeta && <Chip label={otMeta.name} size="small" color={otMeta.isTangible ? 'primary' : 'secondary'} variant="outlined" sx={{ height: 16, fontSize: '0.65rem' }} />}
                            {output.effectiveDate && <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>[{output.effectiveDate}]</Typography>}
                          </Box>
                        </TableCell>
                        <TableCell />
                        <TableCell>
                          {prevOut !== undefined ? <Typography variant="body2">{prevOut}%</Typography> : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>{renderCompleteness(thisOut, thisOutSnap === undefined && thisOut !== undefined)}</TableCell>
                        <TableCell>{renderDeltaChip(outDelta)}</TableCell>
                        <TableCell /><TableCell /><TableCell />
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};
