-- Schema for the openodia-events D1 database.
-- Apply once: `bunx wrangler d1 execute openodia-events --remote --file=db/schema.sql`
-- (omit --remote for local development against the simulator).

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  community TEXT NOT NULL,
  type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  description TEXT,
  location TEXT,
  source TEXT NOT NULL DEFAULT 'bevy',
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_events_community ON events(community);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active);
-- Additive and safely repeatable. Existing events rows and columns remain intact.
CREATE TABLE IF NOT EXISTS event_reviewed_metadata (
  event_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);
-- Automatic redirect observations, populated by bounded scheduled refresh.
CREATE TABLE IF NOT EXISTS event_destination_aliases (
  alias_url TEXT PRIMARY KEY,
  destination_url TEXT,
  checked_at TEXT NOT NULL
);
