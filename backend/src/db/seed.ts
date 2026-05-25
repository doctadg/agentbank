import { getDb, closeDb } from './index';
import crypto from 'crypto';

function randomBase58(len: number): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let r = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) r += chars[bytes[i] % chars.length];
  return r;
}

function randomTxHash(): string {
  return crypto.randomBytes(32).toString('hex');
}

const HOLDERS = [
  { pk: '9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYYJ7b', base: 487000 },
  { pk: 'DYW8H3fds9T9anZs2GCrHbKkPeXwaY8fSREqRc58oGZj', base: 245000 },
  { pk: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', base: 156000 },
  { pk: 'BkNs6sSNYjB9vDsJeMBKqNEcGqJgEJnHSnRq8GJoLnQr', base: 98400 },
  { pk: 'GHr4yVsiSv8cTwOBBZgJqoGASfE56cBzqH6JkAk9AuRJ', base: 73200 },
  { pk: '2qRnPuiw3s1e7nStxX2oDzAIpFcKZsNXB5m4WjkQAbZS', base: 51800 },
  { pk: 'FcR6rMNXx2W9gXE3SQUHHRXWb7hVcZsK5TaxqsMTUvAH', base: 42100 },
  { pk: 'DjVE6JBiUhNjvEuSowWpAJTbPpH9yZzVJbxkaaLAzGTH', base: 38600 },
  { pk: 'HN7cRAq4vHiJVBkUG6KvGBgG28ELSK1FHY9vFB7wMUPG', base: 25400 },
  { pk: 'AxNGmSbwdJsoahLuGdqp9aP8YwzQdGo5AVBaGMHvwpXn', base: 18900 },
  { pk: '5TonZtQZk8Nn4GEeaXcjCWMg7GMRwSLqGebXBg2CnBBP', base: 15200 },
  { pk: 'Cwsd5LJ7vJFQKaFrboKmL5Me7V3MgJHMsSGHzcnqVRJh', base: 11700 },
  { pk: 'EkNDVpXSnHPiJD6VE2HxQ6nGE2uE7Vd3XEPmN77vFY2K', base: 8300 },
  { pk: 'J1tV3P3aLT6vfy44MMqFYC27bUzB5pQDFXqKLiVaoxBy', base: 5600 },
  { pk: 'Lkp5fmKaVNBnJPoKuZSjCsnYqLPnHnBGTxAqyhy4SuGZ', base: 3200 },
  { pk: 'N8TwYWH2rE6PdiXJJ9sNGvdVPWYrLzZgfysBKeA2ob8H', base: 1800 },
  { pk: 'PRsNjGqFMkFrJ5b5LyRvQ3vsqVnBGqL2MhVS1eQK4pEc', base: 950 },
  { pk: 'Rf6S7jWbYRTpM7F5f4xAQH7RzBz1SyTMHmXRvQsKyxLK', base: 420 },
  { pk: 'UdMBBjKNYKP3qFAZN3mUhYQxZev9uaUvkFAjT3yXbTT2', base: 150 },
  { pk: 'WxjFW6UAvXLaEY3CsfwYVQMRtAfC7SyFWfbFLfeLbSKm', base: 80 },
];

function run() {
  const db = getDb();

  // Create users for all holders
  for (const h of HOLDERS) {
    db.prepare('INSERT OR IGNORE INTO users (id, public_key) VALUES (?, ?)')
      .run(crypto.randomUUID(), h.pk);
  }

  // 30 days of snapshots
  const now = Date.now();
  for (let d = 29; d >= 0; d--) {
    const date = new Date(now - d * 86400000).toISOString().split('T')[0];
    for (const h of HOLDERS) {
      const delta = (Math.random() - 0.45) * 0.03;
      const bal = Math.round(h.base * (1 + delta));
      db.prepare('INSERT OR IGNORE INTO holder_snapshots (id, public_key, balance, snapshot_date) VALUES (?, ?, ?, ?)')
        .run(crypto.randomUUID(), h.pk, bal, date);
    }
  }

  // 3 past distributions
  const distributions = [
    { amount: 5000, daysAgo: 21, notes: 'Weekly distribution #1' },
    { amount: 3200, daysAgo: 14, notes: 'Weekly distribution #2' },
    { amount: 6800, daysAgo: 7, notes: 'Weekly distribution #3' },
  ];

  for (const dist of distributions) {
    const distId = crypto.randomUUID();
    const createdAt = new Date(now - dist.daysAgo * 86400000).toISOString();

    // Calculate weights at that point
    const holders = db.prepare(`
      SELECT public_key, AVG(balance) as avg_bal, COUNT(*) as days
      FROM holder_snapshots
      WHERE snapshot_date <= ?
      GROUP BY public_key
    `).all(createdAt.split('T')[0]) as { public_key: string; avg_bal: number; days: number }[];

    const weights = holders.map(h => h.days * h.avg_bal);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) continue;

    db.prepare('INSERT INTO distributions (id, total_amount, holder_count, notes, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(distId, dist.amount, holders.length, dist.notes, createdAt);

    for (let i = 0; i < holders.length; i++) {
      const amt = Math.round((weights[i] / totalWeight) * dist.amount * 100) / 100;
      if (amt <= 0) continue;
      db.prepare('INSERT INTO reward_records (id, distribution_id, public_key, amount, holding_days, avg_balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), distId, holders[i].public_key, amt, holders[i].days, Math.round(holders[i].avg_bal), createdAt);
    }
  }

  // Admin key
  db.prepare('INSERT OR IGNORE INTO admin_keys (key) VALUES (?)').run('abank-admin-dev-key');

  // Update vault state
  const totalDist = (db.prepare('SELECT COALESCE(SUM(total_amount), 0) as t FROM distributions').get() as any).t;
  const holderCount = HOLDERS.length;
  const nowStr = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  db.prepare('UPDATE vault_state SET total_distributed = ?, total_holders = ?, last_snapshot_at = ?, last_distribution_at = ? WHERE id = 1')
    .run(totalDist, holderCount, nowStr, weekAgo);

  closeDb();
  console.log(`Database seeded`);
  console.log(`  - ${HOLDERS.length} holders`);
  console.log(`  - 30 days of snapshots`);
  console.log(`  - 3 distributions totaling $${totalDist}`);
  console.log(`  - Admin key: abank-admin-dev-key`);
}

run();
