import { type AppData, type IStore, SCHEMA_VERSION, emptyData } from './fileStore.js';
import type { AuthUser, UserRole, AuditLogEntry } from '@tt/shared/types';

// Minimal D1 types (避免依賴 @cloudflare/workers-types)
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface DbUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
  token_hash: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: number;
}

export interface DbAuditLog {
  id: number;
  user_id: string | null;
  user_name: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  metadata: string | null;
  created_at: string;
}

export interface AuditLogFilter {
  limit?: number;
  userId?: string;
  resource?: string;
}

export type CreateUserInput = {
  name: string;
  email?: string;
  role: UserRole;
};

// ── Token helpers ─────────────────────────────────────────────────────────────

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateToken(role: UserRole): string {
  const prefix = role === 'admin' ? 'tt_a_' : role === 'member' ? 'tt_m_' : 'tt_r_';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return prefix + hex;
}

export function dbUserToAuthUser(u: DbUser): AuthUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    tokenPrefix: u.token_prefix,
    lastUsedAt: u.last_used_at,
    isActive: !!u.is_active,
  };
}

// ── D1Store ───────────────────────────────────────────────────────────────────

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

  // ── User methods ────────────────────────────────────────────────────────────

  async getUserByTokenHash(hash: string): Promise<DbUser | null> {
    return this.db
      .prepare('SELECT * FROM users WHERE token_hash = ? AND is_active = 1')
      .bind(hash)
      .first<DbUser>();
  }

  async getUserByEmail(email: string): Promise<DbUser | null> {
    return this.db
      .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
      .bind(email)
      .first<DbUser>();
  }

  async getUserById(id: string): Promise<DbUser | null> {
    return this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<DbUser>();
  }

  async listUsers(): Promise<DbUser[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM users ORDER BY created_at ASC')
      .all<DbUser>();
    return results;
  }

  async createUser(input: CreateUserInput): Promise<{ user: AuthUser; rawToken: string }> {
    const rawToken = generateToken(input.role);
    const tokenHash = await hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 12);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        'INSERT INTO users (id, email, name, role, token_hash, token_prefix, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      )
      .bind(id, input.email ?? null, input.name, input.role, tokenHash, tokenPrefix, now)
      .run();

    const dbUser: DbUser = {
      id, email: input.email ?? null, name: input.name, role: input.role,
      token_hash: tokenHash, token_prefix: tokenPrefix,
      created_at: now, last_used_at: null, is_active: 1,
    };
    return { user: dbUserToAuthUser(dbUser), rawToken };
  }

  async updateUser(id: string, data: Partial<Pick<DbUser, 'name' | 'email' | 'role' | 'is_active' | 'last_used_at'>>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
    if (fields.length === 0) return;
    values.push(id);
    await this.db
      .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async rotateUserToken(id: string, role: UserRole): Promise<string> {
    const rawToken = generateToken(role);
    const tokenHash = await hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 12);
    await this.db
      .prepare('UPDATE users SET token_hash = ?, token_prefix = ? WHERE id = ?')
      .bind(tokenHash, tokenPrefix, id)
      .run();
    return rawToken;
  }

  // ── Audit log methods ───────────────────────────────────────────────────────

  async insertAuditLog(entry: Omit<AuditLogEntry, 'id'>): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO audit_log (user_id, user_name, action, resource, resource_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        entry.userId ?? null,
        entry.userName ?? null,
        entry.action,
        entry.resource,
        entry.resourceId ?? null,
        entry.metadata ?? null,
        entry.createdAt,
      )
      .run();
  }

  async getAuditLog(filter?: AuditLogFilter): Promise<DbAuditLog[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter?.userId) {
      conditions.push('user_id = ?');
      values.push(filter.userId);
    }
    if (filter?.resource) {
      conditions.push('resource = ?');
      values.push(filter.resource);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter?.limit ?? 100;
    values.push(limit);

    const { results } = await this.db
      .prepare(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ?`)
      .bind(...values)
      .all<DbAuditLog>();
    return results;
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  async ensureAdminUser(adminToken: string): Promise<void> {
    const existing = await this.db
      .prepare('SELECT id FROM users WHERE role = ? LIMIT 1')
      .bind('admin')
      .first<{ id: string }>();
    if (existing) return;

    const tokenHash = await hashToken(adminToken);
    const tokenPrefix = adminToken.slice(0, 12);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        'INSERT OR IGNORE INTO users (id, email, name, role, token_hash, token_prefix, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      )
      .bind(id, null, 'Admin', 'admin', tokenHash, tokenPrefix, now)
      .run();
  }
}

// ── hashToken export (for use in auth middleware) ─────────────────────────────

export { hashToken };
