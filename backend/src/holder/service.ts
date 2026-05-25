import { getDb } from '../db';
import { HolderSnapshot } from '../types';
import crypto from 'crypto';

export function getHolderPosition(publicKey: string) {
  const db = getDb();

  // Latest balance
  const latest = db.prepare(
    'SELECT * FROM holder_snapshots WHERE public_key = ? ORDER BY snapshot_date DESC LIMIT 1'
  ).get(publicKey) as HolderSnapshot | undefined;

  if (!latest) return null;

  // First snapshot (holding since)
  const first = db.prepare(
    'SELECT snapshot_date FROM holder_snapshots WHERE public_key = ? ORDER BY snapshot_date ASC LIMIT 1'
  ).get(publicKey) as { snapshot_date: string } | undefined;

  // Average balance
  const avg = db.prepare(
    'SELECT AVG(balance) as avg_balance FROM holder_snapshots WHERE public_key = ?'
  ).get(publicKey) as { avg_balance: number };

  // Holding days
  const holdingSince = first?.snapshot_date || latest.snapshot_date;
  const holdingDays = Math.max(1, Math.floor((Date.now() - new Date(holdingSince).getTime()) / 86400000));

  return {
    publicKey,
    balance: latest.balance,
    holdingSince,
    holdingDays,
    avgBalance: Math.round(avg.avg_balance * 100) / 100,
  };
}

export function getLeaderboard(limit = 50) {
  const db = getDb();
  // Get each holder's latest balance
  const holders = db.prepare(`
    SELECT h.public_key, h.balance, h.snapshot_date
    FROM holder_snapshots h
    INNER JOIN (
      SELECT public_key, MAX(snapshot_date) as max_date
      FROM holder_snapshots
      GROUP BY public_key
    ) latest ON h.public_key = latest.public_key AND h.snapshot_date = latest.max_date
    WHERE h.balance > 0
    ORDER BY h.balance DESC
    LIMIT ?
  `).all(limit) as { public_key: string; balance: number; snapshot_date: string }[];

  return holders.map((h, i) => ({
    rank: i + 1,
    publicKey: h.public_key,
    balance: h.balance,
    lastSeen: h.snapshot_date,
  }));
}

export function getHolderHistory(publicKey: string, limit = 30) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM holder_snapshots WHERE public_key = ? ORDER BY snapshot_date DESC LIMIT ?'
  ).all(publicKey, limit);
}
