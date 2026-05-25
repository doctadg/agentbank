"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const HL_API = "https://api.hyperliquid.xyz/info";

// ─── Types ─────────────────────────────────────────────
export interface HLFill {
  coin: string;
  px: string;
  sz: string;
  side: "A" | "B"; // A = sell (ask), B = buy (bid)
  time: number;
  dir: string; // "Open Long" | "Close Long" | "Open Short" | "Close Short" | "Buy" | "Sell"
  closedPnl: string;
  fee: string;
  hash: string;
  startPosition: string;
  oid: number;
  tid: number;
  crossed: boolean;
  twapId: number | null;
  feeToken: string;
}

export interface HLPosition {
  coin: string;
  szi: string; // signed size, negative = short
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  leverage: { type: string; value: number };
  liquidationPx: string | null;
  marginUsed: string;
  maxLeverage: number;
}

export interface HLMarginSummary {
  accountValue: string;
  totalNtlPos: string;
  totalRawUsd: string;
  totalMarginUsed: string;
}

export interface HLClearinghouseState {
  marginSummary: HLMarginSummary;
  crossMarginSummary: HLMarginSummary;
  assetPositions: Array<{ type: string; position: HLPosition }>;
  time: number;
}

// ─── Fetch helper with simple cache + 429 backoff ──────
const _inflight = new Map<string, Promise<unknown>>();
const _cache = new Map<string, { ts: number; data: unknown }>();
let _backoffUntil = 0;

async function hlPost<T>(body: object, signal?: AbortSignal, cacheMs = 4500): Promise<T> {
  const key = JSON.stringify(body);
  const now = Date.now();
  const cached = _cache.get(key);
  if (cached && now - cached.ts < cacheMs) return cached.data as T;
  if (now < _backoffUntil) {
    if (cached) return cached.data as T;
    throw new Error("HL backoff");
  }
  const existing = _inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      const res = await fetch(HL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (res.status === 429) {
        _backoffUntil = Date.now() + 15_000;
        if (cached) return cached.data as T;
        throw new Error("HL API 429");
      }
      if (!res.ok) throw new Error(`HL API ${res.status}`);
      const data = (await res.json()) as T;
      _cache.set(key, { ts: Date.now(), data });
      return data;
    } finally {
      _inflight.delete(key);
    }
  })();
  _inflight.set(key, p);
  return p;
}

// ─── Single trader hook ────────────────────────────────
export function useHyperliquidTrader(address: string, refreshMs = 12_000, fillWindowDays = 2) {
  const [fills, setFills] = useState<HLFill[]>([]);
  const [state, setState] = useState<HLClearinghouseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (signal?: AbortSignal) => {
    try {
      const since = Date.now() - fillWindowDays * 86400_000;
      const [f, s] = await Promise.all([
        hlPost<HLFill[] | null>({ type: "userFillsByTime", user: address, startTime: since }, signal),
        hlPost<HLClearinghouseState>({ type: "clearinghouseState", user: address }, signal),
      ]);
      if (Array.isArray(f)) setFills(f);
      if (s) setState(s);
      setError(null);
    } catch (e: any) {
      if (e.name !== "AbortError" && e.message !== "HL backoff") setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address, fillWindowDays]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchAll(ctrl.signal);
    const iv = setInterval(() => fetchAll(ctrl.signal), refreshMs);
    return () => { ctrl.abort(); clearInterval(iv); };
  }, [fetchAll, refreshMs]);

  return { fills, state, loading, error, refetch: fetchAll };
}

// ─── Derived stats per trader ──────────────────────────
export interface TraderStats {
  address: string;
  accountValue: number;
  totalNtlPos: number;
  marginUsed: number;
  positions: HLPosition[];
  fills24h: HLFill[];
  pnl24h: number;
  pnl7d: number;
  fees24h: number;
  winRate: number;
  totalVolume24h: number;
  lastFill: HLFill | null;
}

