"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/backend";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

function usePolled<T>(fetcher: () => Promise<T>, deps: React.DependencyList, refreshMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    try {
      const d = await fetcher();
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    const iv = setInterval(run, refreshMs);
    return () => clearInterval(iv);
  }, [run, refreshMs]);

  return { data, loading, error, refetch: run };
}

// ─── Types ─────────────────────────────────────────────
export interface VaultStats {
  totalHolders: number;
  totalSupply: number;
  lastSnapshotAt: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  publicKey: string;
  balance: number;
  lastSeen: string;
}

export interface HolderPosition {
  publicKey: string;
  balance: number;
  holdingSince: string;
  holdingDays: number;
  avgBalance: number;
}

// ─── Vault stats (holders, total distributed, supply) ──
export function useVaultStats(refreshMs = 30_000) {
  const { data, loading, error, refetch } = usePolled<VaultStats>(
    async () => {
      const r = await apiFetch<{ success: boolean; data: VaultStats }>("/vault/stats");
      return r.data;
    },
    [],
    refreshMs,
  );
  return { stats: data, loading, error, refetch };
}

// ─── Holder leaderboard ────────────────────────────────
export function useLeaderboard(refreshMs = 60_000) {
  const { data, loading, error, refetch } = usePolled<LeaderboardEntry[]>(
    async () => {
      const r = await apiFetch<{ success: boolean; data: LeaderboardEntry[] }>("/holder/leaderboard");
      return r.data;
    },
    [],
    refreshMs,
  );
  return { leaderboard: data ?? [], loading, error, refetch };
}

// ─── Agent (paper copy-trading) ────────────────────────
export interface AgentOpenPosition {
  id: number;
  coin: string;
  side: "long" | "short";
  sz: number;
  entryPx: number;
  markPx: number;
  notional: number;
  unrealizedPnl: number;
  sourceWallet: string;
}

export interface AgentState {
  startingEquity: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  pnlPct: number;
  openPositions: AgentOpenPosition[];
  openPositionsCount: number;
  paused: boolean;
  followedCount: number;
  tradeCount: number;
  closedCount: number;
  wins: number;
  losses: number;
  winRate: number;
  lastTradeAt: number | null;
}

export interface AgentTrade {
  id: number;
  ts: number;
  source_wallet: string;
  source_tid: number;
  coin: string;
  action: "open_long" | "open_short" | "close_long" | "close_short" | "reduce_long" | "reduce_short";
  source_px: number;
  source_sz: number;
  source_notional: number;
  leader_acct_value: number;
  leader_pct: number;
  vault_acct_value: number;
  mirror_sz: number;
  mirror_notional: number;
  mirror_px: number;
  realized_pnl: number | null;
  position_id: number | null;
  notes: string | null;
}

export function useAgentState(refreshMs = 10_000) {
  const { data, loading, error, refetch } = usePolled<AgentState>(
    async () => {
      const r = await apiFetch<{ success: boolean; data: AgentState }>("/agent/state");
      return r.data;
    },
    [],
    refreshMs,
  );
  return { state: data, loading, error, refetch };
}

export function useAgentTrades(limit = 50, refreshMs = 10_000) {
  const { data, loading, error, refetch } = usePolled<AgentTrade[]>(
    async () => {
      const r = await apiFetch<{ success: boolean; data: AgentTrade[] }>(`/agent/trades?limit=${limit}`);
      return r.data;
    },
    [limit],
    refreshMs,
  );
  return { trades: data ?? [], loading, error, refetch };
}

// ─── Specific holder ───────────────────────────────────
export function useHolderPosition(publicKey: string | null, refreshMs = 60_000) {
  const { data, loading, error, refetch } = usePolled<HolderPosition | null>(
    async () => {
      if (!publicKey) return null;
      const r = await apiFetch<{ success: boolean; data: HolderPosition }>(`/holder/${publicKey}/position`);
      return r.data;
    },
    [publicKey],
    refreshMs,
  );
  return { position: data, loading, error, refetch };
}
