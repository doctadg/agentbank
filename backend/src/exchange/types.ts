/**
 * Exchange Adapter Abstraction Layer - Common Types
 *
 * Defines exchange-agnostic interfaces and types that decouple consumers
 * from any specific exchange implementation.
 */

// ─── Order Types ─────────────────────────────────────────────────────────────

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  price?: number;
  reduceOnly?: boolean;
  bypassCooldown?: boolean;
  orderType?: 'limit' | 'market';
  clientOrderId?: string;
  confidence?: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  filledPrice?: number;
  filledSize?: number;
  status: string;
  error?: string;
}

export interface CancelOrderParams {
  symbol: string;
  orderId: string;
  trackCancelledWindow?: boolean;
  forceCancel?: boolean;
}

// ─── Position Types ──────────────────────────────────────────────────────────

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnL: number;
  leverage: number;
  marginUsed: number;
  entryTime?: Date;
}

// ─── Account Types ───────────────────────────────────────────────────────────

export interface AccountState {
  equity: number;
  withdrawable: number;
  positions: Position[];
  marginUsed: number;
}

// ─── Market Data Types ───────────────────────────────────────────────────────

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface OrderbookSnapshot {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
}

export interface MarketInfo {
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
  priceDecimals: number;
  sizeDecimals: number;
  minOrderSize: number;
  sizeStep: number;
  tickSize?: number;
}

// ─── Subscription Types ──────────────────────────────────────────────────────

export interface Subscription {
  unsubscribe(): void;
}

export type OrderbookCallback = (snapshot: OrderbookSnapshot) => void;
export type CandleCallback = (candle: Candle) => void;

// ─── Exchange Client Interface ───────────────────────────────────────────────

export interface IExchangeClient {
  placeOrder(params: OrderParams): Promise<OrderResult>;
  cancelOrder(params: CancelOrderParams): Promise<void>;
  getPosition(symbol: string): Promise<Position | null>;
  getPositions(): Promise<Position[]>;
  getCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[]>;
  getAccountState(): Promise<AccountState>;
  subscribeOrderbook(symbol: string, callback: OrderbookCallback): Subscription;
  subscribeCandles(symbol: string, timeframe: string, callback: CandleCallback): Subscription;
  getMarketInfo(symbol: string): Promise<MarketInfo>;
  healthCheck(): Promise<boolean>;
}
