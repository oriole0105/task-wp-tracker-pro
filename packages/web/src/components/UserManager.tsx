import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, Alert, Tooltip,
  CircularProgress, Switch,
} from '@mui/material';
import { Add, Refresh, ContentCopy, Check } from '@mui/icons-material';
import { authApi } from '../services/apiClient';
import type { AuthUser, UserRole } from '../services/apiClient';
import { useTaskStore } from '../store/useTaskStore';
import { format } from 'date-fns';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理員',
  member: '成員',
  readonly: '唯讀',
};

const ROLE_COLORS: Record<UserRole, 'error' | 'primary' | 'default'> = {
  admin: 'error',
  member: 'primary',
  readonly: 'default',
};

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateUserDialog: React.FC<CreateDialogProps> = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => { setName(''); setEmail(''); setRole('member'); setCreatedToken(null); setCopied(false); };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { token } = await authApi.createUser({ name: name.trim(), email: email.trim() || undefined, role });
      setCreatedToken(token);
      onCreated();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>新增使用者</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {!createdToken ? (
          <>
            <TextField label="姓名" value={name} onChange={e => setName(e.target.value)} required autoFocus />
            <TextField label="Email（選填，用於 CF Access）" value={email} onChange={e => setEmail(e.target.value)} />
            <FormControl>
              <InputLabel>角色</InputLabel>
              <Select value={role} label="角色" onChange={e => setRole(e.target.value as UserRole)}>
                <MenuItem value="admin">管理員 — 完整權限</MenuItem>
                <MenuItem value="member">成員 — 讀寫任務/時間</MenuItem>
                <MenuItem value="readonly">唯讀 — 只能查看</MenuItem>
              </Select>
            </FormControl>
          </>
        ) : (
          <>
            <Alert severity="success">使用者建立成功！</Alert>
            <Alert severity="warning">
              請立即複製以下 Token，離開後將無法再次查看。
            </Alert>
            <Paper variant="outlined" sx={{ p: 1.5, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
              {createdToken}
            </Paper>
            <Button
              variant="outlined"
              startIcon={copied ? <Check /> : <ContentCopy />}
              onClick={handleCopy}
              color={copied ? 'success' : 'primary'}
            >
              {copied ? '已複製' : '複製 Token'}
            </Button>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{createdToken ? '關閉' : '取消'}</Button>
        {!createdToken && (
          <Button onClick={handleCreate} variant="contained" disabled={!name.trim() || loading}>
            {loading ? <CircularProgress size={20} /> : '建立'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export const UserManager: React.FC = () => {
  const { currentUser } = useTaskStore();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<{ userId: string; token: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await authApi.listUsers();
      setUsers(list);
    } catch {
      // 非 admin 或本機模式：靜默失敗
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'admin') void fetchUsers();
  }, [currentUser, fetchUsers]);

  if (!currentUser || currentUser.role !== 'admin') {
    return null; // 非 admin 不顯示此區塊
  }

  const handleToggleActive = async (user: AuthUser) => {
    await authApi.updateUser(user.id, { isActive: !user.isActive });
    void fetchUsers();
  };

  const handleRotate = async (user: AuthUser) => {
    setRotatingId(user.id);
    try {
      const token = await authApi.rotateToken(user.id);
      setNewToken({ userId: user.id, token });
    } finally {
      setRotatingId(null);
    }
  };

  const handleCopyNewToken = async () => {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">使用者管理</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<Refresh />} onClick={fetchUsers} disabled={loading}>
            重新整理
          </Button>
          <Button size="small" variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            新增使用者
          </Button>
        </Box>
      </Box>

      {newToken && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button size="small" startIcon={copiedToken ? <Check /> : <ContentCopy />} onClick={handleCopyNewToken} color={copiedToken ? 'success' : 'inherit'}>
              {copiedToken ? '已複製' : '複製'}
            </Button>
          }
          onClose={() => setNewToken(null)}
        >
          新 Token（請立即複製）：<strong style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{newToken.token}</strong>
        </Alert>
      )}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>姓名</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>角色</TableCell>
              <TableCell>Token 前綴</TableCell>
              <TableCell>最後使用</TableCell>
              <TableCell>啟用</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell>
              </TableRow>
            ) : users.map((u) => (
              <TableRow key={u.id} sx={{ opacity: u.isActive ? 1 : 0.5 }}>
                <TableCell>{u.name}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{u.email ?? '—'}</TableCell>
                <TableCell>
                  <Chip label={ROLE_LABELS[u.role]} color={ROLE_COLORS[u.role]} size="small" />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{u.tokenPrefix}...</TableCell>
                <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {u.lastUsedAt ? format(new Date(u.lastUsedAt), 'MM/dd HH:mm') : '未使用'}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={u.isActive}
                    onChange={() => handleToggleActive(u)}
                    size="small"
                    disabled={u.id === currentUser.id}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="重新產生 Token">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleRotate(u)}
                        disabled={rotatingId === u.id}
                      >
                        {rotatingId === u.id ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchUsers}
      />
    </Box>
  );
};
