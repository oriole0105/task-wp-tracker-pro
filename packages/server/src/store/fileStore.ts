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

export const SCHEMA_VERSION = 3;

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

// ── IStore interface ──────────────────────────────────────────────────────────

export interface IStore {
  loadData(): Promise<AppData>;
  getData(): AppData;
  saveData(updater: (d: AppData) => AppData): Promise<AppData>;
  getToken(): Promise<string>;
  dataExists(): boolean;
  importBootstrap(rawState: Partial<AppData>): Promise<void>;
}

// ── Active store (set at startup) ─────────────────────────────────────────────

let _store: IStore | null = null;

export function initStore(store: IStore): void {
  _store = store;
}

function store(): IStore {
  if (!_store) throw new Error('Store not initialized — call initStore() first');
  return _store;
}

// ── Public API (delegates to active store) ────────────────────────────────────

export async function loadData(): Promise<AppData> {
  return store().loadData();
}

export function getData(): AppData {
  return store().getData();
}

export async function saveData(updater: (d: AppData) => AppData): Promise<AppData> {
  return store().saveData(updater);
}

export async function getToken(): Promise<string> {
  return store().getToken();
}

export function dataFileExists(): boolean {
  return store().dataExists();
}

export function getActiveStore(): IStore | null {
  return _store;
}

export async function importBootstrap(rawState: Partial<AppData>): Promise<void> {
  return store().importBootstrap(rawState);
}
