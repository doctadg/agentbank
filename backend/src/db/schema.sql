-- AgentBank Database Schema

-- Auth / User tables
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  public_key TEXT UNIQUE NOT NULL,
  balance REAL DEFAULT 0,
  staked_amount REAL DEFAULT 0,
  pending_rewards REAL DEFAULT 0,
  total_earned REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('stake', 'unstake', 'claim', 'distribution')),
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  tx_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vault_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  total_staked REAL DEFAULT 0,
  total_profit REAL DEFAULT 0,
  apy REAL DEFAULT 0,
  total_distributions REAL DEFAULT 0,
  last_distribution_at TEXT
);

CREATE TABLE IF NOT EXISTS nonces (
  public_key TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expires_at);

-- Market data tables (from PerpsTrader)
CREATE TABLE IF NOT EXISTS market_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL DEFAULT 0,
  vwap REAL,
  bid REAL,
  ask REAL,
  bidSize REAL,
  askSize REAL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_symbol_time ON market_data(symbol, timestamp);

CREATE TABLE IF NOT EXISTS order_book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  bids TEXT NOT NULL,
  asks TEXT NOT NULL,
  midPrice REAL NOT NULL,
  spread REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS market_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  price REAL NOT NULL,
  size REAL NOT NULL,
  side TEXT NOT NULL,
  symbol TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS funding_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  fundingRate REAL NOT NULL,
  nextFundingTime INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tracked_symbols (
  symbol TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  volume24h REAL DEFAULT 0,
  maxLeverage REAL,
  szDecimals INTEGER,
  onlyIsolated INTEGER DEFAULT 0,
  isActive INTEGER DEFAULT 1,
  firstSeen INTEGER,
  lastUpdated INTEGER
);

CREATE TABLE IF NOT EXISTS symbol_ingestion_health (
  symbol TEXT PRIMARY KEY,
  lastMarketDataTs INTEGER DEFAULT 0,
  lastQuoteTs INTEGER DEFAULT 0,
  lastTradeTs INTEGER DEFAULT 0,
  dataPoints INTEGER DEFAULT 0,
  updatedAt INTEGER NOT NULL
);

-- Trading execution tables
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  strategy_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  size REAL NOT NULL,
  price REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  pnl REAL DEFAULT 0,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'MARKET',
  status TEXT NOT NULL DEFAULT 'FILLED',
  entry_exit TEXT,
  order_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  client_order_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  size REAL NOT NULL,
  price REAL,
  order_type TEXT NOT NULL DEFAULT 'limit',
  status TEXT NOT NULL DEFAULT 'PENDING',
  filled_price REAL,
  filled_size REAL,
  confidence REAL,
  reduce_only INTEGER DEFAULT 0,
  submitted_at TEXT,
  filled_at TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- System events (used by paper portfolio for state persistence)
CREATE TABLE IF NOT EXISTS system_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source TEXT,
  severity TEXT DEFAULT 'info',
  data TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);

-- Initialize vault state row
INSERT OR IGNORE INTO vault_state (id, total_staked, total_profit, apy) VALUES (1, 0, 0, 0);
