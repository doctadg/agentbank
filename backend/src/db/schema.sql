CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  public_key TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS holder_snapshots (
  id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  balance REAL NOT NULL,
  snapshot_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(public_key, snapshot_date)
);
CREATE TABLE IF NOT EXISTS distributions (
  id TEXT PRIMARY KEY,
  total_amount REAL NOT NULL,
  holder_count INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS reward_records (
  id TEXT PRIMARY KEY,
  distribution_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  amount REAL NOT NULL,
  holding_days INTEGER NOT NULL,
  avg_balance REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (distribution_id) REFERENCES distributions(id)
);
CREATE TABLE IF NOT EXISTS vault_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  total_distributed REAL DEFAULT 0,
  total_holders INTEGER DEFAULT 0,
  total_supply REAL DEFAULT 1000000000,
  last_snapshot_at TEXT,
  last_distribution_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO vault_state (id) VALUES (1);
CREATE TABLE IF NOT EXISTS nonces (
  public_key TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_keys (
  key TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snapshots_public_key ON holder_snapshots(public_key);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON holder_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_reward_records_distribution ON reward_records(distribution_id);
CREATE INDEX IF NOT EXISTS idx_reward_records_public_key ON reward_records(public_key);
