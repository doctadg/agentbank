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
