import { readFile, writeFile, rename, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import type { Task, Timeslot, TodoItem, OutputType, Member } from '@tt/shared/types';

export interface AppSettings {
  darkMode: boolean;
  preventDuplicateTaskNames: boolean;
  quickAddAction: string;
}

export interface AppData {
  tasks: Task[];
  timeslots: Timeslot[];
  todos: TodoItem[];
  mainCategories: string[];
  subCategories: string[];
  outputTypes: OutputType[];
  holidays: string[];
  members: Member[];
  settings: AppSettings;
}

interface StoredFile {
  schemaVersion: number;
  data: AppData;
  updatedAt: string;
}

const SCHEMA_VERSION = 3;

export const DATA_DIR = process.env.TT_DATA_DIR ?? join(homedir(), '.task-time-tracker');
export const DATA_FILE = join(DATA_DIR, 'data.json');
const TOKEN_FILE = join(DATA_DIR, 'token');

let cache: AppData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function emptyData(): AppData {
  return {
    tasks: [],
    timeslots: [],
    todos: [],
    mainCategories: ['Development', 'Meeting', 'General'],
    subCategories: ['固定會議', '臨時會議', '議題討論', '思考規劃', '閱讀學習', '文件撰寫', '程式開發', '程式碼審查', 'Debug/問題排查'],
    outputTypes: [
      { id: 'ot-deliverable', name: '實體產出', isTangible: true },
      { id: 'ot-decision',    name: '決策',     isTangible: false },
      { id: 'ot-knowledge',   name: '知識/研究', isTangible: false },
      { id: 'ot-process',     name: '流程/規範', isTangible: false },
      { id: 'ot-other',       name: '其他',     isTangible: false },
    ],
    holidays: [],
    members: [{ id: 'self', name: '', isSelf: true }],
    settings: {
      darkMode: false,
      preventDuplicateTaskNames: true,
      quickAddAction: 'timeslot',
    },
  };
}

export async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function getToken(): Promise<string> {
  await ensureDataDir();
  try {
    const token = await readFile(TOKEN_FILE, 'utf-8');
    return token.trim();
  } catch {
    const token = randomBytes(32).toString('hex');
    await writeFile(TOKEN_FILE, token, { mode: 0o600 });
    return token;
  }
}

export async function loadData(): Promise<AppData> {
  if (cache) return cache;
  await ensureDataDir();
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    const stored: StoredFile = JSON.parse(raw) as StoredFile;
    if ((stored.schemaVersion ?? 0) < SCHEMA_VERSION) {
      const bakFile = join(DATA_DIR, `data.json.bak.v${stored.schemaVersion ?? 0}`);
      await writeFile(bakFile, raw, 'utf-8').catch(() => {});
      console.warn(`[fileStore] schemaVersion ${stored.schemaVersion ?? 0} → ${SCHEMA_VERSION}，舊資料已備份至 ${bakFile}`);
    }
    cache = stored.data;
    return cache;
  } catch {
    cache = emptyData();
    return cache;
  }
}

export function getData(): AppData {
  if (!cache) throw new Error('Data not loaded — call loadData() first');
  return cache;
}

async function atomicWrite(data: AppData): Promise<void> {
  const stored: StoredFile = {
    schemaVersion: SCHEMA_VERSION,
    data,
    updatedAt: new Date().toISOString(),
  };
  const tmpFile = join(tmpdir(), `tt-data-${Date.now()}.json`);
  await writeFile(tmpFile, JSON.stringify(stored, null, 2), 'utf-8');
  await rename(tmpFile, DATA_FILE);
}

export async function saveData(updater: (data: AppData) => AppData): Promise<AppData> {
  writeQueue = writeQueue.then(async () => {
    const updated = updater(getData());
    cache = updated;
    await atomicWrite(updated);
  });
  await writeQueue;
  return getData();
}

export function dataFileExists(): boolean {
  return existsSync(DATA_FILE);
}

export async function importBootstrap(rawState: Partial<AppData>): Promise<void> {
  await ensureDataDir();
  const merged: AppData = { ...emptyData(), ...rawState };
  cache = merged;
  await atomicWrite(merged);
}
