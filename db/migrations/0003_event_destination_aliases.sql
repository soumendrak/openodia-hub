-- Automatic redirect observations are separate from human-reviewed metadata.
CREATE TABLE IF NOT EXISTS event_destination_aliases (
  alias_url TEXT PRIMARY KEY,
  destination_url TEXT,
  checked_at TEXT NOT NULL
);
