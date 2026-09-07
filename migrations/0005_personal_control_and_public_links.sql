-- Personal-control mode: the owner can record movements without waiting for a counterparty.
-- Public links are read-only, revocable bearer links; only their hashes are stored.

ALTER TABLE debts ADD COLUMN requires_confirmation INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS debt_public_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (debt_id) REFERENCES debts(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_debt_public_links_token
  ON debt_public_links(token_hash);
