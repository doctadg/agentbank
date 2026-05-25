import { getDb } from '../db';
import { VaultState, Transaction } from '../types';

/**
 * Vault Service — Public vault statistics
 */

/** Get public vault stats */
export function getVaultStats() {
  const db = getDb();
  const vault = db.prepare('SELECT * FROM vault_state WHERE id = 1').get() as VaultState;

  const stakerCount = (db.prepare('SELECT COUNT(*) as count FROM users WHERE staked_amount > 0').get() as any).count;

  // Calculate next distribution (mock: every 24h from last, or 6h from now if none yet)
  const lastDist = vault.last_distribution_at ? new Date(vault.last_distribution_at) : null;
  let nextDistribution: string;
  if (lastDist) {
    const next = new Date(lastDist.getTime() + 24 * 60 * 60 * 1000);
    const diff = next.getTime() - Date.now();
    if (diff <= 0) {
      nextDistribution = 'Pending';
    } else {
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      nextDistribution = `${hours}h ${mins}m`;
    }
  } else {
    nextDistribution = '6h 0m';
  }

  return {
    totalStaked: vault.total_staked,
    apy: vault.apy || 43.8, // Default mock APY
    vaultProfit: vault.total_profit,
    stakers: stakerCount,
    nextDistribution,
    totalDistributions: vault.total_distributions,
    lastDistributionAt: vault.last_distribution_at,
  };
}

/** Get distribution history */
export function getDistributions(): Transaction[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM transactions WHERE type = 'distribution' ORDER BY created_at DESC LIMIT 30"
  ).all() as Transaction[];
}
