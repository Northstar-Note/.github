-- Cloudflare D1 schema for newsletter subscribers.
-- Apply once:  wrangler d1 execute northstar-subscribers --remote --file=./schema.sql
CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
