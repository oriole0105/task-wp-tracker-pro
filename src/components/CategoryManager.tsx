import React, { useState } from 'react';
import { 
  Box, Typography, Button, TextField, Paper, 
  List, ListItem, ListItemText, IconButton, Alert,
  Grid, Card, CardContent
} from '@mui/material';
import { Delete, Edit, Add, Download, Upload, Save, Cancel } from '@mui/icons-material';
import { useTaskStore } from '../store/useTaskStore';
import type { CategoryData } from '../types';

export const CategoryManager: React.FC = () => {
  const { 
    mainCategories, subCategories, 
    addMainCategory, updateMainCategory, deleteMainCategory,
    addSubCategory, updateSubCategory, deleteSubCategory,
    importCategories 
  } = useTaskStore();

  const [newMain, setNewMain] = useState('');
  const [newSub, setNewSub] = useState('');
  const [editing, setEditing] = useState<{ type: 'main' | 'sub', oldName: string, newName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Import/Export
  const handleExport = () => {
    const data: CategoryData = { mainCategories, subCategories };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'categories.json';
    link.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed.mainCategories && parsed.subCategories) {
            importCategories(parsed);
            setError(null);
          } else {
            throw new Error('Invalid JSON format');
          }
        } catch (err) {
          setError('Failed to import: Invalid JSON structure');
        }
      };
      reader.readAsText(file);
    }
  };

  const startEdit = (type: 'main' | 'sub', name: string) => {
    setEditing({ type, oldName: name, newName: name });
  };

  const saveEdit = () => {
    if (!editing || !editing.newName.trim()) return;
    if (editing.type === 'main') {
      updateMainCategory(editing.oldName, editing.newName.trim());
    } else {
      updateSubCategory(editing.oldName, editing.newName.trim());
    }
    setEditing(null);
  };

  const renderCategoryList = (type: 'main' | 'sub', list: string[], addFn: (n: string) => void, deleteFn: (n: string) => void, inputVal: string, setInputVal: (v: string) => void) => (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom color="primary">
          {type === 'main' ? 'Main Categories' : 'Sub Categories'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={`Add ${type} category...`}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (addFn(inputVal), setInputVal(''))}
          />
          <Button variant="contained" onClick={() => { addFn(inputVal); setInputVal(''); }} disabled={!inputVal.trim()}>
            <Add />
          </Button>
        </Box>
        <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
          {list.map((name) => (
            <ListItem
              key={name}
              secondaryAction={
                editing?.type === type && editing?.oldName === name ? (
                  <Box>
                    <IconButton size="small" onClick={saveEdit} color="success"><Save fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setEditing(null)}><Cancel fontSize="small" /></IconButton>
                  </Box>
                ) : (
                  <Box>
                    <IconButton size="small" onClick={() => startEdit(type, name)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => deleteFn(name)}><Delete fontSize="small" /></IconButton>
                  </Box>
                )
              }
            >
              {editing?.type === type && editing?.oldName === name ? (
                <TextField
                  size="small"
                  value={editing.newName}
                  onChange={(e) => setEditing({ ...editing, newName: e.target.value })}
                  autoFocus
                  fullWidth
                />
              ) : (
                <ListItemText primary={name} />
              )}
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ width: '100%', mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Category Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>Export JSON</Button>
          <Button variant="outlined" component="label" startIcon={<Upload />}>
            Import JSON
            <input type="file" hidden accept=".json" onChange={handleImport} />
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderCategoryList('main', mainCategories, addMainCategory, deleteMainCategory, newMain, setNewMain)}
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          {renderCategoryList('sub', subCategories, addSubCategory, deleteSubCategory, newSub, setNewSub)}
        </Grid>
      </Grid>
      
      <Paper sx={{ p: 2, mt: 4, bgcolor: '#fff3e0' }}>
        <Typography variant="subtitle2" color="warning.dark">
          Note: Main and Sub categories are now independent dimensions. Updating or deleting a category will affect existing tasks.
        </Typography>
      </Paper>
    </Box>
  );
};
