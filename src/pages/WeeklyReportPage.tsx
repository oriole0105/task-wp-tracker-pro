import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button,
  FormGroup, FormControlLabel, Checkbox, Divider, Switch,
  ToggleButton, ToggleButtonGroup,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent,
} from '@mui/material';
import { ContentCopy, Assessment, Image as ImageIcon, Code, FilterList, AccountTree, Timeline, Layers, ViewWeek, Inventory2, ChevronLeft, ChevronRight, TrendingUp, Summarize, ShowChart, Close } from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTaskStore } from '../store/useTaskStore';
import { startOfDay, endOfDay, addDays, addMonths, subMonths, subDays, subWeeks, addWeeks, startOfWeek, format, isValid } from 'date-fns';
import plantumlEncoder from 'plantuml-encoder';
import type { Task, TaskStatus, WeeklySnapshot, WorkOutput } from '../types';

const WeeklyReportPage: React.FC = () => {
  const { tasks, timeslots, mainCategories, holidays, outputTypes } = useTaskStore();

  // --- Report Type & Period Navigation ---
  const [reportType, setReportType] = useState<'weekly' | 'bimonthly' | 'semiannual'>('weekly');
  const [reportAnchorDate, setReportAnchorDate] = useState<Date>(new Date());

  /**
   * ganttPeriod：WBS / 甘特圖 的時間範圍
   * - 週報：本週
   * - 雙月盤點：本雙月對（目前月份所屬的 2 個月，以整月為邊界）→ 未來計畫
   * - 半年報：當期半年（12-5月 或 6-11月），與 progressPeriod 相同
   */
  const ganttPeriod = useMemo(() => {
    if (reportType === 'weekly') {
      const weekStart = startOfWeek(reportAnchorDate, { weekStartsOn: 0 });
      return { start: startOfDay(weekStart), end: endOfDay(addDays(weekStart, 6)) };
    } else if (reportType === 'bimonthly') {
      const month = reportAnchorDate.getMonth(); // 0-11
      const year = reportAnchorDate.getFullYear();
      // 本雙月對：Jan-Feb(0-1), Mar-Apr(2-3), ..., Nov-Dec(10-11)
      const pairStart = month % 2 === 0 ? month : month - 1;
      return {
        start: startOfDay(new Date(year, pairStart, 1)),
        end: endOfDay(new Date(year, pairStart + 2, 0)), // last day of 2nd month
      };
    } else {
      // 半年報：12-5月 / 6-11月
      const month = reportAnchorDate.getMonth(); // 0-11
      const year = reportAnchorDate.getFullYear();
      if (month >= 5 && month <= 10) {
        // Jun-Nov
        return { start: startOfDay(new Date(year, 5, 1)), end: endOfDay(new Date(year, 11, 0)) };
      } else if (month === 11) {
        // Dec → Dec(year) ~ May(year+1)
        return { start: startOfDay(new Date(year, 11, 1)), end: endOfDay(new Date(year + 1, 5, 0)) };
      } else {
        // Jan-May → Dec(year-1) ~ May(year)
        return { start: startOfDay(new Date(year - 1, 11, 1)), end: endOfDay(new Date(year, 5, 0)) };
      }
    }
  }, [reportType, reportAnchorDate]);

  /**
   * progressPeriod：進度表 / 工作成果 的時間範圍
   * - 週報：同 ganttPeriod（本週）
   * - 雙月盤點：前一個雙月對（過去工作成果），與 ganttPeriod 不同
   * - 半年報：同 ganttPeriod（同一半年區間）
   */
  const progressPeriod = useMemo(() => {
    if (reportType === 'bimonthly') {
      const month = reportAnchorDate.getMonth(); // 0-11
      const year = reportAnchorDate.getFullYear();
      const currPairStart = month % 2 === 0 ? month : month - 1;
      // 前一個雙月對（JS Date 支援負 month 值，自動跨年處理）
      return {
        start: startOfDay(new Date(year, currPairStart - 2, 1)),
        end: endOfDay(new Date(year, currPairStart, 0)), // last day of month before currPairStart
      };
    }
    return ganttPeriod; // weekly & semiannual：同 ganttPeriod
  }, [reportType, reportAnchorDate, ganttPeriod]);

  const prevPeriod = useMemo(() => {
    if (reportType === 'weekly') {
      const prevStart = subWeeks(progressPeriod.start, 1);
      return { start: startOfDay(prevStart), end: endOfDay(addDays(prevStart, 6)) };
    } else if (reportType === 'bimonthly') {
      return {
        start: startOfDay(subMonths(progressPeriod.start, 2)),
        end: endOfDay(subDays(progressPeriod.start, 1)),
      };
    } else {
      return {
        start: startOfDay(subMonths(progressPeriod.start, 6)),
        end: endOfDay(subDays(progressPeriod.start, 1)),
      };
    }
  }, [reportType, progressPeriod]);

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    return now >= ganttPeriod.start && now <= ganttPeriod.end;
  }, [ganttPeriod]);

  const periodLabels = useMemo(() => {
    const pStart = format(prevPeriod.start, 'yyyy-MM-dd');
    const pEnd = format(prevPeriod.end, 'yyyy-MM-dd');
    const cStart = format(progressPeriod.start, 'yyyy-MM-dd');
    const cEnd = format(progressPeriod.end, 'yyyy-MM-dd');
    if (reportType === 'weekly') {
      return {
        prevShort: '上週%', currShort: '本週%', deltaLabel: '週間△',
        rangeDisplay: `上週：${pStart}　→　本週：${cStart}`,
      };
    } else {
      return {
        prevShort: '前期%', currShort: '本期%', deltaLabel: '期間△',
        rangeDisplay: `前期：${pStart}～${pEnd}　→　本期：${cStart}～${cEnd}`,
      };
    }
  }, [reportType, progressPeriod, prevPeriod]);

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
  const getSnapshotAtOrBefore = (snapshots: WeeklySnapshot[] | undefined, dateStr: string): number | undefined => {
    if (!snapshots?.length) return undefined;
    const valid = snapshots
      .filter(s => s.weekStart <= dateStr)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    return valid.length > 0 ? valid[valid.length - 1].completeness : undefined;
  };

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

  /**
   * activeTasks：WBS / Gantt 的任務來源（使用 ganttPeriod）
   * - 雙月盤點：本雙月對（未來計畫）
   * - 半年報：當期半年
   */
  const activeTasks = useMemo(() => {
    const startTs = ganttPeriod.start.getTime();
    const endTs = ganttPeriod.end.getTime();

    return tasks.filter(task => {
      if (task.archived) return false;
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
  }, [tasks, timeslots, ganttPeriod, selectedLevels]);

  /**
   * progressTasks：進度表的任務來源（使用 progressPeriod）
   * - 雙月盤點：前一個雙月對（工作成果）
   * - 半年報 / 週報：同 ganttPeriod
   * 獨立計算（不依賴 activeTasks），額外納入有 output.effectiveDate 落在當期的任務
   */
  const progressTasks = useMemo(() => {
    const startTs = progressPeriod.start.getTime();
    const endTs = progressPeriod.end.getTime();
    const currStartStr = format(progressPeriod.start, 'yyyy-MM-dd');
    const currEndStr = format(progressPeriod.end, 'yyyy-MM-dd');

    return tasks.filter(task => {
      if (task.archived) return false;
      const depth = getTaskDepth(task);
      if (!selectedLevels.includes(depth)) return false;

      const hasEstimatedInRange = task.estimatedStartDate && task.estimatedStartDate <= endTs &&
        (!task.estimatedEndDate || task.estimatedEndDate >= startTs);
      const hasActualInRange = timeslots.some(ts => {
        if (ts.taskId !== task.id) return false;
        const logEnd = ts.endTime || Date.now();
        return ts.startTime <= endTs && logEnd >= startTs;
      });
      const hasOutputInRange = task.outputs.some(o =>
        o.effectiveDate && o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr
      );

      return hasEstimatedInRange || hasActualInRange || hasOutputInRange;
    });
  }, [tasks, timeslots, progressPeriod, selectedLevels]);

  // --- Gantt Options ---
  const [showTodayMark, setShowTodayMark] = useState(true);
  const [ganttMode, setGanttMode] = useState<'weekly' | 'workReview'>('weekly');
  const [showPlantUmlSource, setShowPlantUmlSource] = useState(false);

  const ganttRange = useMemo(() => {
    if (reportType !== 'weekly') {
      return ganttPeriod; // 雙月/半年：使用 ganttPeriod
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
  }, [reportType, ganttPeriod, ganttMode]);

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
    const currStartStr = format(progressPeriod.start, 'yyyy-MM-dd');
    const currEndStr = format(progressPeriod.end, 'yyyy-MM-dd');

    const lines: string[] = [];
    lines.push(`=== 進度追蹤（${periodLabels.rangeDisplay}）`);
    lines.push('');
    lines.push('[cols="3,1.2,0.8,0.8,1,1.8,1",options="header"]');
    lines.push('|===');
    lines.push(`|任務 / 工作產出 |預期完成日 |${periodLabels.prevShort.replace('%', '')}% |${periodLabels.currShort.replace('%', '')}% |${periodLabels.deltaLabel} |時程績效 SPI |狀態`);
    lines.push('');

    progressTasks
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
  }, [progressTasks, excludedMainCats, periodLabels, prevPeriod, progressPeriod, outputTypes]);

  // --- WBS Generation ---
  const getWbsColor = (status: TaskStatus): string | null => {
    if (status === 'DONE') return '#lightgreen';
    if (status === 'CANCELLED') return '#yellow';
    if (status === 'PAUSED') return '#pink';
    if (status === 'BACKLOG' || status === 'TODO') return '#lightblue';
    return null;
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

  // --- Progress Table Split ---
  // 依「本期完成度是否有變動 + 是否暫停」將任務分為有進展 / 無進展兩組
  const progressSplit = useMemo(() => {
    const prevEndStr = format(prevPeriod.end, 'yyyy-MM-dd');
    const currStartStr = format(progressPeriod.start, 'yyyy-MM-dd');
    const currEndStr = format(progressPeriod.end, 'yyyy-MM-dd');

    const filtered = progressTasks.filter(
      t => !t.archived && t.showInReport !== false && !excludedMainCats.includes(t.mainCategory || '其他')
    );

    const withProgress: Task[] = [];
    const withoutProgress: Task[] = [];

    filtered.forEach(task => {
      // PAUSED 任務強制歸到無進展表
      if (task.status === 'PAUSED') {
        withoutProgress.push(task);
        return;
      }
      const prevSnap = getSnapshotAtOrBefore(task.weeklySnapshots, prevEndStr);
      const currSnap = getSnapshotInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
      const curr = currSnap ?? task.completeness;
      const delta = prevSnap !== undefined && curr !== undefined ? curr - prevSnap : undefined;
      if (delta !== undefined && delta !== 0) {
        withProgress.push(task);
      } else {
        withoutProgress.push(task);
      }
    });

    return { withProgress, withoutProgress, prevEndStr, currStartStr, currEndStr };
  }, [progressTasks, excludedMainCats, prevPeriod, progressPeriod]);

  // --- Completeness Trend Chart ---
  const CHART_COLORS = ['#1976d2', '#e91e63', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#795548'];

  const [chartTarget, setChartTarget] = useState<{
    title: string;
    taskSnapshots: WeeklySnapshot[];
    outputLines: { name: string; snapshots: WeeklySnapshot[] }[];
  } | null>(null);

  const chartData = useMemo(() => {
    if (!chartTarget) return [];
    const allDates = new Set<string>();
    chartTarget.taskSnapshots.forEach(s => allDates.add(s.weekStart));
    chartTarget.outputLines.forEach(o => o.snapshots.forEach(s => allDates.add(s.weekStart)));
    return Array.from(allDates).sort().map(date => {
      const point: Record<string, string | number | undefined> = { date: date.slice(5) }; // MM-DD
      const ts = chartTarget.taskSnapshots.find(s => s.weekStart === date);
      if (ts !== undefined) point['task'] = ts.completeness;
      chartTarget.outputLines.forEach(o => {
        const snap = o.snapshots.find(s => s.weekStart === date);
        if (snap !== undefined) point[o.name] = snap.completeness;
      });
      return point;
    });
  }, [chartTarget]);

  // --- Period Summary (ENH-010) ---
  // 期間工作成果彙總 — 雙月盤點 / 半年報 專用
  const periodSummary = useMemo(() => {
    if (reportType === 'weekly') return null;

    const startTs = progressPeriod.start.getTime();
    const endTs = progressPeriod.end.getTime();
    const currStartStr = format(progressPeriod.start, 'yyyy-MM-dd');
    const currEndStr = format(progressPeriod.end, 'yyyy-MM-dd');

    const filteredTasks = progressTasks.filter(
      t => !t.archived && t.showInReport !== false && !excludedMainCats.includes(t.mainCategory || '其他')
    );

    // Block 1: 任務狀態統計
    const statusCount: Record<TaskStatus, number> = {
      DONE: 0, CANCELLED: 0, IN_PROGRESS: 0, PAUSED: 0, TODO: 0, BACKLOG: 0,
    };
    filteredTasks.forEach(t => { statusCount[t.status]++; });

    // Block 2: 期間工時（以 timeslot startTime 落在 progressPeriod 計算）
    const hoursByCategory = new Map<string, number>();
    let totalMs = 0;
    timeslots.forEach(ts => {
      if (!ts.endTime) return;
      const effectiveStart = Math.max(ts.startTime, startTs);
      const effectiveEnd = Math.min(ts.endTime, endTs);
      if (effectiveStart >= effectiveEnd) return;
      const duration = effectiveEnd - effectiveStart;
      const task = ts.taskId ? tasks.find(t => t.id === ts.taskId) : undefined;
      const cat = task?.mainCategory || '未分類';
      hoursByCategory.set(cat, (hoursByCategory.get(cat) || 0) + duration);
      totalMs += duration;
    });
    const hourEntries = Array.from(hoursByCategory.entries()).sort((a, b) => b[1] - a[1]);

    // Block 3: 完成的工作產出（effectiveDate 落在 progressPeriod）
    const completedOutputs: { task: Task; output: WorkOutput }[] = [];
    tasks.filter(t => !t.archived && !excludedMainCats.includes(t.mainCategory || '其他')).forEach(task => {
      task.outputs.forEach(output => {
        if (output.effectiveDate && output.effectiveDate >= currStartStr && output.effectiveDate <= currEndStr) {
          completedOutputs.push({ task, output });
        }
      });
    });
    // 依 effectiveDate 排序
    completedOutputs.sort((a, b) => (a.output.effectiveDate ?? '').localeCompare(b.output.effectiveDate ?? ''));

    return { statusCount, filteredTotal: filteredTasks.length, hourEntries, totalMs, completedOutputs };
  }, [reportType, progressPeriod, progressTasks, tasks, timeslots, excludedMainCats]);

  const fmtHours = (ms: number) => `${(ms / 3600000).toFixed(1)}h`;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Assessment fontSize="large" /> 週報素材生成
      </Typography>

      {/* Info Bar */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'action.selected' }}>
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
      </Paper>

      {/* Options Panel */}
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
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterList fontSize="inherit" /> 排除任務分類
            </Typography>
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

      {/* WBS + Gantt（雙月：計畫展望區間；半年/週報：同進度區間） */}
      {reportType === 'bimonthly' && (
        <Paper sx={{ px: 3, py: 1.5, mb: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            ▼ WBS / 甘特圖 — 計畫展望區間：{format(ganttPeriod.start, 'yyyy-MM-dd')} ～ {format(ganttPeriod.end, 'yyyy-MM-dd')}
          </Typography>
        </Paper>
      )}
      {renderSection('WBS 階層圖', <AccountTree />, wbsSource)}
      {renderSection(ganttTitle, <Timeline />, ganttSource)}

      {/* Progress Table */}
      {reportType === 'bimonthly' && (
        <Paper sx={{ px: 3, py: 1.5, mb: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            ▼ 進度追蹤表 — 工作成果區間：{format(progressPeriod.start, 'yyyy-MM-dd')} ～ {format(progressPeriod.end, 'yyyy-MM-dd')}
          </Typography>
        </Paper>
      )}
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
                const { withProgress, prevEndStr, currStartStr, currEndStr } = progressSplit;

                if (withProgress.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">此範圍內無進展中的任務</Typography>
                      </TableCell>
                    </TableRow>
                  );
                }

                return withProgress.map(task => {
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

                  const periodOutputs = task.outputs.filter(o =>
                    !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr)
                  );

                  return (
                    <React.Fragment key={task.id}>
                      <TableRow sx={{ '& td': { borderTop: '2px solid', borderTopColor: 'divider' } }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">{task.title}</Typography>
                              {task.mainCategory && (
                                <Typography variant="caption" color="text.secondary">{task.mainCategory}</Typography>
                              )}
                            </Box>
                            {((task.weeklySnapshots?.length ?? 0) > 0 ||
                              task.outputs.some(o => (o.weeklySnapshots?.length ?? 0) > 0)) && (
                              <Tooltip title="查看完成度趨勢">
                                <IconButton
                                  size="small"
                                  onClick={() => setChartTarget({
                                    title: task.title,
                                    taskSnapshots: task.weeklySnapshots ?? [],
                                    outputLines: task.outputs
                                      .filter(o => (o.weeklySnapshots?.length ?? 0) > 0)
                                      .map(o => ({ name: o.name || '未命名產出', snapshots: o.weeklySnapshots ?? [] })),
                                  })}
                                >
                                  <ShowChart fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
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

      {/* 本期無進展任務（PAUSED 或完成度未變動） */}
      {progressSplit.withoutProgress.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            本期無進展任務
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            包含：暫停中任務、本期完成度與前期相同（無變動）的任務
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 'bold', width: '28%' }}>任務 / 工作產出</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '9%' }}>預期完成日</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '8%' }}>{periodLabels.prevShort}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '8%' }}>{periodLabels.currShort}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>狀態</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '37%' }}>原因 / 說明</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {progressSplit.withoutProgress.map(task => {
                  const { prevEndStr, currStartStr, currEndStr } = progressSplit;
                  const prevTask = getSnapshotAtOrBefore(task.weeklySnapshots, prevEndStr);
                  const thisTaskSnap = getSnapshotInPeriod(task.weeklySnapshots, currStartStr, currEndStr);
                  const thisTask = thisTaskSnap ?? task.completeness;

                  const statusColors: Record<TaskStatus, 'default' | 'primary' | 'warning' | 'success' | 'error' | 'secondary'> = {
                    BACKLOG: 'default', TODO: 'primary', IN_PROGRESS: 'primary',
                    PAUSED: 'warning', DONE: 'success', CANCELLED: 'secondary',
                  };
                  const statusLabels: Record<TaskStatus, string> = {
                    BACKLOG: '待規劃', TODO: '待執行', IN_PROGRESS: '進行中',
                    PAUSED: '暫停', DONE: '完成', CANCELLED: '取消',
                  };

                  const periodOutputs = task.outputs.filter(o =>
                    !o.effectiveDate || (o.effectiveDate >= currStartStr && o.effectiveDate <= currEndStr)
                  );

                  return (
                    <React.Fragment key={task.id}>
                      <TableRow sx={{ '& td': { borderTop: '2px solid', borderTopColor: 'divider' } }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">{task.title}</Typography>
                              {task.mainCategory && (
                                <Typography variant="caption" color="text.secondary">{task.mainCategory}</Typography>
                              )}
                            </Box>
                            {((task.weeklySnapshots?.length ?? 0) > 0 ||
                              task.outputs.some(o => (o.weeklySnapshots?.length ?? 0) > 0)) && (
                              <Tooltip title="查看完成度趨勢">
                                <IconButton size="small" onClick={() => setChartTarget({
                                  title: task.title,
                                  taskSnapshots: task.weeklySnapshots ?? [],
                                  outputLines: task.outputs
                                    .filter(o => (o.weeklySnapshots?.length ?? 0) > 0)
                                    .map(o => ({ name: o.name || '未命名產出', snapshots: o.weeklySnapshots ?? [] })),
                                })}>
                                  <ShowChart fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
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
                        <TableCell>
                          <Chip label={statusLabels[task.status]} size="small"
                            color={statusColors[task.status]} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {task.status === 'PAUSED' && task.pauseReason ? (
                            <Typography variant="body2" color="warning.main" sx={{ whiteSpace: 'pre-wrap' }}>
                              {task.pauseReason}
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          )}
                        </TableCell>
                      </TableRow>

                      {periodOutputs.map(output => {
                        const prevOut = getSnapshotAtOrBefore(output.weeklySnapshots, prevEndStr);
                        const thisOutSnap = getSnapshotInPeriod(output.weeklySnapshots, currStartStr, currEndStr);
                        const thisOut = thisOutSnap ?? (output.completeness ? parseInt(output.completeness) : undefined);
                        const otMeta = outputTypes.find(t => t.id === output.outputTypeId);
                        return (
                          <TableRow key={output.id} sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ pl: 4 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                <Typography variant="caption">↳ {output.name}</Typography>
                                {otMeta && (
                                  <Chip label={otMeta.name} size="small"
                                    color={otMeta.isTangible ? 'primary' : 'secondary'} variant="outlined"
                                    sx={{ height: 16, fontSize: '0.65rem' }} />
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
                            <TableCell />
                            <TableCell />
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
      )}

      {/* ENH-010：期間工作成果彙總 — 雙月盤點 / 半年報 */}
      {periodSummary && (
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
                <Chip
                  key={status}
                  label={`${label}：${periodSummary.statusCount[status]}`}
                  color={color}
                  variant={variant}
                  size="medium"
                />
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

          {/* Block 3: 完成的工作產出 */}
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              工作產出清單
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                （effectiveDate 落在此期間）
              </Typography>
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
                            {task.mainCategory && (
                              <Typography variant="caption" color="text.secondary">{task.mainCategory}</Typography>
                            )}
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
                            {otMeta && (
                              <Chip
                                label={otMeta.name}
                                size="small"
                                color={otMeta.isTangible ? 'primary' : 'secondary'}
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                            )}
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
      )}
      {/* 完成度趨勢 Dialog */}
      <Dialog open={!!chartTarget} onClose={() => setChartTarget(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 0.5 }}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShowChart /> 完成度趨勢
            </Typography>
            <Typography variant="body2" color="text.secondary">{chartTarget?.title}</Typography>
          </Box>
          <IconButton onClick={() => setChartTarget(null)}><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          {chartData.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              此任務尚無完成度快照資料
            </Typography>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <ChartTooltip formatter={(v: number | undefined) => v !== undefined ? `${v}%` : ''} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
                {(chartTarget?.taskSnapshots.length ?? 0) > 0 && (
                  <Line
                    type="monotone" dataKey="task" name="任務整體"
                    stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 4 }} connectNulls
                  />
                )}
                {chartTarget?.outputLines
                  .filter(o => o.snapshots.length > 0)
                  .map((o, idx) => (
                    <Line
                      key={o.name} type="monotone" dataKey={o.name} name={o.name}
                      stroke={CHART_COLORS[(idx + 1) % CHART_COLORS.length]}
                      strokeWidth={1.8}
                      strokeDasharray={idx % 2 !== 0 ? '5 3' : undefined}
                      dot={{ r: 3 }} connectNulls
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default WeeklyReportPage;
