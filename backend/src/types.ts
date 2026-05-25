import { Request } from 'express';

export interface User {
  id: string;
  public_key: string;
  balance: number;
  staked_amount: number;
  pending_rewards: number;
  total_earned: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'stake' | 'unstake' | 'claim' | 'distribution';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  tx_hash: string | null;
  created_at: string;
}

export interface VaultState {
  id: number;
  total_staked: number;
  total_profit: number;
  apy: number;
  total_distributions: number;
  last_distribution_at: string | null;
}

export interface Nonce {
  public_key: string;
  nonce: string;
  expires_at: string;
}

export interface AuthRequest {
  publicKey: string;
  signature?: string;
  nonce?: string;
}

export interface JwtPayload {
  userId: string;
  publicKey: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  headers: Request['headers'];
  body: any;
  query: any;
  params: any;
}
