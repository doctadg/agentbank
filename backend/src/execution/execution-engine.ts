/**
 * Execution Engine (AgentBank Rewrite)
 *
 * Decoupled from PerpsTrader's data-manager, risk-manager, and message-bus.
 * Uses direct SQLite for persistence and eventBus for internal events.
 * Paper trading mode is the default.
 */

import { TradingSignal, Trade, Portfolio, Position, RiskAssessment } from '../core/types';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../core/logger';
import eventBus from '../core/event-bus';
import { saveTrade, getTrades, getTradeCount, getPortfolioPerformance, saveOrderHistory } from '../db/database';
import { PaperPortfolio } from './paper-portfolio';
import { BatchProcessor } from './batch-processor';

// Track current prices for portfolio valuation
const currentPrices: Map<string, number> = new Map();

// Anti-churn thresholds
const DEFAULT_MIN_SIGNAL_CONFIDENCE = 0.60;
const DEFAULT_MIN_MARKET_SIGNAL_CONFIDENCE = 0.65;

function parseConfidenceEnv(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    logger.warn(`[ExecutionEngine] Invalid ${envName}=${raw}. Falling back to ${fallback}`);
    return fallback;
  }
  return parsed;
}

// Signal deduplication
interface SignalFingerprint {
  action: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  confidence: number;
  reason: string;
  timestamp: number;
}

interface ManagedExitPlan {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timestamp: number;
}

interface ExecutionOrderStats {
  submitted: number;
  filled: number;
  resting: number;
  cancelled: number;
  rejected: number;
  blocked: number;
}

export class ExecutionEngine {
  private paperPortfolio: PaperPortfolio;
  private batchProcessor: BatchProcessor;
  private isTestnet: boolean;
  private lastOrderTime: Map<string, number> = new Map();
  private lastSignalFingerprint: Map<string, SignalFingerprint> = new Map();
  private lastCancellationTime: Map<string, number> = new Map();
  private failureCooldownUntil: Map<string, number> = new Map();
  private hourlyOrderAttempts: Map<string, { count: number; windowStart: number }> = new Map();
  private signalCountWindow: Map<string, { count: number; windowStart: number }> = new Map();
  private orderStats: Map<string, ExecutionOrderStats> = new Map();
  private managedExitPlans: Map<string, ManagedExitPlan> = new Map();

  // Cooldowns
  private readonly ORDER_COOLDOWN_MS = 30000;
  private readonly MIN_ORDER_COOLDOWN_MS = 10000;
  private readonly CANCELLATION_COOLDOWN_MS = 5000;
  private readonly MAX_ORDERS_PER_COIN_PER_HOUR = 3;
  private readonly MIN_SIGNAL_CONFIDENCE = parseConfidenceEnv('MIN_SIGNAL_CONFIDENCE', DEFAULT_MIN_SIGNAL_CONFIDENCE);
  private readonly MIN_MARKET_SIGNAL_CONFIDENCE = parseConfidenceEnv('MIN_MARKET_SIGNAL_CONFIDENCE', DEFAULT_MIN_MARKET_SIGNAL_CONFIDENCE);
  private readonly SIGNAL_DEDUP_WINDOW_MS = 60000;
  private readonly MIN_ENTRY_NOTIONAL_USD = 10;

  // In-memory risk state (replaces risk-manager)
  private positionRiskState: Map<string, { stopLoss: number; takeProfit: number; lastCheck: number }> = new Map();

  constructor() {
    this.isTestnet = config.hyperliquidTestnet;
    this.paperPortfolio = new PaperPortfolio();
    this.batchProcessor = new BatchProcessor();

    logger.info(`[ExecutionEngine] Initialized (paper=${config.paperTrading}, testnet=${this.isTestnet})`);
    logger.info(`[ExecutionEngine] Confidence thresholds: min=${this.MIN_SIGNAL_CONFIDENCE}, market=${this.MIN_MARKET_SIGNAL_CONFIDENCE}`);
  }

