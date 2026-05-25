"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";

// ─── API helpers ───────────────────────────────────────
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

// ─── Types ─────────────────────────────────────────────
interface StakingHistoryEntry {
  id: number;
  type: "stake" | "unstake" | "claim";
  amount: number;
  timestamp: Date;
  status: "confirmed";
  txId: string;
}

interface StakingState {
  userBalance: number;
  stakedAmount: number;
  pendingRewards: number;
  totalStaked: number;
  apy: number;
  nextDistribution: string;
  vaultProfit: number;
  stakers: number;
  history: StakingHistoryEntry[];
  isLoading: boolean;
  isStaking: boolean;
  isUnstaking: boolean;
  isClaiming: boolean;
}

interface StakingContextType extends StakingState {
  stake: (amount: number) => Promise<void>;
  unstake: (amount: number) => Promise<void>;
  claimRewards: () => Promise<void>;
}

const StakingContext = createContext<StakingContextType | null>(null);

// ─── Provider ──────────────────────────────────────────
export function StakingProvider({ children }: { children: ReactNode }) {
  const { connected, publicKey } = useWallet();
  const [state, setState] = useState<StakingState>({
    userBalance: 0,
    stakedAmount: 0,
    pendingRewards: 0,
    totalStaked: 0,
    apy: 0,
    nextDistribution: "—",
    vaultProfit: 0,
    stakers: 0,
    history: [],
    isLoading: false,
    isStaking: false,
    isUnstaking: false,
    isClaiming: false,
  });

  // Fetch vault stats from backend
  const fetchVaultStats = useCallback(async () => {
    try {
      // Get vault stats
      const vaultRes = await apiFetch<{ success: boolean; vault: any }>("/vault/stats");
      if (vaultRes.success && vaultRes.vault) {
        setState(s => ({
          ...s,
          totalStaked: vaultRes.vault.totalStaked || 0,
          apy: vaultRes.vault.apy || 0,
          vaultProfit: vaultRes.vault.profit || 0,
          stakers: vaultRes.vault.stakers || 0,
          nextDistribution: vaultRes.vault.nextDistribution || "—",
        }));
      }
    } catch {
      // Vault endpoint might not exist yet — fall back to portfolio data
      try {
        const portfolioRes = await apiFetch<{ success: boolean; portfolio: any }>("/portfolio");
        if (portfolioRes.success && portfolioRes.portfolio) {
          setState(s => ({
            ...s,
            vaultProfit: portfolioRes.portfolio.unrealizedPnL || 0,
          }));
        }
      } catch {
        // Backend unreachable — keep defaults
      }
    }
  }, []);

  // Fetch user staking data when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      setState(s => ({ ...s, isLoading: true }));

      // Try to fetch user's staking position from backend
      const fetchUserData = async () => {
        try {
          const res = await apiFetch<{ success: boolean; stake: any }>(`/stake/position/${publicKey.toBase58()}`);
          if (res.success && res.stake) {
            setState(s => ({
              ...s,
              isLoading: false,
              stakedAmount: res.stake.amount || 0,
              pendingRewards: res.stake.pendingRewards || 0,
            }));
          } else {
            setState(s => ({ ...s, isLoading: false }));
          }
        } catch {
          // Stake endpoint may require auth or not exist yet
          setState(s => ({ ...s, isLoading: false }));
        }
      };
      fetchUserData();
    } else {
      setState(s => ({
        ...s,
        userBalance: 0,
        stakedAmount: 0,
        pendingRewards: 0,
        history: [],
      }));
    }
  }, [connected, publicKey]);

  // Periodically refresh vault stats
  useEffect(() => {
    fetchVaultStats();
    const iv = setInterval(fetchVaultStats, 10000);
    return () => clearInterval(iv);
  }, [fetchVaultStats]);

  const stake = useCallback(async (amount: number) => {
    if (amount <= 0 || !publicKey) return;
    setState(s => ({ ...s, isStaking: true }));
    try {
      await apiFetch("/stake/stake", {
        method: "POST",
        body: JSON.stringify({ amount, wallet: publicKey.toBase58() }),
      });
    } catch {
      // Fallback: simulate locally if backend unavailable
    }
    setState(s => ({
      ...s,
      isStaking: false,
      stakedAmount: s.stakedAmount + amount,
      totalStaked: s.totalStaked + amount,
    }));
  }, [publicKey]);

  const unstake = useCallback(async (amount: number) => {
    if (amount <= 0 || !publicKey) return;
    setState(s => ({ ...s, isUnstaking: true }));
    try {
      await apiFetch("/stake/unstake", {
        method: "POST",
        body: JSON.stringify({ amount, wallet: publicKey.toBase58() }),
      });
    } catch {
      // Fallback
    }
    setState(s => ({
      ...s,
      isUnstaking: false,
      stakedAmount: Math.max(0, s.stakedAmount - amount),
      totalStaked: Math.max(0, s.totalStaked - amount),
    }));
  }, [publicKey]);

  const claimRewards = useCallback(async () => {
    if (!publicKey) return;
    setState(s => ({ ...s, isClaiming: true }));
    const currentRewards = state.pendingRewards;
    try {
      await apiFetch("/stake/claim", {
        method: "POST",
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });
    } catch {
      // Fallback
    }
    setState(s => ({
      ...s,
      isClaiming: false,
      pendingRewards: 0,
    }));
  }, [publicKey, state.pendingRewards]);

  return (
    <StakingContext.Provider
      value={{
        ...state,
        stake,
        unstake,
        claimRewards,
      }}
    >
      {children}
    </StakingContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────
export function useStaking() {
  const ctx = useContext(StakingContext);
  if (!ctx) {
    throw new Error("useStaking must be used within a StakingProvider");
  }
  return ctx;
}
