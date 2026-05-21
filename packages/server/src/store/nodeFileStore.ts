import { readFile, writeFile, rename, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { type AppData, type IStore, SCHEMA_VERSION, emptyData } from './fileStore.js';

export const DATA_DIR = process.env.TT_DATA_DIR ?? join(homedir(), '.task-time-tracker');
export const DATA_FILE = join(DATA_DIR, 'data.json');
const TOKEN_FILE = join(DATA_DIR, 'token');

interface StoredFile {
  schemaVersion: number;
  data: AppData;
  updatedAt: string;
}

export class NodeFileStore implements IStore {
  private cache: AppData | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  async loadData(): Promise<AppData> {
    if (this.cache) return this.cache;
    await this.ensureDataDir();
    try {
      const raw = await readFile(DATA_FILE, 'utf-8');
      const stored: StoredFile = JSON.parse(raw) as StoredFile;
      if ((stored.schemaVersion ?? 0) < SCHEMA_VERSION) {
        const bakFile = join(DATA_DIR, `data.json.bak.v${stored.schemaVersion ?? 0}`);
        await writeFile(bakFile, raw, 'utf-8').catch(() => {});
        console.warn(`[fileStore] schemaVersion ${stored.schemaVersion ?? 0} → ${SCHEMA_VERSION}，舊資料已備份至 ${bakFile}`);
      }
      this.cache = stored.data;
      return this.cache;
    } catch {
      this.cache = emptyData();
      return this.cache;
    }
  }

  getData(): AppData {
    if (!this.cache) throw new Error('Data not loaded — call loadData() first');
    return this.cache;
  }

  async saveData(updater: (d: AppData) => AppData): Promise<AppData> {
    this.writeQueue = this.writeQueue.then(async () => {
      const updated = updater(this.getData());
      this.cache = updated;
      await this.atomicWrite(updated);
    });
    await this.writeQueue;
    return this.getData();
  }

  async getToken(): Promise<string> {
    await this.ensureDataDir();
    try {
      const token = await readFile(TOKEN_FILE, 'utf-8');
      return token.trim();
    } catch {
      const token = randomBytes(32).toString('hex');
      await writeFile(TOKEN_FILE, token, { mode: 0o600 });
      return token;
    }
  }

  dataExists(): boolean {
    return existsSync(DATA_FILE);
  }

  async importBootstrap(rawState: Partial<AppData>): Promise<void> {
    await this.ensureDataDir();
    const merged: AppData = { ...emptyData(), ...rawState };
    this.cache = merged;
    await this.atomicWrite(merged);
  }

  private async ensureDataDir(): Promise<void> {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
  }

  private async atomicWrite(data: AppData): Promise<void> {
    const stored: StoredFile = {
      schemaVersion: SCHEMA_VERSION,
      data,
      updatedAt: new Date().toISOString(),
    };
    const tmpFile = join(tmpdir(), `tt-data-${Date.now()}.json`);
    await writeFile(tmpFile, JSON.stringify(stored, null, 2), 'utf-8');
    await rename(tmpFile, DATA_FILE);
  }
}
