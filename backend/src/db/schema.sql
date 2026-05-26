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
CREATE TABLE IF NOT EXISTS vault_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  total_holders INTEGER DEFAULT 0,
  total_supply REAL DEFAULT 1000000000,
  last_snapshot_at TEXT,
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

-- ────────────────────────────────────────────────────────────────
-- AGENT (paper copy-trading)
-- ────────────────────────────────────────────────────────────────

-- Every fill we mirror generates one row here (open OR close).
CREATE TABLE IF NOT EXISTS paper_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,              -- ms epoch
  source_wallet TEXT NOT NULL,
  source_tid INTEGER NOT NULL,      -- leader fill trade id (idempotency)
  coin TEXT NOT NULL,
  action TEXT NOT NULL,             -- 'open_long' | 'open_short' | 'close_long' | 'close_short' | 'reduce'
  source_px REAL NOT NULL,
  source_sz REAL NOT NULL,
  source_notional REAL NOT NULL,
  leader_acct_value REAL NOT NULL,  -- leader's account value at fill time
  leader_pct REAL NOT NULL,         -- source_notional / leader_acct_value
  vault_acct_value REAL NOT NULL,   -- our vault at fill time
  mirror_sz REAL NOT NULL,          -- our position size in base asset
  mirror_notional REAL NOT NULL,    -- USD notional we entered/exited
  mirror_px REAL NOT NULL,          -- entry/exit price we used (= source_px for paper)
  realized_pnl REAL,                -- non-null only when this trade closes/reduces a position
  position_id INTEGER,              -- FK into paper_positions for open events, or the closed one for closes
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_paper_trades_ts ON paper_trades(ts DESC);
CREATE INDEX IF NOT EXISTS idx_paper_trades_source_tid ON paper_trades(source_tid);
CREATE INDEX IF NOT EXISTS idx_paper_trades_coin ON paper_trades(coin);

-- Currently-open paper positions. Closed positions get is_open=0 and closed_at filled.
CREATE TABLE IF NOT EXISTS paper_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_wallet TEXT NOT NULL,
  coin TEXT NOT NULL,
  side TEXT NOT NULL,               -- 'long' | 'short'
  sz REAL NOT NULL,                 -- base asset size
  entry_px REAL NOT NULL,
  notional REAL NOT NULL,           -- USD at entry
  opened_at INTEGER NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 1,
  closed_at INTEGER,
  close_px REAL,
  realized_pnl REAL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_paper_pos_open ON paper_positions(is_open, source_wallet, coin);

-- Vault equity timeseries (sampled every N minutes by the router).
CREATE TABLE IF NOT EXISTS paper_equity (
  ts INTEGER PRIMARY KEY,
  realized REAL NOT NULL,           -- cumulative closed PnL
  unrealized REAL NOT NULL,         -- mark-to-market of open positions
  equity REAL NOT NULL              -- starting capital + realized + unrealized
);

-- Watermark of last processed leader fill per wallet (for restart-safety).
CREATE TABLE IF NOT EXISTS paper_cursors (
  source_wallet TEXT PRIMARY KEY,
  last_tid INTEGER NOT NULL,
  last_ts INTEGER NOT NULL
);
