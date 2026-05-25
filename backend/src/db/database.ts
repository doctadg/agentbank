/**
 * Database Connection Manager
 *
 * SQLite connection with schema initialization.
 * Uses better-sqlite3 for synchronous, high-performance access.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import logger from '../core/logger';

let db: Database.Database | null = null;

/**
 * Initialize database connection and run schema migrations
 */
export function initDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath || process.env.DB_PATH || path.join(__dirname, '../../data/agentbank.db');

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Run schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  logger.info(`[Database] Initialized at ${resolvedPath}`);
  return db;
}

/**
 * Get the database instance (must call initDatabase first)
 */
export function getDb(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('[Database] Connection closed');
  }
}

/**
 * Save a trade to the database
 */
export function saveTrade(trade: {
  id: string;
  strategyId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  fee: number;
  pnl?: number;
  timestamp: Date;
  type: 'MARKET' | 'LIMIT';
  status: 'FILLED' | 'PARTIAL' | 'CANCELLED';
  entryExit: 'ENTRY' | 'EXIT';
  orderId?: string;
}): void {
  const d = getDb();
  d.prepare(`
    INSERT OR REPLACE INTO trades (id, strategy_id, symbol, side, size, price, fee, pnl, timestamp, type, status, entry_exit, order_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    trade.id,
    trade.strategyId || null,
    trade.symbol,
    trade.side,
    trade.size,
    trade.price,
    trade.fee,
    trade.pnl ?? null,
    trade.timestamp.toISOString(),
    trade.type,
    trade.status,
    trade.entryExit,
    trade.orderId || null
  );
}

/**
 * Get trades with optional filters
 */
export function getTrades(symbol?: string, limit: number = 100, offset: number = 0): any[] {
  const d = getDb();
  if (symbol) {
    return d.prepare(
      'SELECT * FROM trades WHERE symbol = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    ).all(symbol, limit, offset);
  }
  return d.prepare(
    'SELECT * FROM trades ORDER BY timestamp DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

/**
 * Get trade count
 */
export function getTradeCount(symbol?: string): number {
  const d = getDb();
  if (symbol) {
    const row = d.prepare('SELECT COUNT(*) as count FROM trades WHERE symbol = ?').get(symbol) as any;
    return row?.count ?? 0;
  }
  const row = d.prepare('SELECT COUNT(*) as count FROM trades').get() as any;
  return row?.count ?? 0;
}

/**
 * Save portfolio snapshot
 */
export function savePortfolioSnapshot(snapshot: {
  id: string;
  totalValue: number;
  availableBalance: number;
  usedBalance: number;
  dailyPnl: number;
  unrealizedPnl: number;
  timestamp: Date;
}): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO portfolio_snapshots (id, total_value, available_balance, used_balance, daily_pnl, unrealized_pnl, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    snapshot.id,
    snapshot.totalValue,
    snapshot.availableBalance,
    snapshot.usedBalance,
    snapshot.dailyPnl,
    snapshot.unrealizedPnl,
    snapshot.timestamp.toISOString()
  );
}

/**
 * Get portfolio performance over a period
 */
export function getPortfolioPerformance(period: string = '30d'): { totalPnL: number; tradeCount: number } {
  const d = getDb();
  let days = 30;
  const match = period.match(/(\d+)d/);
  if (match) days = parseInt(match[1]);

  const row = d.prepare(`
    SELECT COALESCE(SUM(pnl), 0) as totalPnL, COUNT(*) as tradeCount
    FROM trades
    WHERE timestamp >= datetime('now', '-${days} days')
      AND status IN ('FILLED', 'PARTIAL')
  `).get() as any;

  return {
    totalPnL: row?.totalPnL ?? 0,
    tradeCount: row?.tradeCount ?? 0,
  };
}

/**
 * Save an order to order history
 */
export function saveOrderHistory(order: {
  id: string;
  symbol: string;
  side: string;
  size: number;
  price?: number;
  orderType: string;
  status: string;
  exchangeOrderId?: string;
  filledPrice?: number;
  filledSize?: number;
  error?: string;
  submittedAt: Date;
  completedAt?: Date;
}): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO order_history (id, symbol, side, size, price, order_type, status, exchange_order_id, filled_price, filled_size, error, submitted_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id,
    order.symbol,
    order.side,
    order.size,
    order.price ?? null,
    order.orderType,
    order.status,
    order.exchangeOrderId ?? null,
    order.filledPrice ?? null,
    order.filledSize ?? null,
    order.error ?? null,
    order.submittedAt.toISOString(),
    order.completedAt?.toISOString() ?? null
  );
}

/**
 * Save a candle
 */
export function saveCandle(candle: {
  id: string;
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}): void {
  const d = getDb();
  d.prepare(`
    INSERT OR IGNORE INTO candles (id, symbol, timeframe, open, high, low, close, volume, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    candle.id, candle.symbol, candle.timeframe,
    candle.open, candle.high, candle.low, candle.close, candle.volume, candle.timestamp
  );
}

/**
 * Get candles
 */
export function getCandles(symbol: string, timeframe: string, limit: number = 100): any[] {
  const d = getDb();
  return d.prepare(
    'SELECT * FROM candles WHERE symbol = ? AND timeframe = ? ORDER BY timestamp DESC LIMIT ?'
  ).all(symbol, timeframe, limit);
}

/**
 * Log a system event
 */
export function logSystemEvent(event: {
  id: string;
  eventType: string;
  source: string;
  severity?: string;
  message?: string;
  data?: string;
  timestamp: Date;
}): void {
  const d = getDb();
  d.prepare(`
    INSERT INTO system_events (id, event_type, source, severity, message, data, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id, event.eventType, event.source,
    event.severity || 'info', event.message || null,
    event.data || null, event.timestamp.toISOString()
  );
}
