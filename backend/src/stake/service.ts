import { Router, Response } from 'express';
import { getDb } from '../db';
import { AuthenticatedRequest, User, Transaction, VaultState } from '../types';
import crypto from 'crypto';

/**
 * Stake Service — Business logic for staking operations
 * All DB operations use transactions for consistency.
 */

function randomTxHash(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Get user's staking position */
export function getPosition(user: User) {
  const db = getDb();
  const vault = db.prepare('SELECT * FROM vault_state WHERE id = 1').get() as VaultState;

  const share = vault.total_staked > 0
    ? (user.staked_amount / vault.total_staked) * 100
    : 0;

  return {
    stakedAmount: user.staked_amount,
    balance: user.balance,
    share: Math.round(share * 10000) / 10000, // 4 decimal places
    earned: user.total_earned,
    pendingRewards: user.pending_rewards,
  };
}

/** Stake tokens (deposit) */
export function deposit(userId: string, amount: number) {
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const db = getDb();
  const txId = crypto.randomUUID();
  const txHash = randomTxHash();

  const result = db.transaction(() => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
    if (!user) throw new Error('User not found');
    if (user.balance < amount) throw new Error(`Insufficient balance. Available: ${user.balance}`);

    // Deduct from balance, add to staked
    db.prepare('UPDATE users SET balance = balance - ?, staked_amount = staked_amount + ? WHERE id = ?')
      .run(amount, amount, userId);

    // Update vault total
    db.prepare('UPDATE vault_state SET total_staked = total_staked + ? WHERE id = 1').run(amount);

    // Record transaction
    db.prepare(`INSERT INTO transactions (id, user_id, type, amount, status, tx_hash) VALUES (?, ?, 'stake', ?, 'completed', ?)`)
      .run(txId, userId, amount, txHash);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
    return { txId, txHash, newStakedAmount: updated.staked_amount, newBalance: updated.balance };
  })();

  return result;
}

/** Unstake tokens (withdraw) */
export function withdraw(userId: string, amount: number) {
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const db = getDb();
  const txId = crypto.randomUUID();
  const txHash = randomTxHash();

  const result = db.transaction(() => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
    if (!user) throw new Error('User not found');
    if (user.staked_amount < amount) throw new Error(`Insufficient staked amount. Staked: ${user.staked_amount}`);

    // Move from staked back to balance
    db.prepare('UPDATE users SET staked_amount = staked_amount - ?, balance = balance + ? WHERE id = ?')
      .run(amount, amount, userId);

    // Update vault total
    db.prepare('UPDATE vault_state SET total_staked = total_staked - ? WHERE id = 1').run(amount);

    // Record transaction
    db.prepare(`INSERT INTO transactions (id, user_id, type, amount, status, tx_hash) VALUES (?, ?, 'unstake', ?, 'completed', ?)`)
      .run(txId, userId, amount, txHash);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
    return { txId, txHash, newStakedAmount: updated.staked_amount, newBalance: updated.balance };
  })();

  return result;
}

/** Claim pending rewards */
export function claimRewards(userId: string) {
  const db = getDb();
  const txId = crypto.randomUUID();
  const txHash = randomTxHash();

  const result = db.transaction(() => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
    if (!user) throw new Error('User not found');
    if (user.pending_rewards <= 0) throw new Error('No pending rewards to claim');

    const claimAmount = user.pending_rewards;

    // Add rewards to balance, reset pending
    db.prepare('UPDATE users SET balance = balance + ?, pending_rewards = 0, total_earned = total_earned + ? WHERE id = ?')
      .run(claimAmount, claimAmount, userId);

    // Record transaction
    db.prepare(`INSERT INTO transactions (id, user_id, type, amount, status, tx_hash) VALUES (?, ?, 'claim', ?, 'completed', ?)`)
      .run(txId, userId, claimAmount, txHash);

    return { txId, txHash, claimed: claimAmount };
  })();

  return result;
}

/** Get user's transaction history */
export function getHistory(userId: string, limit = 50): Transaction[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as Transaction[];
}

/** Distribute rewards to all stakers (called by cron/job) */
export function distributeRewards(totalProfitAmount: number) {
  const db = getDb();

  db.transaction(() => {
    const vault = db.prepare('SELECT * FROM vault_state WHERE id = 1').get() as VaultState;
    if (vault.total_staked <= 0) return;

    const stakers = db.prepare('SELECT * FROM users WHERE staked_amount > 0').all() as User[];

    for (const user of stakers) {
      const share = user.staked_amount / vault.total_staked;
      const reward = totalProfitAmount * share;

      db.prepare('UPDATE users SET pending_rewards = pending_rewards + ? WHERE id = ?')
        .run(reward, user.id);
    }

    // Update vault state
    db.prepare('UPDATE vault_state SET total_profit = total_profit + ?, total_distributions = total_distributions + 1, last_distribution_at = datetime("now") WHERE id = 1')
      .run(totalProfitAmount);

  })();
}
