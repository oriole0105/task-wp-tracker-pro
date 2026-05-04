import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';
import { DATA_DIR, DATA_FILE } from './store/fileStore.js';
import { backupNow, pruneOldBackups, BACKUP_DIR } from './store/backup.js';

const TOKEN_FILE = join(DATA_DIR, 'token');
const API_URL = process.env.TT_API_URL ?? 'http://127.0.0.1:5174';

async function readToken(): Promise<string | null> {
  try { return (await readFile(TOKEN_FILE, 'utf-8')).trim(); } catch { return null; }
}

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/system/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

async function apiPost(path: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
  const token = await readToken();
  if (!token) throw new Error(`找不到 token 檔案（${TOKEN_FILE}），請先啟動 server`);
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json() };
}

// ── Commands ──────────────────────────────────────────────────────

async function exportCmd(args: string[]) {
  if (!existsSync(DATA_FILE)) {
    console.error('尚無資料檔案，請先啟動 server 並完成初始化。');
    process.exit(1);
  }
  const content = await readFile(DATA_FILE, 'utf-8');
  const dest = args[0];
  if (dest) {
    await writeFile(dest, content, 'utf-8');
    console.log(`✓ 已匯出到 ${dest}`);
  } else {
    process.stdout.write(content + '\n');
  }
}

async function importCmd(args: string[]) {
  const src = args[0];
  if (!src) { console.error('用法：tt import <來源檔案.json>'); process.exit(1); }
  if (!existsSync(src)) { console.error(`找不到檔案：${src}`); process.exit(1); }

  const content = await readFile(src, 'utf-8');
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { console.error('無效的 JSON 檔案'); process.exit(1); }

  // Accept: StoredFile ({ schemaVersion, data }), Zustand localStorage ({ state, version }), or bare AppData
  const p = parsed as Record<string, unknown>;
  const payload =
    p && 'data' in p ? p['data'] :    // server StoredFile format
    p && 'state' in p ? p['state'] :  // Zustand localStorage format
    parsed;                            // bare AppData

  if (await isServerRunning()) {
    const result = await apiPost('/data/import', payload);
    if (result.ok) {
      console.log('✓ 已透過 API 匯入資料（server 即時更新）');
    } else {
      console.error('API 匯入失敗：', JSON.stringify(result.data, null, 2));
      process.exit(1);
    }
  } else {
    // Server offline: write directly with pre-import backup
    if (existsSync(DATA_FILE)) {
      const label = `pre-import-${format(new Date(), 'yyyy-MM-dd-HHmmss')}`;
      const bak = await backupNow(label);
      if (bak) console.log(`  備份現有資料 → ${bak}`);
    }
    const stored = {
      schemaVersion: 3,
      data: payload,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(DATA_FILE, JSON.stringify(stored, null, 2), 'utf-8');
    console.log(`✓ 已匯入資料到 ${DATA_FILE}`);
    console.log('  啟動 server 後新資料即生效。');
  }
}

async function backupCmd(args: string[]) {
  if (!existsSync(DATA_FILE)) { console.error('尚無資料檔案。'); process.exit(1); }
  const label = args[0] ?? format(new Date(), 'yyyy-MM-dd-HHmmss');
  const dest = await backupNow(label);
  await pruneOldBackups();
  console.log(`✓ 已備份到 ${dest}`);
  console.log(`  備份目錄：${BACKUP_DIR}`);
}

async function statusCmd() {
  type StoredShape = {
    schemaVersion?: number;
    updatedAt?: string;
    data?: {
      tasks?: unknown[];
      timeslots?: unknown[];
      todos?: unknown[];
      members?: unknown[];
      holidays?: unknown[];
    };
  };

  if (!existsSync(DATA_FILE)) {
    console.log('尚無資料檔案（server 尚未初始化）。');
  } else {
    const raw = await readFile(DATA_FILE, 'utf-8');
    const stored = JSON.parse(raw) as StoredShape;
    const d = stored.data ?? {};
    console.log(`schemaVersion  : ${stored.schemaVersion ?? '?'}`);
    console.log(`updatedAt      : ${stored.updatedAt ?? '?'}`);
    console.log(`tasks          : ${(d.tasks ?? []).length} 筆`);
    console.log(`timeslots      : ${(d.timeslots ?? []).length} 筆`);
    console.log(`todos          : ${(d.todos ?? []).length} 筆`);
    console.log(`members        : ${(d.members ?? []).length} 位`);
    console.log(`holidays       : ${(d.holidays ?? []).length} 天`);
  }
  console.log(`資料目錄       : ${DATA_DIR}`);
  console.log(`備份目錄       : ${BACKUP_DIR}`);
  const up = await isServerRunning();
  console.log(`server 狀態    : ${up ? '✓ 運作中' : '✗ 未啟動'} (${API_URL})`);
}

// ── Dispatch ──────────────────────────────────────────────────────

const [,, cmd, ...args] = process.argv;

const commands: Record<string, (a: string[]) => Promise<void>> = {
  export: exportCmd,
  import: importCmd,
  backup: backupCmd,
  status: (a) => { void a; return statusCmd(); },
};

const handler = commands[cmd];
if (!handler) {
  const p = 'npm -w packages/server run tt --';
  console.log('WorkScope Planner CLI\n');
  console.log(`  ${p} export [dest.json]   匯出完整資料（省略路徑則印到 stdout）`);
  console.log(`  ${p} import <src.json>    匯入資料（server 在線則熱更新，否則直接寫檔）`);
  console.log(`  ${p} backup [label]       立即建立備份（預設用日期時間命名）`);
  console.log(`  ${p} status               顯示資料摘要與 server 狀態`);
  if (cmd) { console.error(`\n未知命令：${cmd}`); process.exit(1); }
} else {
  await handler(args);
}
