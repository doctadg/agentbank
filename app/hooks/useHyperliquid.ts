"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const HL_API = "https://api.hyperliquid.xyz/info";
const HL_WS = "wss://api.hyperliquid.xyz/ws";

// ─── Types ─────────────────────────────────────────────
export interface HLFill {
  coin: string;
  px: string;
  sz: string;
  side: "A" | "B";
  time: number;
  dir: string;
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
  szi: string;
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

// ─── HTTP (only for one-shot historical backfill) ──────
async function hlPost<T>(body: object, signal?: AbortSignal): Promise<T> {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`HL API ${res.status}`);
  return res.json();
}

// ─── Shared WebSocket manager ──────────────────────────
type Listener<T = any> = (data: T) => void;

let _ws: WebSocket | null = null;
let _opening: Promise<WebSocket> | null = null;
let _pingInterval: ReturnType<typeof setInterval> | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _reconnectAttempt = 0;
const _channelListeners = new Map<string, Set<Listener>>();
const _activeSubs = new Map<string, object>();

type WSStatus = "connecting" | "open" | "closed";
let _status: WSStatus = "closed";
const _statusListeners = new Set<(s: WSStatus) => void>();

function setStatus(s: WSStatus) {
  if (_status === s) return;
  _status = s;
  for (const l of _statusListeners) l(s);
}

function channelKeyFromMsg(msg: any): string | null {
  if (msg.channel === "userFills") return `userFills:${(msg.data?.user || "").toLowerCase()}`;
  if (msg.channel === "webData2") return `webData2:${(msg.data?.user || "").toLowerCase()}`;
  if (msg.channel) return msg.channel;
  return null;
}

function channelKeyFromSub(sub: any): string {
  if (sub.type === "userFills") return `userFills:${(sub.user || "").toLowerCase()}`;
  if (sub.type === "webData2") return `webData2:${(sub.user || "").toLowerCase()}`;
  return sub.type ?? JSON.stringify(sub);
}

function connect(): Promise<WebSocket> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (_ws && _ws.readyState === WebSocket.OPEN) return Promise.resolve(_ws);
  if (_opening) return _opening;

  setStatus("connecting");
  _opening = new Promise((resolve, reject) => {
    const sock = new WebSocket(HL_WS);

    sock.onopen = () => {
      _ws = sock;
      _reconnectAttempt = 0;
      setStatus("open");
      // Resubscribe everything
      for (const sub of _activeSubs.values()) {
        try { sock.send(JSON.stringify({ method: "subscribe", subscription: sub })); } catch {}
      }
      // Keepalive
      if (_pingInterval) clearInterval(_pingInterval);
      _pingInterval = setInterval(() => {
        if (sock.readyState === WebSocket.OPEN) {
          try { sock.send(JSON.stringify({ method: "ping" })); } catch {}
        }
      }, 30_000);
      resolve(sock);
    };

    sock.onmessage = (event) => {
      let msg: any;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.channel === "pong" || msg.channel === "subscriptionResponse") return;
      const key = channelKeyFromMsg(msg);
      if (!key) return;
      const listeners = _channelListeners.get(key);
      if (!listeners) return;
      for (const l of listeners) {
        try { l(msg.data); } catch {}
      }
    };

    const cleanup = () => {
      if (_pingInterval) { clearInterval(_pingInterval); _pingInterval = null; }
      _ws = null;
      _opening = null;
      setStatus("closed");
      // Reconnect with backoff if anyone still subscribed
      if (_activeSubs.size > 0) {
        _reconnectAttempt++;
        const delay = Math.min(15_000, 500 * Math.pow(1.5, _reconnectAttempt));
        if (_reconnectTimer) clearTimeout(_reconnectTimer);
        _reconnectTimer = setTimeout(() => { connect().catch(() => {}); }, delay);
      }
    };

    sock.onclose = cleanup;
    sock.onerror = () => {
      try { sock.close(); } catch {}
      reject(new Error("ws error"));
    };
  });
  return _opening;
}

