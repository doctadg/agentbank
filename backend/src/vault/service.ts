import { getDb } from '../db';
import { VaultState } from '../types';

export function getVaultStats() {
  const db = getDb();
  const vault = db.prepare('SELECT * FROM vault_state WHERE id = 1').get() as VaultState;
  return {
    totalHolders: vault.total_holders,
    totalSupply: vault.total_supply,
    lastSnapshotAt: vault.last_snapshot_at,
  };
}
