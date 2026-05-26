import { getDb } from '../db';
import { AgentAction, PaperPosition, PaperTrade } from './types';

// ─── Cursors (last seen leader fill, for restart safety) ─
export function getCursor(wallet: string): { last_tid: number; last_ts: number } | null {
  const db = getDb();
  return db.prepare('SELECT last_tid, last_ts FROM paper_cursors WHERE source_wallet = ?').get(wallet.toLowerCase()) as any || null;
}

export function setCursor(wallet: string, tid: number, ts: number) {
  const db = getDb();
  db.prepare(`INSERT INTO paper_cursors (source_wallet, last_tid, last_ts) VALUES (?, ?, ?)
              ON CONFLICT(source_wallet) DO UPDATE SET last_tid = excluded.last_tid, last_ts = excluded.last_ts`)
    .run(wallet.toLowerCase(), tid, ts);
}

export function tradeExistsForTid(wallet: string, tid: number): boolean {
  const db = getDb();
  const r = db.prepare('SELECT 1 FROM paper_trades WHERE source_wallet = ? AND source_tid = ? LIMIT 1')
    .get(wallet.toLowerCase(), tid);
  return !!r;
}

// ─── Positions ─────────────────────────────────────────
export function findOpenPosition(wallet: string, coin: string, side: 'long' | 'short'): PaperPosition | null {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM paper_positions WHERE source_wallet = ? AND coin = ? AND side = ? AND is_open = 1 ORDER BY id DESC LIMIT 1'
  ).get(wallet.toLowerCase(), coin, side) as any || null;
}

export function openPosition(input: {
  wallet: string; coin: string; side: 'long' | 'short';
  sz: number; entryPx: number; notional: number; openedAt: number;
}): number {
  const db = getDb();
  const r = db.prepare(
    `INSERT INTO paper_positions (source_wallet, coin, side, sz, entry_px, notional, opened_at, is_open)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(input.wallet.toLowerCase(), input.coin, input.side, input.sz, input.entryPx, input.notional, input.openedAt);
  return r.lastInsertRowid as number;
}

export function reducePosition(positionId: number, closedSz: number, closePx: number, realized: number, closedAt: number) {
  const db = getDb();
  const pos = db.prepare('SELECT * FROM paper_positions WHERE id = ?').get(positionId) as PaperPosition | undefined;
  if (!pos) return;
  const remaining = pos.sz - closedSz;
  if (remaining <= 0.0000001) {
    db.prepare(`UPDATE paper_positions SET is_open = 0, sz = 0, closed_at = ?, close_px = ?, realized_pnl = realized_pnl + ? WHERE id = ?`)
      .run(closedAt, closePx, realized, positionId);
  } else {
    db.prepare(`UPDATE paper_positions SET sz = ?, realized_pnl = realized_pnl + ? WHERE id = ?`)
      .run(remaining, realized, positionId);
  }
}

export function listOpenPositions(): PaperPosition[] {
  const db = getDb();
  return db.prepare('SELECT * FROM paper_positions WHERE is_open = 1 ORDER BY opened_at DESC').all() as any;
}

// ─── Trades log ────────────────────────────────────────
export function recordTrade(t: Omit<PaperTrade, 'id'>): number {
  const db = getDb();
  const r = db.prepare(
    `INSERT INTO paper_trades
      (ts, source_wallet, source_tid, coin, action, source_px, source_sz, source_notional,
       leader_acct_value, leader_pct, vault_acct_value,
       mirror_sz, mirror_notional, mirror_px, realized_pnl, position_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    t.ts, t.source_wallet.toLowerCase(), t.source_tid, t.coin, t.action,
    t.source_px, t.source_sz, t.source_notional,
    t.leader_acct_value, t.leader_pct, t.vault_acct_value,
    t.mirror_sz, t.mirror_notional, t.mirror_px,
    t.realized_pnl, t.position_id, t.notes,
  );
  return r.lastInsertRowid as number;
}

export function listRecentTrades(limit = 100): PaperTrade[] {
  const db = getDb();
  return db.prepare('SELECT * FROM paper_trades ORDER BY ts DESC LIMIT ?').all(limit) as any;
}

// ─── Stats ─────────────────────────────────────────────
export function getAggregateStats() {
  const db = getDb();
  const tradeCount = (db.prepare('SELECT COUNT(*) as c FROM paper_trades').get() as any).c as number;
  const closedRow = db.prepare(
    `SELECT COUNT(*) as c, COALESCE(SUM(realized_pnl), 0) as pnl
     FROM paper_trades WHERE realized_pnl IS NOT NULL`
  ).get() as any;
  const closedCount = closedRow.c as number;
  const realizedPnl = closedRow.pnl as number;
  const winRow = db.prepare(
    `SELECT COUNT(*) as c FROM paper_trades WHERE realized_pnl IS NOT NULL AND realized_pnl > 0`
  ).get() as any;
  const wins = winRow.c as number;
  const openRow = db.prepare(`SELECT COUNT(*) as c FROM paper_positions WHERE is_open = 1`).get() as any;
  const openPositions = openRow.c as number;
  const lastTrade = db.prepare('SELECT ts FROM paper_trades ORDER BY ts DESC LIMIT 1').get() as { ts: number } | undefined;

  return {
    tradeCount,
    closedCount,
    openPositions,
    wins,
    losses: closedCount - wins,
    winRate: closedCount > 0 ? wins / closedCount : 0,
    realizedPnl,
    lastTradeAt: lastTrade?.ts ?? null,
  };
}

// ─── Equity timeseries ─────────────────────────────────
export function snapshotEquity(realized: number, unrealized: number, startingEquity: number) {
  const db = getDb();
  const equity = startingEquity + realized + unrealized;
  db.prepare(
    'INSERT OR REPLACE INTO paper_equity (ts, realized, unrealized, equity) VALUES (?, ?, ?, ?)'
  ).run(Date.now(), realized, unrealized, equity);
}

export function getEquityHistory(limit = 500): Array<{ ts: number; realized: number; unrealized: number; equity: number }> {
  const db = getDb();
  return db.prepare('SELECT * FROM paper_equity ORDER BY ts ASC LIMIT ?').all(limit) as any;
}
