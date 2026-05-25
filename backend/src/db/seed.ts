import { getDb, closeDb } from './index';
import crypto from 'crypto';

function randomTxHash(): string {
  return crypto.randomBytes(32).toString('hex');
}

function main() {
  const db = getDb();

  // Clear existing data
  db.exec('DELETE FROM transactions');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM vault_state');

  // Insert 5 mock users with realistic Solana-like public keys
  const users = [
    {
      id: crypto.randomUUID(),
      public_key: 'DRpbCBMhcvdjVpmGiPZQAbZn6gGjw9EZ3mhheGcPTQKo',
      balance: 5000,
      staked_amount: 12000,
      pending_rewards: 340.5,
      total_earned: 1200.0,
    },
    {
      id: crypto.randomUUID(),
      public_key: 'CcYNtnXiNMQdoYgPCrV3AuVMRPWVbnYMK6vKbpFmVSXa',
      balance: 8000,
      staked_amount: 7500,
      pending_rewards: 180.75,
      total_earned: 640.0,
    },
    {
      id: crypto.randomUUID(),
      public_key: '5FHwrdV5RPdXZUkQzGMfJgW yawykjKgeEjM7oGxpBdw',
      balance: 2000,
      staked_amount: 25000,
      pending_rewards: 780.0,
      total_earned: 3100.0,
    },
    {
      id: crypto.randomUUID(),
      public_key: '9ZNTfG4NyQgxy2SWjSiQoUyBPEvXT2xo7fKc5hPYYJ7b',
      balance: 0,
      staked_amount: 50000,
      pending_rewards: 1560.25,
      total_earned: 6200.0,
    },
    {
      id: crypto.randomUUID(),
      public_key: '2q7RyZ5KjE8GNPaCX5sM1dSXkqKGDT9QjHJKBPa7Jjhe',
      balance: 15000,
      staked_amount: 0,
      pending_rewards: 0,
      total_earned: 0,
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, public_key, balance, staked_amount, pending_rewards, total_earned, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-' || abs(random()) % 30 || ' days'))
  `);

  const insertTx = db.prepare(`
    INSERT INTO transactions (id, user_id, type, amount, status, tx_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-' || abs(random()) % 60 || ' days'))
  `);

  const txTypes: Array<'stake' | 'unstake' | 'claim' | 'distribution'> = ['stake', 'unstake', 'claim', 'distribution'];
  const statuses: Array<'completed' | 'completed' | 'completed' | 'pending'> = ['completed', 'completed', 'completed', 'pending'];

  db.transaction(() => {
    for (const user of users) {
      insertUser.run(
        user.id,
        user.public_key,
        user.balance,
        user.staked_amount,
        user.pending_rewards,
        user.total_earned
      );

      // Generate 3-6 random transactions per user
      const txCount = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < txCount; i++) {
        const type = txTypes[Math.floor(Math.random() * txTypes.length)];
        const amount = type === 'claim'
          ? +(Math.random() * 500 + 10).toFixed(2)
          : +(Math.random() * 10000 + 100).toFixed(2);

        insertTx.run(
          crypto.randomUUID(),
          user.id,
          type,
          amount,
          statuses[Math.floor(Math.random() * statuses.length)],
          randomTxHash()
        );
      }
    }

    // Insert vault state
    const totalStaked = users.reduce((sum, u) => sum + u.staked_amount, 0);
    const totalEarned = users.reduce((sum, u) => sum + u.total_earned, 0);

    db.prepare(`
      INSERT INTO vault_state (id, total_staked, total_profit, apy, total_distributions, last_distribution_at)
      VALUES (1, ?, ?, ?, ?, datetime('now', '-2 hours'))
    `).run(totalStaked, totalEarned * 0.4, 12.5, totalEarned * 0.3);

    // Add some distribution transactions
    for (let i = 0; i < 5; i++) {
      insertTx.run(
        crypto.randomUUID(),
        users[i % users.length].id,
        'distribution',
        +(Math.random() * 2000 + 500).toFixed(2),
        'completed',
        randomTxHash()
      );
    }
  })();

  console.log('✅ Database seeded successfully!');
  console.log(`   - ${users.length} users created`);
  console.log(`   - Vault state initialized`);
  console.log(`   - Total staked: ${users.reduce((s, u) => s + u.staked_amount, 0)} tokens`);

  closeDb();
}

main();
