import React from 'react';
import {
  Box, Typography, Grid, FormGroup, FormControlLabel, Checkbox, Divider, Switch,
  ToggleButton, ToggleButtonGroup, Collapse, Paper, IconButton,
} from '@mui/material';
import {
  FilterList, Layers, Assessment, Timeline, ViewWeek, Inventory2, ExpandMore, ExpandLess, Tune,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { ReportType, Period } from '@tt/shared/reports/common';
import type { GanttMode, GanttScale } from './useReportSources';

interface ReportSettingsPanelProps {
  // Period
  reportType: ReportType;
  onReportTypeChange: (v: ReportType) => void;
  // Task filter
  selectedLevels: number[];
  toggleLevel: (level: number) => void;
  excludedMainCats: string[];
  toggleMainExclusion: (cat: string) => void;
  mainCategories: string[];
  // Gantt options
  ganttMode: GanttMode;
  setGanttMode: (v: GanttMode) => void;
  ganttScale: GanttScale;
  onGanttScaleChange: (v: GanttScale) => void;
  ganttZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  showTodayMark: boolean;
  setShowTodayMark: (v: boolean) => void;
  groupByCategory: boolean;
  setGroupByCategory: (v: boolean) => void;
  showPlantUmlSource: boolean;
  setShowPlantUmlSource: (v: boolean) => void;
  ganttRange: Period;
  settingsExpanded: boolean;
  onToggleSettings: () => void;
}

export const ReportSettingsPanel: React.FC<ReportSettingsPanelProps> = ({
  reportType, onReportTypeChange,
  selectedLevels, toggleLevel, excludedMainCats, toggleMainExclusion, mainCategories,
  ganttMode, setGanttMode, ganttScale, onGanttScaleChange, ganttZoom, onZoomIn, onZoomOut,
  showTodayMark, setShowTodayMark, groupByCategory, setGroupByCategory,
  showPlantUmlSource, setShowPlantUmlSource, ganttRange, settingsExpanded, onToggleSettings,
}) => {
  return (
    <Paper sx={{ mb: 4, border: '1px dashed', borderColor: 'divider' }}>
      <Box
        sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
        onClick={onToggleSettings}
      >
        <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 500 }}>
          <Tune fontSize="small" /> 素材生成設定
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">{settingsExpanded ? '收合' : '展開'}</Typography>
          {settingsExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </Box>
      </Box>
      <Collapse in={settingsExpanded}>
        <Divider />
        <Box sx={{ p: 3 }}>
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
                  <FormControlLabel
                    key={cat}
                    control={<Checkbox size="small" checked={excludedMainCats.includes(cat)} onChange={() => toggleMainExclusion(cat)} />}
                    label={<Typography variant="body2">{cat}</Typography>}
                  />
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
                value={reportType} exclusive
                onChange={(_, v) => { if (v) onReportTypeChange(v); }}
                size="small"
              >
                <ToggleButton value="weekly" sx={{ gap: 0.5 }}><ViewWeek fontSize="small" /> 週報</ToggleButton>
                <ToggleButton value="bimonthly" sx={{ gap: 0.5 }}><Inventory2 fontSize="small" /> 雙月盤點</ToggleButton>
                <ToggleButton value="semiannual" sx={{ gap: 0.5 }}><Timeline fontSize="small" /> 半年報</ToggleButton>
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
                      value={ganttMode} exclusive
                      onChange={(_, v) => v && setGanttMode(v)}
                      size="small"
                    >
                      <ToggleButton value="weekly" sx={{ gap: 0.5 }}><ViewWeek fontSize="small" /> 週報模式</ToggleButton>
                      <ToggleButton value="workReview" sx={{ gap: 0.5 }}><Inventory2 fontSize="small" /> 工作盤點模式</ToggleButton>
                    </ToggleButtonGroup>
                    <Typography variant="caption" color="text.secondary">
                      {format(ganttRange.start, 'yyyy-MM-dd')} ～ {format(ganttRange.end, 'yyyy-MM-dd')}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ minWidth: 60 }}>時間刻度：</Typography>
                  <ToggleButtonGroup
                    value={ganttScale} exclusive
                    onChange={(_, v) => { if (v) onGanttScaleChange(v); }}
                    size="small"
                  >
                    <ToggleButton value="daily" sx={{ gap: 0.5 }}>每日</ToggleButton>
                    <ToggleButton value="weekly" sx={{ gap: 0.5 }}>每週</ToggleButton>
                    <ToggleButton value="monthly" sx={{ gap: 0.5 }}>每月</ToggleButton>
                  </ToggleButtonGroup>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2">縮放：</Typography>
                    <IconButton size="small" onClick={onZoomOut} disabled={ganttZoom <= 1}>
                      <Typography variant="body2" fontWeight="bold">－</Typography>
                    </IconButton>
                    <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>{ganttZoom}</Typography>
                    <IconButton size="small" onClick={onZoomIn}>
                      <Typography variant="body2" fontWeight="bold">＋</Typography>
                    </IconButton>
                  </Box>
                  {reportType === 'semiannual' && (
                    <Typography variant="caption" color="text.secondary">（半年報建議使用每週或每月）</Typography>
                  )}
                </Box>
                <FormControlLabel
                  control={<Switch size="small" checked={groupByCategory} onChange={e => setGroupByCategory(e.target.checked)} />}
                  label={<Typography variant="body2">依主類別分組（開啟後任務依主類別加上分隔標題）</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" checked={showTodayMark} onChange={e => setShowTodayMark(e.target.checked)} />}
                  label={<Typography variant="body2">顯示今日標記（今日欄位以橘色 highlight）</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" checked={showPlantUmlSource} onChange={e => setShowPlantUmlSource(e.target.checked)} />}
                  label={<Typography variant="body2">顯示 PlantUML 原始碼（WBS 及甘特圖）</Typography>}
                />
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Collapse>
    </Paper>
  );
};
