/**
 * Hyperliquid Adapter (AgentBank)
 *
 * Implements IExchangeClient by wrapping the existing HyperliquidClient.
 * Maps Hyperliquid-specific types to the common exchange-agnostic types.
 *
 * Adapted from PerpsTrader with PerpsTrader-specific imports replaced.
 */

import {
  IExchangeClient,
  OrderParams,
  OrderResult,
  CancelOrderParams,
  Position,
  AccountState,
  Candle,
  MarketInfo,
  Subscription,
  OrderbookCallback,
  CandleCallback,
} from './types';
import { HyperliquidClient, HyperliquidPosition, HyperliquidAccountState, HyperliquidOrderResult } from './hyperliquid-client';
import logger from '../core/logger';

/**
 * Map a HyperliquidPosition to the common Position type.
 */
function mapPosition(hlPos: HyperliquidPosition): Position {
  return {
    symbol: hlPos.symbol,
    side: hlPos.side,
    size: hlPos.size,
    entryPrice: hlPos.entryPrice,
    markPrice: hlPos.markPrice,
    unrealizedPnL: hlPos.unrealizedPnL,
    leverage: hlPos.leverage,
    marginUsed: hlPos.marginUsed,
  };
}

/**
 * Map a HyperliquidAccountState to the common AccountState type.
 */
function mapAccountState(hlState: HyperliquidAccountState): AccountState {
  return {
    equity: hlState.equity,
    withdrawable: hlState.withdrawable,
    positions: hlState.positions.map(mapPosition),
    marginUsed: hlState.marginUsed,
  };
}

/**
 * Map a HyperliquidOrderResult to the common OrderResult type.
 */
function mapOrderResult(hlResult: HyperliquidOrderResult): OrderResult {
  return {
    success: hlResult.success,
    orderId: hlResult.orderId,
    filledPrice: hlResult.filledPrice,
    filledSize: hlResult.filledSize,
    status: hlResult.status,
    error: hlResult.error,
  };
}

export class HyperliquidAdapter implements IExchangeClient {
  private client: HyperliquidClient;

  constructor(client: HyperliquidClient) {
    this.client = client;
  }

  /**
   * Place an order via the Hyperliquid client.
   */
  async placeOrder(params: OrderParams): Promise<OrderResult> {
    const hlResult = await this.client.placeOrder({
      symbol: params.symbol,
      side: params.side,
      size: params.size,
      price: params.price,
      reduceOnly: params.reduceOnly,
      bypassCooldown: params.bypassCooldown,
      orderType: params.orderType,
      clientOrderId: params.clientOrderId,
      confidence: params.confidence,
    });
    return mapOrderResult(hlResult);
  }

  /**
   * Cancel an order via the Hyperliquid client.
   */
  async cancelOrder(paramsOrSymbol: CancelOrderParams | string, orderId?: string): Promise<any> {
    if (typeof paramsOrSymbol === 'string') {
      // Original signature: cancelOrder(symbol, orderId)
      return this.client.cancelOrder(paramsOrSymbol, orderId!);
    }
    // IExchangeClient signature: cancelOrder({ symbol, orderId, ... })
    const success = await this.client.cancelOrder(
      paramsOrSymbol.symbol,
      paramsOrSymbol.orderId,
      paramsOrSymbol.trackCancelledWindow ?? true,
      paramsOrSymbol.forceCancel ?? false
    );
    if (!success) {
      throw new Error(`Failed to cancel order ${paramsOrSymbol.orderId} for ${paramsOrSymbol.symbol}`);
    }
  }

  /**
   * Get a single position by symbol.
   */
  async getPosition(symbol: string): Promise<Position | null> {
    const positions = await this.getPositions();
    const upper = symbol.toUpperCase();
    return positions.find((p) => p.symbol.toUpperCase() === upper) ?? null;
  }

  /**
   * Get all open positions from Hyperliquid.
   */
  async getPositions(): Promise<Position[]> {
    const hlState = await this.client.getAccountState();
    return hlState.positions.map(mapPosition);
  }

