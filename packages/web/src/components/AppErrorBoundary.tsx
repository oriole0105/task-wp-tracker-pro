import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 8 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold">應用程式發生錯誤</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {this.state.error.message}
            </Typography>
          </Alert>
          <Button variant="contained" onClick={() => window.location.reload()}>
            重新整理頁面
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
