import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { setCloudToken } from '../services/apiClient';

interface Props {
  open: boolean;
  onSuccess: () => void;
}

export function TokenLoginDialog({ open, onSuccess }: Props) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const t = token.trim();
    if (!t) { setError('請輸入 token'); return; }
    setCloudToken(t);
    onSuccess();
  };

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>輸入存取 Token</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          此為雲端部署模式。請輸入你在部署時設定的 TT_TOKEN。
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Token"
          type="password"
          value={token}
          onChange={e => { setToken(e.target.value); setError(''); }}
          error={!!error}
          helperText={error}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleSubmit}>確認</Button>
      </DialogActions>
    </Dialog>
  );
}
