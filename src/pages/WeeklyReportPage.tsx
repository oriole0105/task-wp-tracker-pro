import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button,
  FormGroup, FormControlLabel, Checkbox, Divider, Switch,
  ToggleButton, ToggleButtonGroup,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip,
} from '@mui/material';
import { ContentCopy, Assessment, Image as ImageIcon, Code, FilterList, AccountTree, Timeline, Layers, ViewWeek, Inventory2, ChevronLeft, ChevronRight, TrendingUp } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import { startOfDay, endOfDay, addDays, addMonths, subMonths, subDays, subWeeks, addWeeks, startOfWeek, format, isValid } from 'date-fns';
import plantumlEncoder from 'plantuml-encoder';
import type { Task, TaskStatus, WeeklySnapshot } from '../types';

const WeeklyReportPage: React.FC = () => {
  const { tasks, timeslots, mainCategories, holidays, outputTypes } = useTaskStore();

  // --- Report Type & Period Navigation ---
  const [reportType, setReportType] = useState<'weekly' | 'bimonthly' | 'semiannual'>('weekly');
  const [reportAnchorDate, setReportAnchorDate] = useState<Date>(new Date());

  const reportPeriod = useMemo(() => {
    if (reportType === 'weekly') {
      const weekStart = startOfWeek(reportAnchorDate, { weekStartsOn: 0 });
      return { start: startOfDay(weekStart), end: endOfDay(addDays(weekStart, 6)) };
    } else if (reportType === 'bimonthly') {
      const month = reportAnchorDate.getMonth(); // 0-11
      const year = reportAnchorDate.getFullYear();
      // 雙月期間：Jan-Feb(0-1), Mar-Apr(2-3), May-Jun(4-5), Jul-Aug(6-7), Sep-Oct(8-9), Nov-Dec(10-11)
      const periodStartMonth = month % 2 === 0 ? month : month - 1;
      const periodStart = new Date(year, periodStartMonth, 1);
      const periodEnd = new Date(year, periodStartMonth + 2, 0); // last day of 2nd month
      return { start: startOfDay(periodStart), end: endOfDay(periodEnd) };
    } else { // semiannual
      const month = reportAnchorDate.getMonth(); // 0-11
      const year = reportAnchorDate.getFullYear();
      const isFirstHalf = month < 6;
      const periodStart = new Date(year, isFirstHalf ? 0 : 6, 1);
      const periodEnd = new Date(year, isFirstHalf ? 6 : 12, 0); // last day of Jun or Dec
      return { start: startOfDay(periodStart), end: endOfDay(periodEnd) };
    }
  }, [reportType, reportAnchorDate]);

  const prevPeriod = useMemo(() => {
    if (reportType === 'weekly') {
      const prevStart = subWeeks(reportPeriod.start, 1);
      return { start: startOfDay(prevStart), end: endOfDay(addDays(prevStart, 6)) };
    } else if (reportType === 'bimonthly') {
      return {
        start: startOfDay(subMonths(reportPeriod.start, 2)),
        end: endOfDay(subDays(reportPeriod.start, 1)),
      };
    } else {
      return {
        start: startOfDay(subMonths(reportPeriod.start, 6)),
        end: endOfDay(subDays(reportPeriod.start, 1)),
      };
    }
  }, [reportType, reportPeriod]);

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    return now >= reportPeriod.start && now <= reportPeriod.end;
  }, [reportPeriod]);

  const periodLabels = useMemo(() => {
    const pStart = format(prevPeriod.start, 'yyyy-MM-dd');
    const pEnd = format(prevPeriod.end, 'yyyy-MM-dd');
    const cStart = format(reportPeriod.start, 'yyyy-MM-dd');
    const cEnd = format(reportPeriod.end, 'yyyy-MM-dd');
    if (reportType === 'weekly') {
      return {
        prevShort: '上週%', currShort: '本週%', deltaLabel: '週間△',
        rangeDisplay: `上週：${pStart}　→　本週：${cStart}`,
      };
    } else if (reportType === 'bimonthly') {
      return {
        prevShort: '前期%', currShort: '本期%', deltaLabel: '期間△',
        rangeDisplay: `前期：${pStart}～${pEnd}　→　本期：${cStart}～${cEnd}`,
      };
    } else {
      return {
        prevShort: '前期%', currShort: '本期%', deltaLabel: '期間△',
        rangeDisplay: `前半年：${pStart}～${pEnd}　→　本半年：${cStart}～${cEnd}`,
      };
    }
  }, [reportType, reportPeriod, prevPeriod]);

  const navigatePeriod = (dir: 1 | -1) => {
    if (reportType === 'weekly') {
      setReportAnchorDate(d => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    } else if (reportType === 'bimonthly') {
      setReportAnchorDate(d => dir === 1 ? addMonths(d, 2) : subMonths(d, 2));
    } else {
      setReportAnchorDate(d => dir === 1 ? addMonths(d, 6) : subMonths(d, 6));
    }
  };

  // --- Snapshot Helpers ---
  // 取 prevPeriod 結束日前最近一筆快照（用於「上期/前期」欄）
  const getSnapshotAtOrBefore = (snapshots: WeeklySnapshot[] | undefined, dateStr: string): number | undefined => {
    if (!snapshots?.length) return undefined;
    const valid = snapshots
      .filter(s => s.weekStart <= dateStr)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    return valid.length > 0 ? valid[valid.length - 1].completeness : undefined;
  };

  // 取 reportPeriod 內最新一筆快照（用於「本期」欄）
  const getSnapshotInPeriod = (snapshots: WeeklySnapshot[] | undefined, startStr: string, endStr: string): number | undefined => {
    if (!snapshots?.length) return undefined;
    const valid = snapshots
      .filter(s => s.weekStart >= startStr && s.weekStart <= endStr)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    return valid.length > 0 ? valid[valid.length - 1].completeness : undefined;
  };

  // --- Hierarchy Level Logic ---
  const [selectedLevels, setSelectedLevels] = useState<number[]>([1, 2, 3, 4, 5]);

  const toggleLevel = (level: number) => {
    setSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const getTaskDepth = (task: Task): number => {
    let depth = 1;
    let current = task;
    while (current.parentId) {
      const parent = tasks.find(t => t.id === current.parentId);
      if (!parent) break;
      current = parent;
      depth++;
    }
    return depth;
  };

  const activeTasks = useMemo(() => {
    const startTs = reportPeriod.start.getTime();
    const endTs = reportPeriod.end.getTime();

    return tasks.filter(task => {
      const depth = getTaskDepth(task);
      if (!selectedLevels.includes(depth)) return false;

      const hasEstimatedInRange = task.estimatedStartDate && task.estimatedStartDate <= endTs &&
        (!task.estimatedEndDate || task.estimatedEndDate >= startTs);
      const hasActualInRange = timeslots.some(ts => {
        if (ts.taskId !== task.id) return false;
        const logEnd = ts.endTime || Date.now();
        return ts.startTime <= endTs && logEnd >= startTs;
      });

      return hasEstimatedInRange || hasActualInRange;
    });
  }, [tasks, timeslots, reportPeriod, selectedLevels]);

  // --- Gantt Options ---
  const [showTodayMark, setShowTodayMark] = useState(true);
  const [ganttMode, setGanttMode] = useState<'weekly' | 'workReview'>('weekly');
  const [showPlantUmlSource, setShowPlantUmlSource] = useState(false);

  const ganttRange = useMemo(() => {
    // 非週報模式：Gantt 範圍跟隨 reportPeriod
    if (reportType !== 'weekly') {
      return reportPeriod;
    }
    const today = new Date();
    if (ganttMode === 'weekly') {
      return {
        start: subMonths(startOfDay(today), 1),
        end: addMonths(endOfDay(today), 1),
      };
    } else {
      // 工作盤點模式：以 1/3/5/7/9/11 月 1 日為基準
      const month = today.getMonth() + 1; // 1-12
      const year = today.getFullYear();
      const oddMonths = [1, 3, 5, 7, 9, 11];
      const pastOdd = oddMonths.filter(m => m <= month);
      const anchorMonth = pastOdd.length > 0 ? Math.max(...pastOdd) : 11;
      const anchorYear = pastOdd.length > 0 ? year : year - 1;
      const anchor = new Date(anchorYear, anchorMonth - 1, 1);
      return {
        start: startOfDay(subDays(anchor, 15)),
        end: endOfDay(addMonths(anchor, 2)),
      };
    }
  }, [reportType, reportPeriod, ganttMode]);

  const ganttActiveTasks = useMemo(() => {
    const startTs = ganttRange.start.getTime();
    const endTs = ganttRange.end.getTime();
    return tasks.filter(task => {
      if (task.showInGantt === false) return false;
      const depth = getTaskDepth(task);
      if (!selectedLevels.includes(depth)) return false;
      const hasEstimatedInRange = task.estimatedStartDate && task.estimatedStartDate <= endTs &&
        (!task.estimatedEndDate || task.estimatedEndDate >= startTs);
      const hasActualInRange = timeslots.some(ts => {
        if (ts.taskId !== task.id) return false;
        const logEnd = ts.endTime || Date.now();
        return ts.startTime <= endTs && logEnd >= startTs;
      });
      return hasEstimatedInRange || hasActualInRange;
    });
  }, [tasks, timeslots, ganttRange, selectedLevels]);

  // --- SPI Calculation ---
  const calcSPI = (task: Task): { planned: number; spi: number } | null => {
    if (!task.estimatedEndDate) return null;
    const now = Date.now();
    const start = task.estimatedStartDate ?? task.estimatedEndDate;
    const end = task.estimatedEndDate;
    if (now <= start) return null;
    const plannedPct = now >= end ? 100 : ((now - start) / (end - start)) * 100;
    if (plannedPct === 0) return null;
    const actualPct = task.completeness ?? 0;
    return { planned: Math.round(plannedPct), spi: Math.round((actualPct / plannedPct) * 100) / 100 };
  };

  const renderSPI = (spiData: { planned: number; spi: number } | null) => {
    if (!spiData) return <Typography variant="caption" color="text.disabled">—</Typography>;
    const { planned, spi } = spiData;
    const color = spi >= 1.0 ? 'success' : spi >= 0.8 ? 'warning' : 'error';
    const label = spi >= 1.0 ? '正常/超前' : spi >= 0.8 ? '落後' : '嚴重落後';
    return (
      <Box>
        <Chip label={`SPI ${spi.toFixed(2)}　${label}`} size="small" color={color} variant="outlined" />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
          計畫進度 {planned}%
        </Typography>
      </Box>
    );
  };

  const renderDeltaChip = (delta: number | undefined) => {
    if (delta === undefined) return <Typography variant="caption" color="text.disabled">—</Typography>;
    if (delta > 0) return <Chip label={`↑ +${delta}%`} size="small" color="success" variant="outlined" />;
    if (delta < 0) return <Chip label={`↓ ${delta}%`} size="small" color="error" variant="outlined" />;
    return <Chip label="→ 持平" size="small" color="default" variant="outlined" />;
  };

  const renderCompleteness = (value: number | undefined, isFallback: boolean) => {
    if (value === undefined) return <Typography variant="caption" color="text.disabled">尚無記錄</Typography>;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2">{value}%</Typography>
        {isFallback && (
          <Typography variant="caption" color="text.disabled">(目前)</Typography>
        )}
      </Box>
    );
  };

  // --- Blacklist Logic ---
  const [excludedMainCats, setExcludedMainCats] = useState<string[]>([]);

  const toggleMainExclusion = (cat: string) => {
    setExcludedMainCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  // --- AsciiDoc Progress Table ---
  const progressAsciiDoc = useMemo(() => {
    const statusLabels: Record<TaskStatus, string> = {
      BACKLOG: '待規劃', TODO: '待執行', IN_PROGRESS: '進行中',
      PAUSED: '暫停', DONE: '完成', CANCELLED: '取消',
    };
    const fmtDelta = (delta: number | undefined): string => {
      if (delta === undefined) return '—';
      if (delta > 0) return `↑ +${delta}%`;
      if (delta < 0) return `↓ ${delta}%`;
      return '→ 持平';
    };
    const fmtVal = (value: number | undefined, isFallback: boolean): string => {
      if (value === undefined) return '—';
      return `${value}%${isFallback ? ' (目前)' : ''}`;
    };

    const prevEndStr = format(prevPeriod.end, 'yyyy-MM-dd');
    const currStartStr = format(reportPeriod.start, 'yyyy-MM-dd');
    const currEndStr = format(reportPeriod.end, 'yyyy-MM-dd');

    const lines: string[] = [];
    lines.push(`=== 進度追蹤（${periodLabels.rangeDisplay}）`);
    lines.push('');
    lines.push('[cols="3,1.2,0.8,0.8,1,1.8,1",options="header"]');
    lines.push('|===');
    lines.push(`|任務 / 工作產出 |預期完成日 |${periodLabels.prevShort.replace('%', '')}% |${periodLabels.currShort.replace('%', '')}% |${periodLabels.deltaLabel} |時程績效 SPI |狀態`);
    lines.push('');

    activeTasks
      .filter(t => !t.archived && t.showInReport !== false && !excludedMainCats.includes(t.mainCategory || '其他'))
      .forEach(task => {
        const prevTask = getSnapshotAtOrBefore(task.weeklySnapshots, prevEndStr);
        const thisTaskSnap = getSnapshotInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
        const thisTask = thisTaskSnap ?? task.completeness;
        const taskDelta = prevTask !== undefined && thisTask !== undefined ? thisTask - prevTask : undefined;
        const spiData = calcSPI(task);
        const spiCell = spiData
          ? `SPI ${spiData.spi.toFixed(2)} ${spiData.spi >= 1.0 ? '正常/超前' : spiData.spi >= 0.8 ? '落後' : '嚴重落後'} +\n計畫進度 ${spiData.planned}%`
          : '—';
        const endDateCell = task.estimatedEndDate ? format(task.estimatedEndDate, 'yyyy-MM-dd') : '—';
        const titleCell = task.mainCategory
          ? `*${task.title}* +\n（${task.mainCategory}）`
          : `*${task.title}*`;

        lines.push(`|${titleCell}`);
        lines.push(`|${endDateCell}`);
        lines.push(`|${prevTask !== undefined ? `${prevTask}%` : '—'}`);
        lines.push(`|${fmtVal(thisTask, thisTaskSnap === undefined && thisTask !== undefined)}`);
        lines.push(`|${fmtDelta(taskDelta)}`);
        lines.push(`|${spiCell}`);
        lines.push(`|${statusLabels[task.status]}`);
        lines.push('');

        // 依 effectiveDate 篩選產出
        const periodOutputs = task.outputs.filter(o =>
          !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr)
        );
        periodOutputs.forEach(output => {
          const prevOut = getSnapshotAtOrBefore(output.weeklySnapshots, prevEndStr);
          const thisOutSnap = getSnapshotInPeriod(output.weeklySnapshots, currStartStr, currEndStr);
          const thisOut = thisOutSnap ?? (output.completeness ? parseInt(output.completeness) : undefined);
          const outDelta = prevOut !== undefined && thisOut !== undefined ? thisOut - prevOut : undefined;
          const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
          const label = otMeta ? `${output.name} [${otMeta.name}]` : output.name;

          lines.push(`|\u00a0\u00a0↳ ${label}`);
          lines.push('|');
          lines.push(`|${prevOut !== undefined ? `${prevOut}%` : '—'}`);
          lines.push(`|${fmtVal(thisOut, thisOutSnap === undefined && thisOut !== undefined)}`);
          lines.push(`|${fmtDelta(outDelta)}`);
          lines.push('|');
          lines.push('|');
          lines.push('');
        });
      });

    lines.push('|===');
    return lines.join('\n');
  }, [activeTasks, excludedMainCats, periodLabels, prevPeriod, reportPeriod, outputTypes]);

  // --- WBS Generation ---
  const getWbsColor = (status: TaskStatus): string | null => {
    if (status === 'DONE') return '#lightgreen';
    if (status === 'CANCELLED') return '#yellow';
    if (status === 'PAUSED') return '#pink';
    if (status === 'BACKLOG' || status === 'TODO') return '#lightblue';
    return null; // IN_PROGRESS：不設定顏色
  };

  const wbsSource = useMemo(() => {
    const filteredTasks = activeTasks.filter(t =>
      t.showInWbs !== false && !excludedMainCats.includes(t.mainCategory || '其他')
    );

    let source = '@startwbs\n';
    source += '* 專案工作任務\n';

    const mainCats = Array.from(new Set(filteredTasks.map(t => t.mainCategory || '其他')));
    mainCats.forEach(mainCat => {
      source += `** ${mainCat}\n`;
      const catTasks = filteredTasks.filter(t => (t.mainCategory || '其他') === mainCat);

      const renderTaskNode = (parentId: string | undefined, level: number) => {
        const children = catTasks.filter(t => t.parentId === parentId);
        children.forEach(child => {
          const stars = '*'.repeat(level);
          const color = getWbsColor(child.status);
          source += `${stars}${color ? `[${color}]` : ''} ${child.title}\n`;
          renderTaskNode(child.id, level + 1);
        });
      };

      const rootCatTasks = catTasks.filter(t => !t.parentId || !catTasks.find(p => p.id === t.parentId));
      rootCatTasks.forEach(task => {
        const color = getWbsColor(task.status);
        source += `***${color ? `[${color}]` : ''} ${task.title}\n`;
        renderTaskNode(task.id, 4);
      });
    });

    source += '@endwbs';
    return source;
  }, [activeTasks, excludedMainCats]);

  // --- Gantt Generation ---
  const ganttSource = useMemo(() => {
    let source = '@startgantt\n';
    source += `printscale daily zoom 1\n`;
    source += `Project starts ${format(ganttRange.start, 'yyyy-MM-dd')}\n`;
    if (showTodayMark) {
      source += `${format(new Date(), 'yyyy-MM-dd')} is colored in Orange\n`;
    }
    source += `saturday are colored in lightblue\n`;
    source += `sunday are colored in lightblue\n`;
    const ganttRangeStartStr = format(ganttRange.start, 'yyyy-MM-dd');
    const ganttRangeEndStr = format(ganttRange.end, 'yyyy-MM-dd');
    holidays
      .filter(d => d >= ganttRangeStartStr && d <= ganttRangeEndStr)
      .forEach(d => { source += `${d} is colored in lightblue\n`; });
    source += '\n';

    const mainCats = Array.from(new Set(ganttActiveTasks.map(t => t.mainCategory || '其他')));

    mainCats.forEach(mainCat => {
      const catTasks = ganttActiveTasks.filter(t => (t.mainCategory || '其他') === mainCat);
      if (catTasks.length === 0) return;

      source += `-- ${mainCat} --\n`;

      catTasks.forEach(task => {
        const taskTs = timeslots.filter(ts => ts.taskId === task.id);
        const actualStart = taskTs.length > 0 ? Math.min(...taskTs.map(ts => ts.startTime)) : undefined;
        const isDoneOrCancelled = task.status === 'DONE' || task.status === 'CANCELLED';
        const actualEnd = isDoneOrCancelled && taskTs.length > 0
          ? Math.max(...taskTs.filter(ts => ts.endTime).map(ts => ts.endTime!))
          : undefined;

        let finalStart: number | undefined;
        let finalEnd: number | undefined;

        if (task.status === 'BACKLOG' || task.status === 'TODO') {
          finalStart = task.estimatedStartDate;
          finalEnd = task.estimatedEndDate;
        } else if (task.status === 'IN_PROGRESS' || task.status === 'PAUSED') {
          finalStart = actualStart ?? task.estimatedStartDate;
          finalEnd = task.estimatedEndDate || Date.now() + 86400000;
        } else if (isDoneOrCancelled) {
          finalStart = actualStart ?? task.estimatedStartDate;
          finalEnd = actualEnd ?? task.estimatedEndDate ?? Date.now();
        }

        if (finalStart && finalEnd && isValid(finalStart) && isValid(finalEnd)) {
          const startStr = format(finalStart, 'yyyy-MM-dd');
          const endStr = format(finalEnd, 'yyyy-MM-dd');
          const cleanTitle = task.title.replace(/[[\]]/g, '');
          const completenessVal = task.completeness !== undefined ? task.completeness : (isDoneOrCancelled ? 100 : 0);

          source += `[${cleanTitle}] starts ${startStr} and ends ${endStr}\n`;
          source += `[${cleanTitle}] is ${completenessVal}% completed\n`;

          if (isDoneOrCancelled) {
            source += `[${cleanTitle}] is colored in ${task.status === 'CANCELLED' ? 'Silver' : 'lightgreen'}\n`;
          } else if (task.status === 'IN_PROGRESS') {
            source += `[${cleanTitle}] is colored in deepskyblue\n`;
          } else if (task.status === 'PAUSED') {
            source += `[${cleanTitle}] is colored in Orange\n`;
          }
        }
      });
      source += `\n`;
    });

    source += '@endgantt';
    return source;
  }, [ganttActiveTasks, timeslots, ganttRange, showTodayMark, holidays]);

  const getPlantUMLUrl = (source: string) => {
    try { return `https://www.plantuml.com/plantuml/svg/${plantumlEncoder.encode(source)}`; } catch (e) { return ''; }
  };

  const renderSection = (title: string, icon: React.ReactNode, source: string) => {
    const imageUrl = getPlantUMLUrl(source);
    return (
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{icon} {title}</Typography>
          <Box>
            <Button size="small" startIcon={<ContentCopy />} onClick={() => { navigator.clipboard.writeText(source); alert('已複製！'); }} sx={{ mr: 1 }}>複製原始碼</Button>
            <Button size="small" startIcon={<ImageIcon />} component="a" href={imageUrl} target="_blank">另存圖檔</Button>
          </Box>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Box sx={{ width: '100%', overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', display: 'flex', justifyContent: 'center', p: 2, mb: 2, minHeight: 200 }}>
              {imageUrl ? <img src={imageUrl} alt={title} style={{ maxWidth: '100%' }} /> : <Typography color="error">渲染失敗</Typography>}
            </Box>
          </Grid>
          {showPlantUmlSource && (
            <Grid size={{ xs: 12 }}>
              <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}><Code sx={{ fontSize: 14 }} /> PlantUML 原始碼</Typography>
                <TextField fullWidth multiline rows={4} value={source} variant="standard" InputProps={{ readOnly: true, disableUnderline: true, sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }} />
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>
    );
  };

  const reportTypeLabel = reportType === 'weekly' ? '週報' : reportType === 'bimonthly' ? '雙月盤點' : '半年報';
  const ganttTitle = reportType === 'weekly'
    ? `甘特圖｜${ganttMode === 'weekly' ? '週報模式' : '工作盤點模式'}（${format(ganttRange.start, 'MM/dd')}～${format(ganttRange.end, 'MM/dd')}）`
    : `甘特圖（${format(ganttRange.start, 'MM/dd')}～${format(ganttRange.end, 'MM/dd')}）`;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Assessment fontSize="large" /> 週報素材生成</Typography>

      <Paper sx={{ p: 2, mb: 3, bgcolor: 'action.selected' }}>
        <Typography variant="body2">
          <b>統計範圍：</b>{format(reportPeriod.start, 'yyyy-MM-dd')} ～ {format(reportPeriod.end, 'yyyy-MM-dd')}
          （<b>{reportTypeLabel}</b>）
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 4, border: '1px dashed', borderColor: 'divider' }}>
        <Grid container spacing={3}>
          {/* Hierarchy Filter */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Layers fontSize="small" /> 顯示階層控制
            </Typography>
            <FormGroup sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
              {[1, 2, 3, 4, 5].map(lvl => (
                <FormControlLabel
                  key={lvl}
                  control={<Checkbox size="small" checked={selectedLevels.includes(lvl)} onChange={() => toggleLevel(lvl)} />}
                  label={<Typography variant="body2">Level {lvl}</Typography>}
                />
              ))}
            </FormGroup>
            <Divider sx={{ my: 2 }} />
          </Grid>

          {/* Category Filter */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}><FilterList fontSize="inherit" /> 排除任務分類</Typography>
            <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
              {[...mainCategories, '其他'].map(cat => (
                <FormControlLabel key={cat} control={<Checkbox size="small" checked={excludedMainCats.includes(cat)} onChange={() => toggleMainExclusion(cat)} />} label={<Typography variant="body2">{cat}</Typography>} />
              ))}
            </FormGroup>
          </Grid>

          {/* Report Type */}
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment fontSize="inherit" /> 報告類型
            </Typography>
            <ToggleButtonGroup
              value={reportType}
              exclusive
              onChange={(_, v) => { if (v) { setReportType(v); setReportAnchorDate(new Date()); } }}
              size="small"
            >
              <ToggleButton value="weekly" sx={{ gap: 0.5 }}>
                <ViewWeek fontSize="small" /> 週報
              </ToggleButton>
              <ToggleButton value="bimonthly" sx={{ gap: 0.5 }}>
                <Inventory2 fontSize="small" /> 雙月盤點
              </ToggleButton>
              <ToggleButton value="semiannual" sx={{ gap: 0.5 }}>
                <Timeline fontSize="small" /> 半年報
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          {/* Gantt Options */}
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timeline fontSize="inherit" /> 甘特圖選項
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {reportType === 'weekly' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ minWidth: 60 }}>顯示模式：</Typography>
                  <ToggleButtonGroup
                    value={ganttMode}
                    exclusive
                    onChange={(_, v) => v && setGanttMode(v)}
                    size="small"
                  >
                    <ToggleButton value="weekly" sx={{ gap: 0.5 }}>
                      <ViewWeek fontSize="small" /> 週報模式
                    </ToggleButton>
                    <ToggleButton value="workReview" sx={{ gap: 0.5 }}>
                      <Inventory2 fontSize="small" /> 工作盤點模式
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary">
                    {format(ganttRange.start, 'yyyy-MM-dd')} ～ {format(ganttRange.end, 'yyyy-MM-dd')}
                  </Typography>
                </Box>
              )}
              <FormControlLabel
                control={<Switch size="small" checked={showTodayMark} onChange={(e) => setShowTodayMark(e.target.checked)} />}
                label={<Typography variant="body2">顯示今日標記（今日欄位以橘色 highlight）</Typography>}
              />
              <FormControlLabel
                control={<Switch size="small" checked={showPlantUmlSource} onChange={(e) => setShowPlantUmlSource(e.target.checked)} />}
                label={<Typography variant="body2">顯示 PlantUML 原始碼（WBS 及甘特圖）</Typography>}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {renderSection('WBS 階層圖', <AccountTree />, wbsSource)}
      {renderSection(ganttTitle, <Timeline />, ganttSource)}

      {/* Progress Table */}
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
              {!isCurrentPeriod && (
                <Typography variant="caption" color="text.secondary">（非目前期間）</Typography>
              )}
            </Box>
            <IconButton size="small" onClick={() => navigatePeriod(1)}><ChevronRight /></IconButton>
            {!isCurrentPeriod && (
              <Tooltip title="回到目前期間">
                <Button size="small" variant="outlined" onClick={() => setReportAnchorDate(new Date())}>
                  目前
                </Button>
              </Tooltip>
            )}
          </Box>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 'bold', width: '28%' }}>任務 / 工作產出</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '9%' }}>預期完成日</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '8%' }}>{periodLabels.prevShort}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '8%' }}>{periodLabels.currShort}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>{periodLabels.deltaLabel}</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '22%' }}>時程績效 SPI</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '8%' }}>狀態</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const prevEndStr = format(prevPeriod.end, 'yyyy-MM-dd');
                const currStartStr = format(reportPeriod.start, 'yyyy-MM-dd');
                const currEndStr = format(reportPeriod.end, 'yyyy-MM-dd');

                const filteredTasks = activeTasks.filter(
                  t => !t.archived && t.showInReport !== false && !excludedMainCats.includes(t.mainCategory || '其他')
                );

                if (filteredTasks.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">此範圍內無任務</Typography>
                      </TableCell>
                    </TableRow>
                  );
                }

                return filteredTasks.map(task => {
                  const prevTask = getSnapshotAtOrBefore(task.weeklySnapshots, prevEndStr);
                  const thisTaskSnap = getSnapshotInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
                  const thisTask = thisTaskSnap ?? task.completeness;
                  const taskDelta = prevTask !== undefined && thisTask !== undefined ? thisTask - prevTask : undefined;
                  const spiData = calcSPI(task);

                  const statusColors: Record<TaskStatus, 'default' | 'primary' | 'warning' | 'success' | 'error' | 'secondary'> = {
                    BACKLOG: 'default', TODO: 'primary', IN_PROGRESS: 'primary',
                    PAUSED: 'warning', DONE: 'success', CANCELLED: 'secondary',
                  };
                  const statusLabels: Record<TaskStatus, string> = {
                    BACKLOG: '待規劃', TODO: '待執行', IN_PROGRESS: '進行中',
                    PAUSED: '暫停', DONE: '完成', CANCELLED: '取消',
                  };

                  // 依 effectiveDate 篩選產出
                  const periodOutputs = task.outputs.filter(o =>
                    !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr)
                  );

                  return (
                    <React.Fragment key={task.id}>
                      {/* Task row */}
                      <TableRow sx={{ '& td': { borderTop: '2px solid', borderTopColor: 'divider' } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">{task.title}</Typography>
                          {task.mainCategory && (
                            <Typography variant="caption" color="text.secondary">{task.mainCategory}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.estimatedEndDate
                            ? <Typography variant="body2">{format(task.estimatedEndDate, 'MM/dd')}</Typography>
                            : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>
                          {prevTask !== undefined
                            ? <Typography variant="body2">{prevTask}%</Typography>
                            : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>
                          {renderCompleteness(thisTask, thisTaskSnap === undefined && thisTask !== undefined)}
                        </TableCell>
                        <TableCell>{renderDeltaChip(taskDelta)}</TableCell>
                        <TableCell>{renderSPI(spiData)}</TableCell>
                        <TableCell>
                          <Chip
                            label={statusLabels[task.status]}
                            size="small"
                            color={statusColors[task.status]}
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>

                      {/* Output rows (filtered by effectiveDate) */}
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
                                {otMeta && (
                                  <Chip
                                    label={otMeta.name}
                                    size="small"
                                    color={otMeta.isTangible ? 'primary' : 'secondary'}
                                    variant="outlined"
                                    sx={{ height: 16, fontSize: '0.65rem' }}
                                  />
                                )}
                                {output.effectiveDate && (
                                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
                                    [{output.effectiveDate}]
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell />
                            <TableCell>
                              {prevOut !== undefined
                                ? <Typography variant="body2">{prevOut}%</Typography>
                                : <Typography variant="caption" color="text.disabled">—</Typography>}
                            </TableCell>
                            <TableCell>
                              {renderCompleteness(thisOut, thisOutSnap === undefined && thisOut !== undefined)}
                            </TableCell>
                            <TableCell>{renderDeltaChip(outDelta)}</TableCell>
                            <TableCell />
                            <TableCell />
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

    </Box>
  );
};

export default WeeklyReportPage;
