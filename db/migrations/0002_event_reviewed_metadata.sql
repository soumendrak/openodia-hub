-- Additive and safely repeatable. Existing events rows and columns remain intact.
CREATE TABLE IF NOT EXISTS event_reviewed_metadata (
  event_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);
