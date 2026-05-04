import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';
import { DATA_DIR, DATA_FILE } from './fileStore.js';

export const BACKUP_DIR = join(DATA_DIR, 'backups');
const MAX_DAILY_BACKUPS = 7;

/** Copy data.json to backups/data-{label}.json. Returns destination path, or null if no data file. */
export async function backupNow(label?: string): Promise<string | null> {
  if (!existsSync(DATA_FILE)) return null;
  await mkdir(BACKUP_DIR, { recursive: true });
  const suffix = label ?? format(new Date(), 'yyyy-MM-dd');
  const dest = join(BACKUP_DIR, `data-${suffix}.json`);
  const content = await readFile(DATA_FILE, 'utf-8');
  await writeFile(dest, content, 'utf-8');
  return dest;
}

/** Remove oldest daily backups, keeping at most MAX_DAILY_BACKUPS. */
export async function pruneOldBackups(): Promise<void> {
  if (!existsSync(BACKUP_DIR)) return;
  const files = (await readdir(BACKUP_DIR))
    .filter(f => /^data-[\d-]+\.json$/.test(f))
    .sort();
  const surplus = files.slice(0, Math.max(0, files.length - MAX_DAILY_BACKUPS));
  for (const f of surplus) {
    await unlink(join(BACKUP_DIR, f)).catch(() => {});
  }
}

/** Run a backup on startup and every 24 h. The interval is unref'd so it won't keep the process alive. */
export function schedulePeriodicBackup(): void {
  const run = async () => {
    try {
      await backupNow();
      await pruneOldBackups();
    } catch (e) {
      console.warn('[backup]', e instanceof Error ? e.message : e);
    }
  };
  void run();
  setInterval(() => void run(), 24 * 60 * 60 * 1000).unref();
}
