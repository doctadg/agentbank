import { getDb } from '../db';
import { VaultState, Distribution } from '../types';

export function getVaultStats() {
  const db = getDb();
  const vault = db.prepare('SELECT * FROM vault_state WHERE id = 1').get() as VaultState;
  return {
    totalDistributed: vault.total_distributed,
    totalHolders: vault.total_holders,
    totalSupply: vault.total_supply,
    lastSnapshotAt: vault.last_snapshot_at,
    lastDistributionAt: vault.last_distribution_at,
  };
}

export function getDistributions(limit = 20): Distribution[] {
  const db = getDb();
  return db.prepare('SELECT * FROM distributions ORDER BY created_at DESC LIMIT ?').all(limit) as Distribution[];
}
