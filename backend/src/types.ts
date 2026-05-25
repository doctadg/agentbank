import { Request } from 'express';

export interface User { id: string; public_key: string; created_at: string; }
export interface HolderSnapshot { id: string; public_key: string; balance: number; snapshot_date: string; created_at: string; }
export interface VaultState { id: number; total_holders: number; total_supply: number; last_snapshot_at: string | null; }
export interface Nonce { public_key: string; nonce: string; expires_at: string; }
export interface JwtPayload { userId: string; publicKey: string; }
export interface AuthenticatedRequest extends Request { user?: User; }
