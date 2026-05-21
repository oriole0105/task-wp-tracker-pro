CREATE TABLE IF NOT EXISTS app_data (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  schema_version INTEGER NOT NULL,
  data          TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
