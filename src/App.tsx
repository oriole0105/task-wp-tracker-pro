import { useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import TasksPage from './pages/TasksPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import OutputReportPage from './pages/OutputReportPage';
import WeeklyReportPage from './pages/WeeklyReportPage';
import ArchivePage from './pages/ArchivePage';
import { useTaskStore } from './store/useTaskStore';

function App() {
  const darkMode = useTaskStore((s) => s.darkMode);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
        },
      }),
    [darkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="outputs" element={<OutputReportPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="weekly" element={<WeeklyReportPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="archive" element={<ArchivePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
