import { type AppData, type IStore, SCHEMA_VERSION, emptyData } from './fileStore.js';

// Minimal D1 types (避免依賴 @cloudflare/workers-types)
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export class D1Store implements IStore {
  private cache: AppData | null = null;
  private _dataExists = false;
  private readonly db: D1Database;
  private readonly token: string;

  constructor(db: D1Database, token: string) {
    this.db = db;
    this.token = token;
  }

  async loadData(): Promise<AppData> {
    const row = await this.db
      .prepare('SELECT data FROM app_data WHERE id = 1')
      .first<{ data: string }>();
    if (row) {
      this._dataExists = true;
      this.cache = JSON.parse(row.data) as AppData;
    } else {
      this._dataExists = false;
      this.cache = emptyData();
    }
    return this.cache;
  }

  getData(): AppData {
    if (!this.cache) throw new Error('Data not loaded — call loadData() first');
    return this.cache;
  }

  async saveData(updater: (d: AppData) => AppData): Promise<AppData> {
    const updated = updater(this.getData());
    this.cache = updated;
    await this.db
      .prepare(
        'INSERT OR REPLACE INTO app_data (id, schema_version, data, updated_at) VALUES (1, ?, ?, ?)',
      )
      .bind(SCHEMA_VERSION, JSON.stringify(updated), new Date().toISOString())
      .run();
    this._dataExists = true;
    return this.cache;
  }

  getToken(): Promise<string> {
    return Promise.resolve(this.token);
  }

  dataExists(): boolean {
    return this._dataExists;
  }

  async importBootstrap(rawState: Partial<AppData>): Promise<void> {
    const merged: AppData = { ...emptyData(), ...rawState };
    this.cache = merged;
    await this.db
      .prepare(
        'INSERT OR REPLACE INTO app_data (id, schema_version, data, updated_at) VALUES (1, ?, ?, ?)',
      )
      .bind(SCHEMA_VERSION, JSON.stringify(merged), new Date().toISOString())
      .run();
    this._dataExists = true;
  }

  getDbRef(): D1Database {
    return this.db;
  }
}
