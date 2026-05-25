import { getDb } from '../db';
import crypto from 'crypto';
import { config } from '../config';
import { getAllHolders as fetchHoldersFromHelius, type HolderBalance } from '../holder/helius';

/**
 * Snapshot today's holder balances.
 * - If ABANK_MINT env is set, reads real holders from Helius.
 * - Otherwise, falls back to the seeded mock holders (initial run) or
 *   slightly varies existing holders (subsequent runs).
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
    // First snapshot — seed with mock holders
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
      const id = crypto.randomUUID();
      db.prepare('INSERT OR IGNORE INTO holder_snapshots (id, public_key, balance, snapshot_date) VALUES (?, ?, ?, ?)')
        .run(id, h.pk, h.bal, today);
      count++;
    }
  } else {
    // Update existing holders with slight balance variations (mock)
    for (const { public_key } of existing) {
      const prev = db.prepare(
        'SELECT balance FROM holder_snapshots WHERE public_key = ? ORDER BY snapshot_date DESC LIMIT 1'
      ).get(public_key) as { balance: number } | undefined;

      if (prev && prev.balance > 0) {
        const delta = (Math.random() - 0.4) * 0.05; // slight upward bias
        const newBal = Math.max(0, Math.round(prev.balance * (1 + delta)));
        const id = crypto.randomUUID();
        db.prepare('INSERT OR IGNORE INTO holder_snapshots (id, public_key, balance, snapshot_date) VALUES (?, ?, ?, ?)')
          .run(id, public_key, newBal, today);
        count++;
      }
    }
  }

  // Update vault state
  const holderCount = (db.prepare("SELECT COUNT(DISTINCT public_key) as c FROM holder_snapshots WHERE snapshot_date = ?").get(today) as any).c;
  const now = new Date().toISOString();
  db.prepare('UPDATE vault_state SET total_holders = ?, last_snapshot_at = ?, updated_at = ? WHERE id = 1')
    .run(holderCount, now, now);

  const totalBalance = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM holder_snapshots WHERE snapshot_date = ?").get(today) as any).t;

  return { date: today, holdersSnapshotted: count, totalBalance, holderCount, source: 'mock' };
}

/** Distribute rewards proportional to holding_days * avg_balance */
export function distributeRewards(totalAmount: number, notes?: string) {
  const db = getDb();
  const distId = crypto.randomUUID();

  return db.transaction(() => {
    // Get all current holders with their stats
    const holders = db.prepare(`
      SELECT
        h.public_key,
        h.balance,
        (SELECT COUNT(DISTINCT snapshot_date) FROM holder_snapshots WHERE public_key = h.public_key) as holding_days,
        (SELECT AVG(balance) FROM holder_snapshots WHERE public_key = h.public_key) as avg_balance
      FROM holder_snapshots h
      INNER JOIN (
        SELECT public_key, MAX(snapshot_date) as max_date
        FROM holder_snapshots
        GROUP BY public_key
      ) latest ON h.public_key = latest.public_key AND h.snapshot_date = latest.max_date
      WHERE h.balance > 0
    `).all() as { public_key: string; balance: number; holding_days: number; avg_balance: number }[];

    if (holders.length === 0) throw new Error('No holders to distribute to');

    // Calculate weights
    const weights = holders.map(h => h.holding_days * h.avg_balance);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) throw new Error('Total weight is zero');

    // Create distribution
    db.prepare('INSERT INTO distributions (id, total_amount, holder_count, notes) VALUES (?, ?, ?, ?)')
      .run(distId, totalAmount, holders.length, notes || null);

    // Create reward records
    let distributed = 0;
    for (let i = 0; i < holders.length; i++) {
      const amount = Math.round((weights[i] / totalWeight) * totalAmount * 100) / 100;
      if (amount <= 0) continue;
      db.prepare('INSERT INTO reward_records (id, distribution_id, public_key, amount, holding_days, avg_balance) VALUES (?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), distId, holders[i].public_key, amount, holders[i].holding_days, Math.round(holders[i].avg_balance * 100) / 100);
      distributed += amount;
    }

    // Update vault
    const distNow = new Date().toISOString();
    db.prepare('UPDATE vault_state SET total_distributed = total_distributed + ?, last_distribution_at = ?, updated_at = ? WHERE id = 1')
      .run(distributed, distNow, distNow);

    return { distributionId: distId, totalDistributed: distributed, holderCount: holders.length, totalAmount };
  })();
}

export function getAdminStats() {
  const db = getDb();
  const vault = db.prepare('SELECT * FROM vault_state WHERE id = 1').get() as any;
  const recentDists = db.prepare('SELECT * FROM distributions ORDER BY created_at DESC LIMIT 5').all();
  return { ...vault, recentDistributions: recentDists };
}

export function getAllHolders() {
  const db = getDb();
  return db.prepare(`
    SELECT
      h.public_key,
      h.balance as current_balance,
      (SELECT COUNT(DISTINCT snapshot_date) FROM holder_snapshots WHERE public_key = h.public_key) as holding_days,
      (SELECT AVG(balance) FROM holder_snapshots WHERE public_key = h.public_key) as avg_balance,
      (SELECT COALESCE(SUM(amount), 0) FROM reward_records WHERE public_key = h.public_key) as total_rewards,
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
