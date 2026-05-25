import { getDb } from '../db';
import crypto from 'crypto';
import { config } from '../config';
import { getAllHolders as fetchHoldersFromHelius, type HolderBalance } from '../holder/helius';

/**
 * Snapshot today's holder balances.
 * - If ABANK_MINT env is set, reads real holders from Helius.
 * - Otherwise, falls back to a seeded mock holder list (initial run) or
 *   slightly varies existing holders (subsequent runs) so the demo dashboard
 *   stays alive pre-launch.
 */
export async function snapshotHolders() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // ─── Real mode: Helius ─────────────────────────────
  if (config.abankMint) {
    const holders: HolderBalance[] = await fetchHoldersFromHelius(config.abankMint);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO holder_snapshots (id, public_key, balance, snapshot_date) VALUES (?, ?, ?, ?)',
    );
    const tx = db.transaction((rows: HolderBalance[]) => {
      for (const h of rows) insert.run(crypto.randomUUID(), h.owner, h.balance, today);
    });
    tx(holders);

    const totalBalance = holders.reduce((s, h) => s + h.balance, 0);
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE vault_state SET total_holders = ?, last_snapshot_at = ?, updated_at = ? WHERE id = 1',
    ).run(holders.length, now, now);

    return {
      date: today,
      holdersSnapshotted: holders.length,
      totalBalance,
      holderCount: holders.length,
      source: 'helius',
      mint: config.abankMint,
    };
  }

  // ─── Mock mode: seeded list + variance ─────────────
  const existing = db.prepare(
    'SELECT DISTINCT public_key FROM holder_snapshots',
  ).all() as { public_key: string }[];

  let count = 0;

  if (existing.length === 0) {
    const mockHolders = [
      { pk: '9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYYJ7b', bal: 487000 },
      { pk: 'DYW8H3fds9T9anZs2GCrHbKkPeXwaY8fSREqRc58oGZj', bal: 245000 },
      { pk: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', bal: 156000 },
      { pk: 'BkNs6sSNYjB9vDsJeMBKqNEcGqJgEJnHSnRq8GJoLnQr', bal: 98400 },
      { pk: 'GHr4yVsiSv8cTwOBBZgJqoGASfE56cBzqH6JkAk9AuRJ', bal: 73200 },
      { pk: '2qRnPuiw3s1e7nStxX2oDzAIpFcKZsNXB5m4WjkQAbZS', bal: 51800 },
      { pk: 'FcR6rMNXx2W9gXE3SQUHHRXWb7hVcZsK5TaxqsMTUvAH', bal: 42100 },
      { pk: 'DjVE6JBiUhNjvEuSowWpAJTbPpH9yZzVJbxkaaLAzGTH', bal: 38600 },
      { pk: 'HN7cRAq4vHiJVBkUG6KvGBgG28ELSK1FHY9vFB7wMUPG', bal: 25400 },
      { pk: 'AxNGmSbwdJsoahLuGdqp9aP8YwzQdGo5AVBaGMHvwpXn', bal: 18900 },
      { pk: '5TonZtQZk8Nn4GEeaXcjCWMg7GMRwSLqGebXBg2CnBBP', bal: 15200 },
      { pk: 'Cwsd5LJ7vJFQKaFrboKmL5Me7V3MgJHMsSGHzcnqVRJh', bal: 11700 },
      { pk: 'EkNDVpXSnHPiJD6VE2HxQ6nGE2uE7Vd3XEPmN77vFY2K', bal: 8300 },
      { pk: 'J1tV3P3aLT6vfy44MMqFYC27bUzB5pQDFXqKLiVaoxBy', bal: 5600 },
      { pk: 'Lkp5fmKaVNBnJPoKuZSjCsnYqLPnHnBGTxAqyhy4SuGZ', bal: 3200 },
      { pk: 'N8TwYWH2rE6PdiXJJ9sNGvdVPWYrLzZgfysBKeA2ob8H', bal: 1800 },
      { pk: 'PRsNjGqFMkFrJ5b5LyRvQ3vsqVnBGqL2MhVS1eQK4pEc', bal: 950 },
      { pk: 'Rf6S7jWbYRTpM7F5f4xAQH7RzBz1SyTMHmXRvQsKyxLK', bal: 420 },
      { pk: 'UdMBBjKNYKP3qFAZN3mUhYQxZev9uaUvkFAjT3yXbTT2', bal: 150 },
      { pk: 'WxjFW6UAvXLaEY3CsfwYVQMRtAfC7SyFWfbFLfeLbSKm', bal: 80 },
    ];
    for (const h of mockHolders) {
      db.prepare('INSERT OR IGNORE INTO holder_snapshots (id, public_key, balance, snapshot_date) VALUES (?, ?, ?, ?)')
        .run(crypto.randomUUID(), h.pk, h.bal, today);
      count++;
    }
  } else {
    for (const { public_key } of existing) {
      const prev = db.prepare(
        'SELECT balance FROM holder_snapshots WHERE public_key = ? ORDER BY snapshot_date DESC LIMIT 1',
      ).get(public_key) as { balance: number } | undefined;
      if (prev && prev.balance > 0) {
        const delta = (Math.random() - 0.4) * 0.05;
        const newBal = Math.max(0, Math.round(prev.balance * (1 + delta)));
        db.prepare('INSERT OR IGNORE INTO holder_snapshots (id, public_key, balance, snapshot_date) VALUES (?, ?, ?, ?)')
          .run(crypto.randomUUID(), public_key, newBal, today);
        count++;
      }
    }
  }

  const holderCount = (db.prepare("SELECT COUNT(DISTINCT public_key) as c FROM holder_snapshots WHERE snapshot_date = ?").get(today) as any).c;
  const now = new Date().toISOString();
  db.prepare('UPDATE vault_state SET total_holders = ?, last_snapshot_at = ?, updated_at = ? WHERE id = 1')
    .run(holderCount, now, now);

  const totalBalance = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM holder_snapshots WHERE snapshot_date = ?").get(today) as any).t;
  return { date: today, holdersSnapshotted: count, totalBalance, holderCount, source: 'mock' };
}

/** Wipes all holder data + vault state. Use before flipping to real ABANK_MINT. */
export function resetData() {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM holder_snapshots').run();
    db.prepare('UPDATE vault_state SET total_holders = 0, last_snapshot_at = NULL, updated_at = ? WHERE id = 1')
      .run(new Date().toISOString());
  });
  tx();
  return { reset: true, at: new Date().toISOString() };
}

export function getAdminStats() {
  const db = getDb();
  const vault = db.prepare('SELECT * FROM vault_state WHERE id = 1').get() as any;
  return vault;
}

export function getAllHolders() {
  const db = getDb();
  return db.prepare(`
    SELECT
      h.public_key,
      h.balance as current_balance,
      (SELECT COUNT(DISTINCT snapshot_date) FROM holder_snapshots WHERE public_key = h.public_key) as holding_days,
      (SELECT AVG(balance) FROM holder_snapshots WHERE public_key = h.public_key) as avg_balance,
      (SELECT MIN(snapshot_date) FROM holder_snapshots WHERE public_key = h.public_key) as holding_since
    FROM holder_snapshots h
    INNER JOIN (
      SELECT public_key, MAX(snapshot_date) as max_date
      FROM holder_snapshots GROUP BY public_key
    ) latest ON h.public_key = latest.public_key AND h.snapshot_date = latest.max_date
    WHERE h.balance > 0
    ORDER BY h.balance DESC
  `).all();
}
