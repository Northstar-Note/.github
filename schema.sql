-- Cloudflare D1 schema for newsletter subscribers.
-- Apply once:  wrangler d1 execute northstar-subscribers --remote --file=./schema.sql
CREATE TABLE IF NOT EXISTS subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 발송 기록 (호별 1회 = 중복발송 방지). /admin/send 가 없으면 자동 생성.
CREATE TABLE IF NOT EXISTS sends (
  slug       TEXT PRIMARY KEY,
  subject    TEXT,
  recipients INTEGER,
  sent_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
