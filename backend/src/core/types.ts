/**
 * AgentBank Trading-Relevant Types
 *
 * Trimmed from PerpsTrader shared/types.ts to only trading-relevant types.
 */

// ─── Order Types ──────────────────────────────────────────────────────────────

export interface TradingSignal {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  size: number;
  price?: number;
  type: 'MARKET' | 'LIMIT';
  timestamp: Date;
  confidence: number;
  strategyId: string;
  reason: string;
}

export interface Trade {
  id: string;
  strategyId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  fee: number;
  pnl?: number;
  timestamp: Date;
  type: 'MARKET' | 'LIMIT';
  status: 'FILLED' | 'PARTIAL' | 'CANCELLED';
  entryExit: 'ENTRY' | 'EXIT';
}

// ─── Position & Portfolio Types ───────────────────────────────────────────────

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

export interface Portfolio {
  totalValue: number;
  availableBalance: number;
  usedBalance: number;
  positions: Position[];
  dailyPnL: number;
  unrealizedPnL: number;
}

// ─── Risk Types ───────────────────────────────────────────────────────────────

export interface RiskAssessment {
  approved: boolean;
  suggestedSize: number;
  riskScore: number;
  warnings: string[];
  stopLoss: number;
  takeProfit: number;
  leverage: number;
}

// ─── Market Data Types ────────────────────────────────────────────────────────

export interface MarketData {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
}

// ─── Strategy Types ───────────────────────────────────────────────────────────

export interface StrategyPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  sharpeRatio: number;
  maxDrawdown: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
}

// ─── System Types ─────────────────────────────────────────────────────────────

export interface SystemStatus {
  agent: 'RUNNING' | 'STOPPED' | 'ERROR';
  execution: 'RUNNING' | 'STOPPED' | 'ERROR';
  market: 'RUNNING' | 'STOPPED' | 'ERROR';
  uptime: number;
  lastUpdate: Date;
}
