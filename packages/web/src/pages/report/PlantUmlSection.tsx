import React from 'react';
import { Box, Typography, Paper, Grid, TextField, Button } from '@mui/material';
import { ContentCopy, Image as ImageIcon, Code } from '@mui/icons-material';
import plantumlEncoder from 'plantuml-encoder';

interface PlantUmlSectionProps {
  title: string;
  icon: React.ReactNode;
  source: string;
  showSource: boolean;
}

export const PlantUmlSection: React.FC<PlantUmlSectionProps> = ({ title, icon, source, showSource }) => {
  let imageUrl = '';
  try { imageUrl = `https://www.plantuml.com/plantuml/svg/${plantumlEncoder.encode(source)}`; } catch { /* empty */ }

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
        {showSource && (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Code sx={{ fontSize: 14 }} /> PlantUML 原始碼
              </Typography>
              <TextField
                fullWidth multiline rows={4} value={source} variant="standard"
                InputProps={{ readOnly: true, disableUnderline: true, sx: { fontFamily: 'monospace', fontSize: '0.75rem' } }}
              />
            </Box>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};
