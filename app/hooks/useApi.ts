"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "/api/backend";

// ─── Generic fetch helper ──────────────────────────────
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
export interface Position {
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnL: number;
  leverage: number;
  marginUsed: number;
}

export interface Trade {
  id: number;
  symbol: string;
  side: string;
  size: number;
  price: number;
  pnl: number;
  timestamp: string;
}

export interface PortfolioData {
  totalValue: number;
  availableBalance: number;
  usedBalance: number;
  dailyPnL: number;
  unrealizedPnL: number;
  positionCount: number;
  positions: Position[];
}

export interface MarketPrices {
  [symbol: string]: number;
}

export interface SystemStatus {
  status: string;
  uptime: number;
  version: string;
  environment: string;
}

// ─── Hook: Portfolio ───────────────────────────────────
export function usePortfolio(refreshMs = 5000) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; portfolio: PortfolioData }>("/portfolio");
      setData(res.portfolio);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, refreshMs);
    return () => clearInterval(iv);
  }, [fetch_, refreshMs]);

  return { data, loading, error, refetch: fetch_ };
}

// ─── Hook: Positions ───────────────────────────────────
export function usePositions(refreshMs = 5000) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; positions: Position[] }>("/portfolio/positions");
      setPositions(res.positions);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, refreshMs);
    return () => clearInterval(iv);
  }, [fetch_, refreshMs]);

  return { positions, loading, error, refetch: fetch_ };
}

// ─── Hook: Trades ──────────────────────────────────────
export function useTrades(limit = 50, refreshMs = 10000) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; trades: Trade[] }>(`/portfolio/trades?limit=${limit}`);
      setTrades(res.trades);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, refreshMs);
    return () => clearInterval(iv);
  }, [fetch_, refreshMs]);

  return { trades, loading, error, refetch: fetch_ };
}

// ─── Hook: Market Prices ───────────────────────────────
export function useMarketPrices(refreshMs = 3000) {
  const [prices, setPrices] = useState<MarketPrices>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; prices: MarketPrices }>("/market/prices");
      setPrices(res.prices);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, refreshMs);
    return () => clearInterval(iv);
  }, [fetch_, refreshMs]);

  return { prices, loading, error, refetch: fetch_ };
}

// ─── Hook: System Status ───────────────────────────────
export function useSystemStatus(refreshMs = 15000) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; system: SystemStatus }>("/system/status");
      setStatus(res.system);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, refreshMs);
    return () => clearInterval(iv);
  }, [fetch_, refreshMs]);

  return { status, loading, error, refetch: fetch_ };
}

// ─── Hook: WebSocket for real-time updates ─────────────
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.hostname}:4000/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        setLastMessage(JSON.parse(event.data));
      } catch {
        setLastMessage(event.data);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, lastMessage, send };
}