export function computeStats(address: string, fills: HLFill[], state: HLClearinghouseState | null): TraderStats {
  const now = Date.now();
  const d1 = now - 86400_000;
  const d7 = now - 7 * 86400_000;
  const fills24h = fills.filter((f) => f.time >= d1);
  const fills7d = fills.filter((f) => f.time >= d7);

  const pnl24h = fills24h.reduce((s, f) => s + parseFloat(f.closedPnl), 0);
  const pnl7d = fills7d.reduce((s, f) => s + parseFloat(f.closedPnl), 0);
  const fees24h = fills24h.reduce((s, f) => s + parseFloat(f.fee), 0);
  const closes24h = fills24h.filter((f) => f.dir.startsWith("Close") && parseFloat(f.closedPnl) !== 0);
  const wins = closes24h.filter((f) => parseFloat(f.closedPnl) > 0).length;
  const winRate = closes24h.length > 0 ? wins / closes24h.length : 0;
  const totalVolume24h = fills24h.reduce((s, f) => s + parseFloat(f.sz) * parseFloat(f.px), 0);

  return {
    address,
    accountValue: state ? parseFloat(state.marginSummary.accountValue) : 0,
    totalNtlPos: state ? parseFloat(state.marginSummary.totalNtlPos) : 0,
    marginUsed: state ? parseFloat(state.marginSummary.totalMarginUsed) : 0,
    positions: state ? state.assetPositions.map((p) => p.position) : [],
    fills24h,
    pnl24h,
    pnl7d,
    fees24h,
    winRate,
    totalVolume24h,
    lastFill: fills[0] ?? null,
  };
}

// ─── Multi-trader combined hook ────────────────────────
export function useCopytrade(addresses: string[], refreshMs = 5000) {
  const traders = addresses.map((addr) => useHyperliquidTrader(addr, refreshMs)); // eslint-disable-line react-hooks/rules-of-hooks

  const stats = traders.map((t, i) => computeStats(addresses[i], t.fills, t.state));

  const loading = traders.every((t) => t.loading);
  const error = traders.find((t) => t.error)?.error ?? null;

  const combinedFills = useMemo(() => {
    return traders
      .flatMap((t, i) => t.fills.map((f) => ({ fill: f, trader: addresses[i] })))
      .sort((a, b) => b.fill.time - a.fill.time);
  }, [traders.map((t) => t.fills).flat().length, addresses.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const combinedPositions = useMemo(() => {
    return stats.flatMap((s) => s.positions.map((p) => ({ pos: p, trader: s.address })));
  }, [stats.map((s) => s.positions.length).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = {
    accountValue: stats.reduce((s, t) => s + t.accountValue, 0),
    pnl24h: stats.reduce((s, t) => s + t.pnl24h, 0),
    pnl7d: stats.reduce((s, t) => s + t.pnl7d, 0),
    fills24h: stats.reduce((s, t) => s + t.fills24h.length, 0),
    volume24h: stats.reduce((s, t) => s + t.totalVolume24h, 0),
    openPositions: stats.reduce((s, t) => s + t.positions.length, 0),
    totalNtlPos: stats.reduce((s, t) => s + t.totalNtlPos, 0),
  };

  return { stats, totals, combinedFills, combinedPositions, loading, error };
}

// ─── Utils ─────────────────────────────────────────────
export function truncateAddress(addr: string, head = 6, tail = 5) {
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

export function hyperliquidExplorer(addr: string) {
  return `https://app.hyperliquid.xyz/explorer/address/${addr}`;
}

export function isLong(p: HLPosition) {
  return parseFloat(p.szi) > 0;
}

export function parseFillSide(f: HLFill): "long" | "short" | "buy" | "sell" {
  // Use dir for more info: Open Long, Close Long, Open Short, Close Short
  if (f.dir.includes("Long")) return "long";
  if (f.dir.includes("Short")) return "short";
  return f.side === "B" ? "buy" : "sell";
}
