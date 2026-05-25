/**
 * Market Data Ingester (AgentBank Extract)
 *
 * Fetches market data from Hyperliquid via REST/WS.
 * Stripped from PerpsTrader: removed message-bus (uses eventBus),
 * removed data-validation import, simplified candle management.
 *
 * Provides: candles, orderbook snapshots, funding rates, current prices.
 */

import axios from 'axios';
import { config } from '../config';
import logger from '../core/logger';
import eventBus from '../core/event-bus';
import { getDb } from '../db/database';

// ─── Types ──────────────────────────────────────────────────────────────

interface HyperliquidOrderBookLevel {
  px: string;
  sz: string;
  n: number;
}

interface OrderBookSnapshot {
  symbol: string;
  timestamp: number;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  midPrice: number;
  spread: number;
}

interface Candle {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FundingRate {
  symbol: string;
  rate: number;
  nextFundingTime: number;
  timestamp: number;
}

// ─── MarketIngester ─────────────────────────────────────────────────────

export class MarketIngester {
  private baseUrl: string;
  private wsUrl: string;
  private prices: Map<string, number> = new Map();
  private orderbooks: Map<string, OrderBookSnapshot> = new Map();
  private fundingRates: Map<string, FundingRate> = new Map();
  private intervals: NodeJS.Timeout[] = [];
  private running = false;
  private trackedSymbols: string[];

  constructor(symbols: string[] = ['BTC', 'ETH', 'SOL', 'ARB', 'DOGE']) {
    this.trackedSymbols = symbols;
    this.baseUrl = config.hyperliquidTestnet
      ? 'https://api.hyperliquid-testnet.xyz'
      : 'https://api.hyperliquid.xyz';
    this.wsUrl = config.hyperliquidTestnet
      ? 'wss://api.hyperliquid-testnet.xyz/ws'
      : 'wss://api.hyperliquid.xyz/ws';
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    logger.info(`[MarketIngester] Starting with ${this.trackedSymbols.length} symbols`);

    // Initial fetch
    await this.fetchAllPrices();
    await this.fetchAllOrderbooks();

    // Polling intervals
    const priceInterval = setInterval(() => this.fetchAllPrices(), 5000);
    const obInterval = setInterval(() => this.fetchAllOrderbooks(), 10000);
    const fundingInterval = setInterval(() => this.fetchFundingRates(), 60000);

    this.intervals = [priceInterval, obInterval, fundingInterval];

    logger.info('[MarketIngester] Polling started');
  }

  stop(): void {
    this.running = false;
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
    logger.info('[MarketIngester] Stopped');
  }

  // ─── Price Data ───────────────────────────────────────────────────

  async fetchAllPrices(): Promise<Map<string, number>> {
    try {
      const response = await axios.post(`${this.baseUrl}/info`, {
        type: 'allMids',
      });

      if (response.data && typeof response.data === 'object') {
        for (const [symbol, price] of Object.entries(response.data)) {
          const numPrice = typeof price === 'string' ? parseFloat(price) : Number(price);
          if (Number.isFinite(numPrice)) {
            const prev = this.prices.get(symbol);
            this.prices.set(symbol, numPrice);
            if (prev !== numPrice) {
              eventBus.emitEvent('market:price', { symbol, price: numPrice, previous: prev });
            }
          }
        }
      }
    } catch (error) {
      logger.error('[MarketIngester] Failed to fetch prices:', error);
    }
    return this.prices;
  }

  getPrice(symbol: string): number | undefined {
    return this.prices.get(symbol);
  }

  getAllPrices(): Map<string, number> {
    return new Map(this.prices);
  }

  // ─── Orderbook Data ───────────────────────────────────────────────

