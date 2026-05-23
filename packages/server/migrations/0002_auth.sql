CREATE TABLE IF NOT EXISTS users (
  id           TEXT    PRIMARY KEY,
  email        TEXT    UNIQUE,
  name         TEXT    NOT NULL,
  role         TEXT    NOT NULL DEFAULT 'member',
  token_hash   TEXT    NOT NULL,
  token_prefix TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  last_used_at TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT,
  user_name   TEXT,
  action      TEXT    NOT NULL,
  resource    TEXT    NOT NULL,
  resource_id TEXT,
  metadata    TEXT,
  created_at  TEXT    NOT NULL
);