  /**
   * Execute a trading signal
   */
  async executeSignal(signal: TradingSignal, riskAssessment?: RiskAssessment): Promise<Trade> {
    const now = Date.now();
    const symbolKey = signal.symbol.toUpperCase();

    // Default risk assessment if not provided
    const risk: RiskAssessment = riskAssessment || {
      approved: true,
      suggestedSize: signal.size,
      riskScore: 0.5,
      warnings: [],
      stopLoss: 0,
      takeProfit: 0,
      leverage: config.paperTrading ? 10 : 1,
    };

    if (!risk.approved) {
      throw new Error(`Risk assessment rejected for ${signal.symbol}: ${risk.warnings.join(', ')}`);
    }

    if (signal.action === 'HOLD') {
      throw new Error('Cannot execute HOLD signal');
    }

    // Update price cache
    if (signal.price) {
      currentPrices.set(signal.symbol, signal.price);
    }

    try {
      // PAPER TRADING PATH
      if (config.paperTrading) {
        return await this.executePaperTrade(signal, risk, symbolKey, now);
      }

      // LIVE TRADING PATH - would use exchangeClient
      // For now, fall back to paper trading
      logger.warn(`[ExecutionEngine] Live trading not fully configured, using paper mode for ${signal.symbol}`);
      return await this.executePaperTrade(signal, risk, symbolKey, now);

    } catch (error) {
      logger.error('Signal execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute a paper trade
   */
  private async executePaperTrade(
    signal: TradingSignal,
    risk: RiskAssessment,
    symbolKey: string,
    now: number
  ): Promise<Trade> {
    const trade = await this.paperPortfolio.executeTrade(
      signal.symbol,
      signal.action as 'BUY' | 'SELL',
      Math.abs(risk.suggestedSize || signal.size),
      signal.price || currentPrices.get(signal.symbol) || 0,
      signal.strategyId,
      risk.leverage || 10
    );

    // Persist to database
    if (trade.status === 'FILLED' || trade.status === 'PARTIAL') {
      try {
        saveTrade(trade);
      } catch (dbErr) {
        logger.warn('[ExecutionEngine] Failed to persist paper trade:', dbErr);
      }
    }

    // Register managed exit plan for entries
    if (trade.status === 'FILLED' && trade.entryExit === 'ENTRY') {
      const entryPrice = trade.price > 0 ? trade.price : (signal.price || 0);
      const entrySide: 'LONG' | 'SHORT' = signal.action === 'BUY' ? 'LONG' : 'SHORT';
      this.registerManagedExitPlan(signal.symbol, entrySide, entryPrice, risk.stopLoss, risk.takeProfit);
      this.positionRiskState.set(symbolKey, {
        stopLoss: risk.stopLoss,
        takeProfit: risk.takeProfit,
        lastCheck: now,
      });

      logger.info(`[PAPER] Registered exit plan for ${signal.symbol}: SL=${risk.stopLoss}, TP=${risk.takeProfit}`);
    }

    // Clear exit plan after exit
    const isExit = trade.entryExit === 'EXIT';
    if (isExit) {
      this.clearManagedExitPlan(signal.symbol);
      this.positionRiskState.delete(symbolKey);
    }

    // Emit event
    eventBus.emitEvent('trade:executed', { trade, paper: true });

    logger.info(
      `[PAPER] ${trade.entryExit} ${trade.side} ${trade.size.toFixed(4)} ${trade.symbol} @ ${trade.price.toFixed(2)} PnL: $${(trade.pnl || 0).toFixed(2)}`
    );

    return trade;
  }

  /**
   * Check and execute stop-loss / take-profit for all tracked positions
   */
  async checkManagedExits(): Promise<Trade[]> {
    const trades: Trade[] = [];
    const now = Date.now();

    for (const [symbol, plan] of this.managedExitPlans.entries()) {
      const currentPrice = currentPrices.get(symbol);
      if (!currentPrice) continue;

      let shouldExit = false;
      let reason = '';

      // Stop-loss check
      if (plan.stopLoss > 0) {
        if (plan.side === 'LONG' && currentPrice <= plan.stopLoss) {
          shouldExit = true;
          reason = `Stop-loss hit: ${currentPrice} <= ${plan.stopLoss}`;
        } else if (plan.side === 'SHORT' && currentPrice >= plan.stopLoss) {
          shouldExit = true;
          reason = `Stop-loss hit: ${currentPrice} >= ${plan.stopLoss}`;
        }
      }

      // Take-profit check
      if (plan.takeProfit > 0 && !shouldExit) {
        if (plan.side === 'LONG' && currentPrice >= plan.takeProfit) {
          shouldExit = true;
          reason = `Take-profit hit: ${currentPrice} >= ${plan.takeProfit}`;
        } else if (plan.side === 'SHORT' && currentPrice <= plan.takeProfit) {
          shouldExit = true;
          reason = `Take-profit hit: ${currentPrice} <= ${plan.takeProfit}`;
        }
      }

      if (shouldExit) {
        try {
          const exitSignal: TradingSignal = {
            id: uuidv4(),
            symbol,
            action: plan.side === 'LONG' ? 'SELL' : 'BUY',
            size: 0,
            price: currentPrice,
            type: 'MARKET',
            timestamp: new Date(),
            confidence: 1.0,
            strategyId: 'managed-exit',
            reason,
          };

          const trade = await this.executeSignal(exitSignal);
          trades.push(trade);
          logger.info(`[ExecutionEngine] Managed exit for ${symbol}: ${reason}`);
        } catch (err) {
          logger.error(`[ExecutionEngine] Failed managed exit for ${symbol}:`, err);
        }
      }
    }

    return trades;
  }

  /**
   * Get current portfolio state
   */
  async getPortfolio(): Promise<Portfolio> {
    if (config.paperTrading) {
      const paperPositions = this.paperPortfolio.getPositions();
      const positions: Position[] = paperPositions.map((p: any) => ({
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        entryPrice: p.entryPrice,
        markPrice: p.entryPrice,
        unrealizedPnL: 0,
        leverage: p.leverage || 1,
        marginUsed: (p.entryPrice * p.size) / (p.leverage || 1),
      }));

      const totalValue = this.paperPortfolio.getAvailableBalance() +
        positions.reduce((sum, pos) => sum + pos.size * pos.entryPrice, 0);

      return {
        totalValue,
        availableBalance: this.paperPortfolio.getAvailableBalance(),
        usedBalance: positions.reduce((sum, pos) => sum + pos.marginUsed, 0),
        positions,
        dailyPnL: (this.paperPortfolio as any).getRealizedPnL?.() || 0,
        unrealizedPnL: 0,
      };
    }

    // Return empty portfolio for non-configured live mode
    return {
      totalValue: 0,
      availableBalance: 0,
      usedBalance: 0,
      positions: [],
      dailyPnL: 0,
      unrealizedPnL: 0,
    };
  }

  /**
   * Get recent trades from DB
   */
  async getRecentTrades(limit: number = 20): Promise<Trade[]> {
    return getTrades(undefined, limit) as any[];
  }

  /**
   * Get current positions
   */
  async getPositions(): Promise<Position[]> {
    const portfolio = await this.getPortfolio();
    return portfolio.positions;
  }

  /**
   * Get realized P&L from DB
   */
  async getRealizedPnL(): Promise<number> {
    const perf = getPortfolioPerformance('30d');
    return perf.totalPnL;
  }

  /**
   * Emergency stop - cancel all orders and close positions
   */
  async emergencyStop(): Promise<void> {
    logger.warn('[ExecutionEngine] Emergency stop requested');
    this.batchProcessor.clearQueue();

    if (config.paperTrading) {
      this.paperPortfolio.closeAllPositions();
    }

    eventBus.emitEvent('system:emergency_stop', { timestamp: Date.now() });
    logger.info('[ExecutionEngine] Emergency stop completed');
  }

  /**
   * Get anti-churn stats for monitoring
   */
  getAntiChurnStats() {
    const now = Date.now();
    const cooldownActive: string[] = [];
    const failureCooldownActive: string[] = [];

    for (const [symbol, lastTime] of this.lastOrderTime.entries()) {
      if (now - lastTime < this.ORDER_COOLDOWN_MS) cooldownActive.push(symbol);
    }
    for (const [symbol, cooldownUntil] of this.failureCooldownUntil.entries()) {
      if (cooldownUntil > now) failureCooldownActive.push(symbol);
    }

    return { cooldownActive, failureCooldownActive, managedExits: this.managedExitPlans.size };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private registerManagedExitPlan(
    symbol: string,
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): void {
    this.managedExitPlans.set(symbol.toUpperCase(), {
      symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      timestamp: Date.now(),
    });
  }

  private clearManagedExitPlan(symbol: string): void {
    this.managedExitPlans.delete(symbol.toUpperCase());
  }

  private generateSignalFingerprint(signal: TradingSignal): SignalFingerprint {
    return {
      action: signal.action,
      price: Math.round((signal.price || 0) * 100) / 100,
      confidence: Math.round(signal.confidence * 100) / 100,
      reason: signal.reason,
      timestamp: Date.now(),
    };
  }

  private isDuplicateSignal(symbol: string, fingerprint: SignalFingerprint): boolean {
    const existing = this.lastSignalFingerprint.get(symbol.toUpperCase());
    if (!existing) return false;

    const age = Date.now() - existing.timestamp;
    if (age > this.SIGNAL_DEDUP_WINDOW_MS) return false;

    return (
      existing.action === fingerprint.action &&
      existing.price === fingerprint.price &&
      existing.confidence === fingerprint.confidence &&
      existing.reason === fingerprint.reason
    );
  }

  private checkSignalRateLimit(symbol: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const symbolKey = symbol.toUpperCase();
    const data = this.signalCountWindow.get(symbolKey);

    if (!data || now - data.windowStart > 60000) {
      this.signalCountWindow.set(symbolKey, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (data.count >= 10) {
      return { allowed: false, reason: `Signal rate limit for ${symbol}: ${data.count}/10 per minute` };
    }

    data.count++;
    return { allowed: true };
  }

  private isExitSignalForPosition(position: any, action: string): boolean {
    if (!position) return false;
    return (position.side === 'LONG' && action === 'SELL') || (position.side === 'SHORT' && action === 'BUY');
  }

  private classifyOrderFailure(status: string, error?: string): string {
    if (status === 'CANCELLED' || status === 'CANCELED') return 'CANCELLED';
    if (status === 'REJECTED' || status === 'INSUFFICIENT_MARGIN') return 'REJECTED';
    return 'BLOCKED';
  }

  // Getters for external access
  getPaperPortfolio(): PaperPortfolio {
    return this.paperPortfolio;
  }

  updatePrice(symbol: string, price: number): void {
    currentPrices.set(symbol, price);
  }

  getCurrentPrice(symbol: string): number | undefined {
    return currentPrices.get(symbol);
  }
}

// Singleton
const executionEngine = new ExecutionEngine();
export default executionEngine;
