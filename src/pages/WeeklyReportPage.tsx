import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button,
  FormGroup, FormControlLabel, Checkbox, Divider, Switch,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { ContentCopy, Assessment, Image as ImageIcon, Code, FilterList, AccountTree, Timeline, Layers, ViewWeek, Inventory2 } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import { startOfDay, endOfDay, addMonths, subMonths, subDays, format, isValid } from 'date-fns';
import plantumlEncoder from 'plantuml-encoder';
import type { Task, TaskStatus } from '../types';

const WeeklyReportPage: React.FC = () => {
  const { tasks, timeslots, mainCategories, holidays } = useTaskStore();

  const range = useMemo(() => {
    const today = new Date();
    return {
      start: subMonths(startOfDay(today), 1),
      end: addMonths(endOfDay(today), 1)
    };
  }, []);

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
    const startTs = range.start.getTime();
    const endTs = range.end.getTime();

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
  }, [tasks, timeslots, range, selectedLevels]);

  // --- Gantt Options ---
  const [showTodayMark, setShowTodayMark] = useState(true);
  const [ganttMode, setGanttMode] = useState<'weekly' | 'workReview'>('weekly');

  const ganttRange = useMemo(() => {
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
  }, [ganttMode]);

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

  // --- Blacklist Logic ---
  const [excludedMainCats, setExcludedMainCats] = useState<string[]>([]);

  const toggleMainExclusion = (cat: string) => {
    setExcludedMainCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

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
          <Grid size={{ xs: 12 }}>
            <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}><Code sx={{ fontSize: 14 }} /> PlantUML 原始碼</Typography>
              <TextField fullWidth multiline rows={4} value={source} variant="standard" InputProps={{ readOnly: true, disableUnderline: true, sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }} />
            </Box>
          </Grid>
        </Grid>
      </Paper>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Assessment fontSize="large" /> 週報素材生成</Typography>

      <Paper sx={{ p: 2, mb: 3, bgcolor: 'action.selected' }}>
        <Typography variant="body2"><b>統計範圍：</b>{format(range.start, 'yyyy-MM-dd')} ～ {format(range.end, 'yyyy-MM-dd')} (前後一個月)</Typography>
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

          {/* Gantt Options */}
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timeline fontSize="inherit" /> 甘特圖選項
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
              <FormControlLabel
                control={<Switch size="small" checked={showTodayMark} onChange={(e) => setShowTodayMark(e.target.checked)} />}
                label={<Typography variant="body2">顯示今日標記（今日欄位以橘色 highlight）</Typography>}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {renderSection('WBS 階層圖', <AccountTree />, wbsSource)}
      {renderSection(`甘特圖｜${ganttMode === 'weekly' ? '週報模式' : '工作盤點模式'}（${format(ganttRange.start, 'MM/dd')}～${format(ganttRange.end, 'MM/dd')}）`, <Timeline />, ganttSource)}
    </Box>
  );
};

export default WeeklyReportPage;
