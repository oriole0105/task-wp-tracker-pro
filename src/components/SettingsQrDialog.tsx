import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Tabs, Tab, TextField,
  Alert, IconButton, Tooltip,
} from '@mui/material';
import { Close, CameraAlt, ContentCopy, ContentPaste } from '@mui/icons-material';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const MAX_QR_BYTES = 2500;

interface Props {
  open: boolean;
  onClose: () => void;
  /** 'show'：電腦端顯示 QR Code／複製文字；'scan'：手機端掃描／貼上文字 */
  mode: 'show' | 'scan';
  settingsData?: object;
  onImport?: (data: object) => void;
  onSuccess?: (msg: string) => void;
}

export const SettingsQrDialog: React.FC<Props> = ({
  open, onClose, mode, settingsData, onImport, onSuccess,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const scanningRef = useRef(false);

  const [tab, setTab] = useState(0); // 0=camera, 1=paste
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qrTooLarge, setQrTooLarge] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── 產生 QR Code ────────────────────────────────────────────
  useEffect(() => {
    if (!open || mode !== 'show' || !settingsData) return;
    const json = JSON.stringify(settingsData);
    if (json.length > MAX_QR_BYTES) {
      setQrTooLarge(true);
      return;
    }
    setQrTooLarge(false);
    const timer = setTimeout(() => {
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, json, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: 'L',
        }).catch(() => setQrTooLarge(true));
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [open, mode, settingsData]);

  // ── 相機掃描 ────────────────────────────────────────────────
  const stopCamera = () => {
    scanningRef.current = false;
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startScanLoop = (video: HTMLVideoElement, onFound: (json: string) => void) => {
    const loop = () => {
      if (!scanningRef.current) return;
      if (video.readyState >= video.HAVE_ENOUGH_DATA) {
        const cvs = document.createElement('canvas');
        cvs.width = video.videoWidth;
        cvs.height = video.videoHeight;
        const ctx = cvs.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            scanningRef.current = false;
            onFound(code.data);
            return;
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    scanningRef.current = true;
    animFrameRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (!open || mode !== 'scan' || tab !== 0) {
      stopCamera();
      return;
    }
    setCameraError(null);
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        startScanLoop(video, (raw) => {
          stopCamera();
          try {
            const parsed = JSON.parse(raw);
            if (!parsed.mainCategories && !parsed.subCategories && !parsed.members) {
              throw new Error('不是有效的設定檔');
            }
            onImport?.(parsed);
            onSuccess?.('設定匯入成功。');
            onClose();
          } catch (e: any) {
            setCameraError(`QR Code 無法解析：${e.message}，請改用「貼上文字」頁籤。`);
          }
        });
      } catch {
        if (mounted) setCameraError('無法存取相機，請確認已授予相機權限，或改用「貼上文字」頁籤。');
      }
    })();
    return () => { mounted = false; stopCamera(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, tab]);

  // ── 關閉清理 ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      stopCamera();
      setPasteText('');
      setPasteError(null);
      setCameraError(null);
      setTab(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── 複製 JSON 到剪貼簿 ───────────────────────────────────────
  const handleCopyJson = async () => {
    if (!settingsData) return;
    await navigator.clipboard.writeText(JSON.stringify(settingsData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── 貼上文字匯入 ────────────────────────────────────────────
  const handlePasteImport = () => {
    setPasteError(null);
    try {
      const parsed = JSON.parse(pasteText.trim());
      if (!parsed.mainCategories && !parsed.subCategories && !parsed.members) {
        throw new Error('無效的設定檔格式');
      }
      onImport?.(parsed);
      onSuccess?.('設定匯入成功。');
      onClose();
    } catch (e: any) {
      setPasteError(`解析失敗：${e.message}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        {mode === 'show' ? '分享設定 QR Code' : '匯入設定'}
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {/* ── 顯示 QR Code（電腦端）── */}
        {mode === 'show' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 1 }}>
            {qrTooLarge ? (
              <Alert severity="warning" sx={{ width: '100%' }}>
                設定資料較大，無法產生 QR Code。請改用下方「複製 JSON 文字」，透過 LINE / Email 傳送到手機後貼上匯入。
              </Alert>
            ) : (
              <>
                <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
                <Typography variant="caption" color="text.secondary">
                  用手機掃描此 QR Code 即可匯入設定
                </Typography>
              </>
            )}
            <Tooltip title={copied ? '已複製！' : '複製為 JSON 文字，可透過 LINE / Email 傳到手機後貼上匯入'}>
              <Button
                variant="outlined"
                startIcon={<ContentCopy />}
                onClick={handleCopyJson}
                color={copied ? 'success' : 'inherit'}
                fullWidth
              >
                {copied ? '已複製！' : '複製 JSON 文字（備用）'}
              </Button>
            </Tooltip>
          </Box>
        )}

        {/* ── 掃描 / 貼上（手機端）── */}
        {mode === 'scan' && (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="fullWidth">
              <Tab icon={<CameraAlt fontSize="small" />} label="掃描 QR Code" iconPosition="start" />
              <Tab icon={<ContentPaste fontSize="small" />} label="貼上文字" iconPosition="start" />
            </Tabs>

            {tab === 0 && (
              <Box>
                {cameraError ? (
                  <Alert severity="error" sx={{ mb: 1 }}>{cameraError}</Alert>
                ) : (
                  <Box sx={{
                    position: 'relative', width: '100%', aspectRatio: '1',
                    bgcolor: 'black', borderRadius: 1, overflow: 'hidden',
                  }}>
                    <video
                      ref={videoRef}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* 掃描框 */}
                    <Box sx={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '60%', aspectRatio: '1',
                      border: '2px solid rgba(255,255,255,0.8)',
                      borderRadius: 1,
                    }} />
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                  將鏡頭對準電腦螢幕上的 QR Code
                </Typography>
              </Box>
            )}

            {tab === 1 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  在電腦端點「複製 JSON 文字」，透過 LINE / Email 傳到手機後貼入：
                </Typography>
                <TextField
                  multiline
                  rows={7}
                  fullWidth
                  size="small"
                  placeholder='{ "mainCategories": [...], ... }'
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setPasteError(null); }}
                  error={!!pasteError}
                  helperText={pasteError}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        {mode === 'scan' && tab === 1 && (
          <Button onClick={handlePasteImport} variant="contained" disabled={!pasteText.trim()}>
            匯入
          </Button>
        )}
        <Button onClick={onClose}>關閉</Button>
      </DialogActions>
    </Dialog>
  );
};
