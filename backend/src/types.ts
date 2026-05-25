import { Request } from 'express';

export interface User { id: string; public_key: string; created_at: string; }
export interface HolderSnapshot { id: string; public_key: string; balance: number; snapshot_date: string; created_at: string; }
export interface Distribution { id: string; total_amount: number; holder_count: number; notes: string | null; created_at: string; }
export interface RewardRecord { id: string; distribution_id: string; public_key: string; amount: number; holding_days: number; avg_balance: number; created_at: string; }
export interface VaultState { id: number; total_distributed: number; total_holders: number; total_supply: number; last_snapshot_at: string | null; last_distribution_at: string | null; }
export interface Nonce { public_key: string; nonce: string; expires_at: string; }
export interface JwtPayload { userId: string; publicKey: string; }
export interface AuthenticatedRequest extends Request { user?: User; }

export type AgentEventType =
  | 'trade_open'
  | 'trade_close'
  | 'signal'
  | 'reasoning'
  | 'distribution'
  | 'snapshot'
  | 'system';

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  symbol: string | null;
  side: 'long' | 'short' | null;
  price: number | null;
  size: number | null;
  pnl: number | null;
  message: string;
  detail: string | null;
  metadata: string | null;
  created_at: string;
}