  async fetchOrderbook(symbol: string): Promise<OrderBookSnapshot | null> {
    try {
      const response = await axios.post(`${this.baseUrl}/info`, {
        type: 'l2Book',
        coin: symbol,
      });

      if (response.data?.levels) {
        const [bids, asks] = response.data.levels;
        const parsedBids = bids.slice(0, 20).map((l: HyperliquidOrderBookLevel) => ({
          price: parseFloat(l.px),
          size: parseFloat(l.sz),
        }));
        const parsedAsks = asks.slice(0, 20).map((l: HyperliquidOrderBookLevel) => ({
          price: parseFloat(l.px),
          size: parseFloat(l.sz),
        }));

        const bestBid = parsedBids[0]?.price || 0;
        const bestAsk = parsedAsks[0]?.price || 0;
        const midPrice = (bestBid + bestAsk) / 2;
        const spread = bestAsk - bestBid;

        const snapshot: OrderBookSnapshot = {
          symbol,
          timestamp: Date.now(),
          bids: parsedBids,
          asks: parsedAsks,
          midPrice,
          spread,
        };

        this.orderbooks.set(symbol, snapshot);
        eventBus.emitEvent('market:orderbook', snapshot);
        return snapshot;
      }
    } catch (error) {
      logger.error(`[MarketIngester] Failed to fetch orderbook for ${symbol}:`, error);
    }
    return null;
  }

  async fetchAllOrderbooks(): Promise<void> {
    for (const symbol of this.trackedSymbols) {
      await this.fetchOrderbook(symbol);
    }
  }

  getOrderbook(symbol: string): OrderBookSnapshot | undefined {
    return this.orderbooks.get(symbol);
  }

  // ─── Candle Data ──────────────────────────────────────────────────

  async fetchCandles(symbol: string, interval: string = '1h', limit: number = 100): Promise<Candle[]> {
    try {
      // Map common interval names to Hyperliquid resolution seconds
      const resolutionMap: Record<string, number> = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '4h': 14400,
        '1d': 86400,
      };
      const resolution = resolutionMap[interval] || 3600;

      const response = await axios.post(`${this.baseUrl}/info`, {
        type: 'candleSnapshot',
        req: {
          coin: symbol,
          resolution,
          limit,
        },
      });

      if (Array.isArray(response.data)) {
        return response.data.map((c: any) => ({
          symbol,
          timestamp: c.T || c.t || 0,
          open: parseFloat(c.o || c.O || '0'),
          high: parseFloat(c.h || c.H || '0'),
          low: parseFloat(c.l || c.L || '0'),
          close: parseFloat(c.c || c.C || '0'),
          volume: parseFloat(c.v || c.V || '0'),
        }));
      }
    } catch (error) {
      logger.error(`[MarketIngester] Failed to fetch candles for ${symbol}:`, error);
    }
    return [];
  }

  // ─── Funding Rates ────────────────────────────────────────────────

  async fetchFundingRates(): Promise<Map<string, FundingRate>> {
    try {
      const response = await axios.post(`${this.baseUrl}/info`, {
        type: 'metaAndAssetCtxs',
      });

      if (Array.isArray(response.data)) {
        const [, contexts] = response.data;
        if (Array.isArray(contexts)) {
          for (let i = 0; i < contexts.length; i++) {
            const ctx = contexts[i];
            if (ctx?.funding && ctx.coin) {
              const rate = parseFloat(ctx.funding);
              const nextTime = ctx.nextFundingTime ? parseInt(ctx.nextFundingTime) : 0;
              const symbol = typeof ctx.coin === 'string' ? ctx.coin : `UNKNOWN_${i}`;

              this.fundingRates.set(symbol, {
                symbol,
                rate,
                nextFundingTime: nextTime,
                timestamp: Date.now(),
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('[MarketIngester] Failed to fetch funding rates:', error);
    }
    return this.fundingRates;
  }

  getFundingRate(symbol: string): FundingRate | undefined {
    return this.fundingRates.get(symbol);
  }

  // ─── Status ───────────────────────────────────────────────────────

  getStatus() {
    return {
      running: this.running,
      trackedSymbols: this.trackedSymbols,
      pricesAvailable: this.prices.size,
      orderbooksAvailable: this.orderbooks.size,
      fundingRatesAvailable: this.fundingRates.size,
    };
  }
}

// Singleton
let instance: MarketIngester | null = null;

export function getMarketIngester(symbols?: string[]): MarketIngester {
  if (!instance) {
    instance = new MarketIngester(symbols);
  }
  return instance;
}

export default MarketIngester;
