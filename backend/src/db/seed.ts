import { getDb, closeDb } from './index';
import crypto from 'crypto';

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

  // Users for all holders
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

  db.prepare('INSERT OR IGNORE INTO admin_keys (key) VALUES (?)').run('abank-admin-dev-key');

  const nowStr = new Date().toISOString();
  db.prepare('UPDATE vault_state SET total_holders = ?, last_snapshot_at = ? WHERE id = 1')
    .run(HOLDERS.length, nowStr);

  closeDb();
  console.log(`Database seeded`);
  console.log(`  - ${HOLDERS.length} holders`);
  console.log(`  - 30 days of snapshots`);
  console.log(`  - Admin key: abank-admin-dev-key`);
}

run();
