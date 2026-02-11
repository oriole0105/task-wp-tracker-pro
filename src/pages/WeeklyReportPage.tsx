import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button,
  FormGroup, FormControlLabel, Checkbox, Divider
} from '@mui/material';
import { ContentCopy, Assessment, Image as ImageIcon, Code, FilterList, AccountTree, Timeline, Layers } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import { startOfDay, endOfDay, addMonths, subMonths, format, isValid } from 'date-fns';
import plantumlEncoder from 'plantuml-encoder';
import type { Task } from '../types';

const WeeklyReportPage: React.FC = () => {
  const { tasks, mainCategories, subCategories } = useTaskStore();

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

  // Helper to calculate absolute task depth (1-based)
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

  // Pre-filter tasks by range, categories AND selected levels
  const activeTasks = useMemo(() => {
    const startTs = range.start.getTime();
    const endTs = range.end.getTime();

    return tasks.filter(task => {
      // 1. Level Filter
      const depth = getTaskDepth(task);
      if (!selectedLevels.includes(depth)) return false;

      // 2. Date Range Filter
      const hasEstimatedInRange = task.estimatedStartDate && task.estimatedStartDate <= endTs && 
                                (!task.estimatedEndDate || task.estimatedEndDate >= startTs);
      const hasActualInRange = task.timeLogs && task.timeLogs.some(log => {
          const logEnd = log.endTime || Date.now();
          return log.startTime <= endTs && logEnd >= startTs;
      });

      return hasEstimatedInRange || hasActualInRange;
    });
  }, [tasks, range, selectedLevels]);

  // --- Blacklist Logic ---
  const EXCLUDE_KEYWORDS = ['會議', '討論', '溝通', '行政', 'Meeting', 'Discussion', 'Admin', 'Sync'];
  
  const [excludedMainCats, setExcludedMainCats] = useState<string[]>([]);
  const [excludedSubCats, setExcludedSubCats] = useState<string[]>(
    subCategories.filter(cat => EXCLUDE_KEYWORDS.some(k => cat.includes(k)))
  );

  const toggleMainExclusion = (cat: string) => {
    setExcludedMainCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const toggleSubExclusion = (cat: string) => {
    setExcludedSubCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  // --- WBS Generation ---
  const wbsSource = useMemo(() => {
    const filteredTasks = activeTasks.filter(t => 
        !excludedMainCats.includes(t.mainCategory || '其他') &&
        !excludedSubCats.includes(t.subCategory || '其他')
    );
    
    let source = '@startwbs\n';
    source += 'skinparam monochrome true\n';
    source += '* 專案工作任務\n';

    const mainCats = Array.from(new Set(filteredTasks.map(t => t.mainCategory || '其他')));
    mainCats.forEach(mainCat => {
      source += `** ${mainCat}\n`;
      const catTasks = filteredTasks.filter(t => (t.mainCategory || '其他') === mainCat);
      
      const renderTaskNode = (parentId: string | undefined, level: number) => {
        const children = catTasks.filter(t => t.parentId === parentId);
        children.forEach(child => {
          const stars = '*'.repeat(level);
          source += `${stars} ${child.title}\n`;
          (child.outputs || []).forEach(out => {
              if (out.name) source += `${stars}* _產出: ${out.name}_\n`;
          });
          renderTaskNode(child.id, level + 1);
        });
      };

      const rootCatTasks = catTasks.filter(t => !t.parentId || !catTasks.find(p => p.id === t.parentId));
      rootCatTasks.forEach(task => {
          source += `*** ${task.title}\n`;
          (task.outputs || []).forEach(out => {
              if (out.name) source += `**** _產出: ${out.name}_\n`;
          });
          renderTaskNode(task.id, 4);
      });
    });

    source += '@endwbs';
    return source;
  }, [activeTasks, excludedMainCats, excludedSubCats]);

  // --- Gantt Generation ---
  const ganttSource = useMemo(() => {
    let source = '@startgantt\n';
    source += `printscale daily zoom 1\n`;
    source += `Project starts ${format(range.start, 'yyyy-MM-dd')}\n\n`;

    const mainCats = Array.from(new Set(activeTasks.map(t => t.mainCategory || '其他')));

    mainCats.forEach(mainCat => {
      const catTasks = activeTasks.filter(t => (t.mainCategory || '其他') === mainCat);
      if (catTasks.length === 0) return;

      source += `-- ${mainCat} --\n`;

      catTasks.forEach(task => {
        const logs = task.timeLogs || [];
        const actualStart = logs.length > 0 ? Math.min(...logs.map(l => l.startTime)) : undefined;
        const actualEnd = task.status === 'DONE' && logs.length > 0 ? Math.max(...logs.filter(l => l.endTime).map(l => l.endTime!)) : undefined;

        let finalStart: number | undefined;
        let finalEnd: number | undefined;

        if (task.status === 'TODO') {
            finalStart = task.estimatedStartDate;
            finalEnd = task.estimatedEndDate;
        } else if (task.status === 'IN_PROGRESS' || task.status === 'PAUSED') {
            finalStart = actualStart;
            finalEnd = task.estimatedEndDate || Date.now() + 86400000;
        } else if (task.status === 'DONE') {
            finalStart = actualStart;
            finalEnd = actualEnd || Date.now();
        }

        if (finalStart && finalEnd && isValid(finalStart) && isValid(finalEnd)) {
          const startStr = format(finalStart, 'yyyy-MM-dd');
          const endStr = format(finalEnd, 'yyyy-MM-dd');
          const cleanTitle = task.title.replace(/[[\]]/g, '');
          
          source += `[${cleanTitle}] starts ${startStr} and ends ${endStr}\n`;
          
          if (task.status === 'DONE') {
              source += `[${cleanTitle}] is 100% completed\n`;
              source += `[${cleanTitle}] is colored in lightgreen\n`;
          } else if (task.status === 'TODO') {
              source += `[${cleanTitle}] is 0% completed\n`;
          } else if (task.status === 'IN_PROGRESS') {
              source += `[${cleanTitle}] is colored in LightBlue\n`;
          } else if (task.status === 'PAUSED') {
              source += `[${cleanTitle}] is colored in Orange\n`;
          }
        }
      });
      source += `\n`;
    });

    source += '@endgantt';
    return source;
  }, [activeTasks, range]);

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
            <Box sx={{ width: '100%', overflow: 'auto', border: '1px solid #eee', borderRadius: 1, bgcolor: '#fff', display: 'flex', justifyContent: 'center', p: 2, mb: 2, minHeight: 200 }}>
              {imageUrl ? <img src={imageUrl} alt={title} style={{ maxWidth: '100%' }} /> : <Typography color="error">渲染失敗</Typography>}
            </Box>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Box sx={{ bgcolor: '#f8f9fa', p: 1, borderRadius: 1 }}>
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
      
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f0f7ff' }}>
          <Typography variant="body2"><b>統計範圍：</b>{format(range.start, 'yyyy-MM-dd')} ～ {format(range.end, 'yyyy-MM-dd')} (前後一個月)</Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 4, border: '1px dashed #ccc' }}>
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
              <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}><FilterList fontSize="inherit" /> 排除任務分類</Typography>
                  <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
                      {[...mainCategories, '其他'].map(cat => (
                          <FormControlLabel key={cat} control={<Checkbox size="small" checked={excludedMainCats.includes(cat)} onChange={() => toggleMainExclusion(cat)} />} label={<Typography variant="body2">{cat}</Typography>} />
                      ))}
                  </FormGroup>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}><FilterList fontSize="inherit" /> 排除時間分類</Typography>
                  <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
                      {[...subCategories, '其他'].map(cat => (
                          <FormControlLabel key={cat} control={<Checkbox size="small" checked={excludedSubCats.includes(cat)} onChange={() => toggleSubExclusion(cat)} />} label={<Typography variant="body2">{cat}</Typography>} />
                      ))}
                  </FormGroup>
              </Grid>
          </Grid>
      </Paper>

      {renderSection('WBS 階層圖 (生產性產出)', <AccountTree />, wbsSource)}
      {renderSection('甘特圖 (分類群組時程)', <Timeline />, ganttSource)}
    </Box>
  );
};

export default WeeklyReportPage;