function subscribe<T = any>(sub: object, listener: Listener<T>): () => void {
  const key = channelKeyFromSub(sub);
  let set = _channelListeners.get(key);
  const isFirst = !set;
  if (!set) {
    set = new Set();
    _channelListeners.set(key, set);
    _activeSubs.set(key, sub);
  }
  set.add(listener as Listener);

  if (isFirst) {
    connect()
      .then((sock) => {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify({ method: "subscribe", subscription: sub }));
        }
      })
      .catch(() => {});
  }

  return () => {
    const s = _channelListeners.get(key);
    if (!s) return;
    s.delete(listener as Listener);
    if (s.size === 0) {
      _channelListeners.delete(key);
      _activeSubs.delete(key);
      if (_ws && _ws.readyState === WebSocket.OPEN) {
        try { _ws.send(JSON.stringify({ method: "unsubscribe", subscription: sub })); } catch {}
      }
    }
  };
}

export function useHLConnection() {
  const [status, setStatus] = useState<WSStatus>(_status);
  useEffect(() => {
    const l = (s: WSStatus) => setStatus(s);
    _statusListeners.add(l);
    return () => { _statusListeners.delete(l); };
  }, []);
  return status;
}

// ─── Single trader hook (WS + one-shot HTTP backfill) ──
export function useHyperliquidTrader(address: string, fillWindowDays = 2) {
  const [fills, setFills] = useState<HLFill[]>([]);
  const [state, setState] = useState<HLClearinghouseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    // 1. One-shot HTTP backfill so we have 24h+ history immediately for stats
    (async () => {
      try {
        const since = Date.now() - fillWindowDays * 86400_000;
        const f = await hlPost<HLFill[] | null>(
          { type: "userFillsByTime", user: address, startTime: since },
          ctrl.signal,
        );
        if (!mounted) return;
        if (Array.isArray(f) && f.length > 0) {
          setFills((prev) => mergeFills(prev, f));
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          // Silent — WS snapshot will still arrive
        }
      }
    })();

    // 2. Subscribe to live fills
    const unsubFills = subscribe<{ isSnapshot?: boolean; user: string; fills: HLFill[] }>(
      { type: "userFills", user: address },
      (data) => {
        if (!mounted) return;
        const incoming = data?.fills ?? [];
        if (incoming.length > 0) {
          setFills((prev) => mergeFills(prev, incoming));
        }
        setLoading(false);
        setError(null);
      },
    );

    // 3. Subscribe to webData2 for live position/margin state
    const unsubWeb = subscribe<{ clearinghouseState?: HLClearinghouseState; user: string }>(
      { type: "webData2", user: address },
      (data) => {
        if (!mounted) return;
        if (data?.clearinghouseState) {
          setState(data.clearinghouseState);
          setLoading(false);
          setError(null);
        }
      },
    );

    return () => {
      mounted = false;
      ctrl.abort();
      unsubFills();
      unsubWeb();
    };
  }, [address, fillWindowDays]);

  return { fills, state, loading, error };
}

function mergeFills(prev: HLFill[], incoming: HLFill[]): HLFill[] {
  const seen = new Set(prev.map((f) => f.tid));
  const fresh = incoming.filter((f) => !seen.has(f.tid));
  if (fresh.length === 0) return prev;
  const merged = [...fresh, ...prev];
  merged.sort((a, b) => b.time - a.time);
  return merged.length > 1000 ? merged.slice(0, 1000) : merged;
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
// NOTE: the `refreshMs` arg is accepted for backwards compat but ignored
// (we now stream via WebSocket).
export function useCopytrade(addresses: string[], _refreshMs?: number) {
  const traders = addresses.map((addr) => useHyperliquidTrader(addr)); // eslint-disable-line react-hooks/rules-of-hooks

  const stats = traders.map((t, i) => computeStats(addresses[i], t.fills, t.state));

  const loading = traders.every((t) => t.loading);
  const error = traders.find((t) => t.error)?.error ?? null;

  const fillsLenKey = traders.map((t) => t.fills.length).join(",");
  const posLenKey = stats.map((s) => s.positions.length).join(",");

  const combinedFills = useMemo(() => {
    return traders
      .flatMap((t, i) => t.fills.map((f) => ({ fill: f, trader: addresses[i] })))
      .sort((a, b) => b.fill.time - a.fill.time);
  }, [fillsLenKey, addresses.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const combinedPositions = useMemo(() => {
    return stats.flatMap((s) => s.positions.map((p) => ({ pos: p, trader: s.address })));
  }, [posLenKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
  if (f.dir.includes("Long")) return "long";
  if (f.dir.includes("Short")) return "short";
  return f.side === "B" ? "buy" : "sell";
}
