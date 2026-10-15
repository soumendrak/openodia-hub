
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