  /**
   * Get candle data from Hyperliquid via REST info endpoint.
   */
  async getCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[]> {
    try {
      // Use HL info API for candle snapshots
      const axios = require('axios');
      const url = this.client['isTestnet'] 
        ? 'https://api.hyperliquid-testnet.xyz/info' 
        : 'https://api.hyperliquid.xyz/info';
      const resp = await axios.post(url, {
        type: 'candleSnapshot',
        req: { coin: symbol, interval: timeframe, startTime: Date.now() - (limit ?? 100) * 60000 }
      });
      return (resp.data || []).map((c: any) => ({
        open: parseFloat(c.o || '0'),
        high: parseFloat(c.h || '0'),
        low: parseFloat(c.l || '0'),
        close: parseFloat(c.c || '0'),
        volume: c.volume ?? parseFloat(c.v || '0'),
        timestamp: c.timestamp ?? c.T ?? 0,
      }));
    } catch (error) {
      logger.error(`[HyperliquidAdapter] Failed to get candles for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get current account state from Hyperliquid.
   */
  async getAccountState(): Promise<AccountState> {
    const hlState = await this.client.getAccountState();
    return mapAccountState(hlState);
  }

  /**
   * Subscribe to orderbook updates (polling-based).
   */
  subscribeOrderbook(symbol: string, callback: OrderbookCallback): Subscription {
    let active = true;
    const intervalMs = 1000;

    const poll = async () => {
      if (!active) return;
      try {
        const book = await this.client.getL2Book(symbol);
        if (!active) return;

        const bids = Array.isArray(book?.levels?.[0])
          ? book.levels[0].map((l: any) => ({
              price: parseFloat(l?.px ?? '0'),
              size: parseFloat(l?.sz ?? '0'),
            }))
          : [];
        const asks = Array.isArray(book?.levels?.[1])
          ? book.levels[1].map((l: any) => ({
              price: parseFloat(l?.px ?? '0'),
              size: parseFloat(l?.sz ?? '0'),
            }))
          : [];

        callback({ bids, asks, timestamp: Date.now() });
      } catch (error) {
        logger.debug(`[HyperliquidAdapter] Orderbook poll error for ${symbol}:`, error);
      }

      if (active) {
        setTimeout(poll, intervalMs);
      }
    };

    setTimeout(poll, 0);

    return {
      unsubscribe: () => {
        active = false;
      },
    };
  }

  /**
   * Subscribe to candle updates (polling-based).
   */
  subscribeCandles(symbol: string, timeframe: string, callback: CandleCallback): Subscription {
    let active = true;
    const intervalMs = this.parseTimeframeMs(timeframe);
    const pollIntervalMs = Math.max(intervalMs, 5000);
    let lastTimestamp = 0;

    const poll = async () => {
      if (!active) return;
      try {
        const candles = await this.getCandles(symbol, timeframe, 1);
        if (!active) return;

        if (candles.length > 0) {
          const latest = candles[candles.length - 1];
          if (latest.timestamp > lastTimestamp) {
            lastTimestamp = latest.timestamp;
            callback(latest);
          }
        }
      } catch (error) {
        logger.debug(`[HyperliquidAdapter] Candle poll error for ${symbol}:`, error);
      }

      if (active) {
        setTimeout(poll, pollIntervalMs);
      }
    };

    setTimeout(poll, 0);

    return {
      unsubscribe: () => {
        active = false;
      },
    };
  }

  /**
   * Get market info for a symbol.
   */
  async getMarketInfo(symbol: string): Promise<MarketInfo> {
    const upper = symbol.toUpperCase();
    const assetIndex = this.client.getAssetIndex(upper);

    const sizeDecimalsMap: Record<string, number> = {
      BTC: 5,
      ETH: 4,
      SOL: 2,
    };

    const sizeDecimals = sizeDecimalsMap[upper] ?? 4;

    return {
      symbol: upper,
      priceDecimals: Math.max(0, 6 - sizeDecimals),
      sizeDecimals,
      minOrderSize: sizeDecimals >= 4 ? 0.0001 : sizeDecimals >= 2 ? 0.01 : 1,
      sizeStep: Math.pow(10, -sizeDecimals),
    };
  }

  /**
   * Check if the Hyperliquid connection is healthy.
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client.isConfigured()) {
        return false;
      }
      await this.client.getAllMids();
      return true;
    } catch {
      return false;
    }
  }

  // ─── Passthrough Methods ────────────────────────────────────────────

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async initialize(): Promise<void> {
    return this.client.initialize();
  }

  async getAllMids(): Promise<Record<string, number>> {
    return this.client.getAllMids();
  }

  async getL2Book(symbol: string): Promise<any> {
    return this.client.getL2Book(symbol);
  }

  async cancelAllOrders(forceCancel?: boolean): Promise<boolean> {
    return this.client.cancelAllOrders(forceCancel);
  }

  getWalletAddress(): string {
    return this.client.getWalletAddress();
  }

  getUserAddress(): string {
    return this.client.getUserAddress();
  }

  getAssetIndex(symbol: string): number | undefined {
    return this.client.getAssetIndex(symbol);
  }

  async updateLeverage(symbol: string, leverage: number, isCross?: boolean): Promise<boolean> {
    return this.client.updateLeverage(symbol, leverage, isCross);
  }

  async getOpenOrders(): Promise<any[]> {
    return this.client.getOpenOrders();
  }

  // ─── Internal Helpers ───────────────────────────────────────────────

  private parseTimeframeMs(timeframe: string): number {
    const match = timeframe.trim().match(/^(\d+)([smhd])$/i);
    if (!match) return 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') return value * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'd') return value * 24 * 60 * 60 * 1000;
    return 60 * 1000;
  }

  private toHyperliquidInterval(timeframe: string): string {
    const match = timeframe.trim().match(/^(\d+)([smhd])$/i);
    if (!match) return '1m';
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') return '1m';
    if (unit === 'm') return `${value}m`;
    if (unit === 'h') return `${value}h`;
    if (unit === 'd') return `${value}d`;
    return '1m';
  }
}
