-- USERS
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- DEBTS
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('I_OWE','OWED_TO_ME')),
  title TEXT NOT NULL,
  counterparty_name TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  principal_cents INTEGER NOT NULL,
  due_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PAID','CLOSED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

-- SHARES / INVITES
CREATE TABLE IF NOT EXISTS debt_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL,
  owner_user_id INTEGER NOT NULL,
  counterparty_user_id INTEGER,
  invite_token_hash TEXT NOT NULL,
  invite_expires_at TEXT,
  can_confirm INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  UNIQUE(debt_id),
  FOREIGN KEY (debt_id) REFERENCES debts(id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id),
  FOREIGN KEY (counterparty_user_id) REFERENCES users(id)
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL,
  created_by_user_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT NOT NULL,
  note TEXT,
  confirmation_status TEXT NOT NULL DEFAULT 'CONFIRMED'
    CHECK(confirmation_status IN ('NONE','PENDING','CONFIRMED','REJECTED')),
  confirmed_by_user_id INTEGER,
  confirmed_at TEXT,
  confirmation_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (debt_id) REFERENCES debts(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_debts_owner ON debts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shares_counterparty ON debt_shares(counterparty_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_debt ON payments(debt_id);
