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

-- Additive schema: safe to reapply to databases created before source outcomes.
CREATE TABLE IF NOT EXISTS event_source_memberships (
  event_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (event_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_event_source_memberships_source ON event_source_memberships(source_id);
CREATE TABLE IF NOT EXISTS event_source_status (
  source_id TEXT PRIMARY KEY,
  outcome TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  last_attempt_at TEXT NOT NULL,
  last_success_at TEXT,
  error_category TEXT,
  upcoming_complete INTEGER NOT NULL,
  past_complete INTEGER NOT NULL
);
