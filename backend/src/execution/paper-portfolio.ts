/**
 * Paper Portfolio (AgentBank Extract)
 *
 * Manages simulated trading portfolio for paper trading mode.
 * Uses direct SQLite for state persistence instead of PerpsTrader's data-manager.
 */

import { Trade, Portfolio, Position } from '../core/types';
import { getDb } from '../db/database';
import logger from '../core/logger';

export interface PaperPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  entryTime: Date;
  strategyId?: string;
  leverage: number;
}

interface PortfolioSnapshot {
  timestamp: Date;
  totalValue: number;
  realizedPnL: number;
  unrealizedPnL: number;
}

/**
 * Paper Portfolio
 * Tracks simulated positions and P&L for paper trading
 */
export class PaperPortfolio {
  private initialBalance: number = parseFloat(process.env.PAPER_BALANCE || '30000');
  private cashBalance: number;
  private positions: Map<string, PaperPosition> = new Map();
  private realizedPnL: number = 0;
  private trades: Trade[] = [];
  private snapshots: PortfolioSnapshot[] = [];
  private dailyStartValue: number;
  private lastSnapshotTime: Date;

  constructor() {
    this.cashBalance = this.initialBalance;
    this.dailyStartValue = this.initialBalance;
    this.lastSnapshotTime = new Date();
    this.loadState();
  }

  /**
   * Load persisted state from SQLite
   */
  private loadState(): void {
    try {
      const db = getDb();
      const row = db.prepare(
        "SELECT data FROM system_events WHERE event_type = 'paper_portfolio_state' ORDER BY timestamp DESC LIMIT 1"
      ).get() as any;

      if (row?.data) {
        const state = JSON.parse(row.data);
        this.cashBalance = state.cashBalance || this.initialBalance;
        this.realizedPnL = state.realizedPnL || 0;
        this.dailyStartValue = state.dailyStartValue || this.initialBalance;

        if (state.positions) {
          for (const pos of state.positions) {
            if (!pos.symbol || !pos.side || !pos.entryPrice || !pos.size
              || !Number.isFinite(pos.entryPrice) || !Number.isFinite(pos.size) || pos.size <= 0) {
              continue;
            }
            this.positions.set(pos.symbol, {
              ...pos,
              entryTime: new Date(pos.entryTime),
            });
          }
        }
        logger.info(`[PaperPortfolio] Loaded state: $${this.cashBalance.toFixed(2)} cash, ${this.positions.size} positions`);
      }
    } catch (error) {
      logger.warn('[PaperPortfolio] Could not load state, starting fresh:', error);
    }
  }

  /**
   * Save state to SQLite
   */
  saveState(): void {
    try {
      const db = getDb();
      const state = JSON.stringify({
        cashBalance: this.cashBalance,
        realizedPnL: this.realizedPnL,
        dailyStartValue: this.dailyStartValue,
        positions: Array.from(this.positions.values()),
        timestamp: new Date().toISOString(),
      });

      db.prepare(`
        INSERT OR REPLACE INTO system_events (id, event_type, source, severity, data, timestamp)
        VALUES ('paper_portfolio_state', 'paper_portfolio_state', 'paper-portfolio', 'info', ?, ?)
      `).run(state, new Date().toISOString());
    } catch (error) {
      logger.error('[PaperPortfolio] Failed to save state:', error);
    }
  }

  getPositions(): PaperPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Execute a paper trade
   */
  async executeTrade(
    symbol: string,
    side: 'BUY' | 'SELL',
    size: number,
    price: number,
    strategyId?: string,
    leverage: number = 10
  ): Promise<Trade> {
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error(`[PaperPortfolio] Invalid trade size for ${symbol}: ${size}`);
    }
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`[PaperPortfolio] Invalid price for ${symbol}: ${price}`);
    }

    const existingPosition = this.positions.get(symbol);
    let pnl = 0;
    let entryExit: 'ENTRY' | 'EXIT' = 'ENTRY';

    if (existingPosition) {
      if ((existingPosition.side === 'LONG' && side === 'SELL') ||
        (existingPosition.side === 'SHORT' && side === 'BUY')) {
        // Closing position
        const closeSize = Math.min(size, existingPosition.size);
        if (existingPosition.side === 'LONG') {
          pnl = (price - existingPosition.entryPrice) * closeSize;
        } else {
          pnl = (existingPosition.entryPrice - price) * closeSize;
        }

        if (!Number.isFinite(pnl) || Math.abs(pnl) > 10000) {
          logger.error(`[PaperPortfolio] Absurd PnL for ${symbol}: ${pnl}. Clamping.`);
          pnl = 0;
        }

        this.realizedPnL += pnl;
        this.cashBalance += pnl + (closeSize * existingPosition.entryPrice);
        entryExit = 'EXIT';

        if (closeSize >= existingPosition.size) {
          this.positions.delete(symbol);
          logger.info(`[PaperPortfolio] Closed ${symbol}, P&L: $${pnl.toFixed(2)}`);
        } else {
          existingPosition.size -= closeSize;
          logger.info(`[PaperPortfolio] Reduced ${symbol} by ${closeSize}, remaining: ${existingPosition.size}`);
        }
      } else {
        // Adding to position
        const totalCost = existingPosition.entryPrice * existingPosition.size + price * size;
        const totalSize = existingPosition.size + size;
        existingPosition.entryPrice = totalCost / totalSize;
        existingPosition.size = totalSize;
        this.cashBalance -= price * size;
        logger.info(`[PaperPortfolio] Increased ${symbol} to ${totalSize}`);
      }
    } else {
      // Opening new position
      const positionSide = side === 'BUY' ? 'LONG' : 'SHORT';
      const marginRequired = price * size / leverage;

      if (marginRequired > this.cashBalance) {
        throw new Error(`Insufficient balance: need $${marginRequired.toFixed(2)}, have $${this.cashBalance.toFixed(2)}`);
      }

      this.positions.set(symbol, {
        symbol,
        side: positionSide,
        size,
        entryPrice: price,
        entryTime: new Date(),
        strategyId,
        leverage,
      });

      this.cashBalance -= marginRequired;
      logger.info(`[PaperPortfolio] Opened ${positionSide} ${symbol} x${size} @ $${price.toFixed(2)} (${leverage}x)`);
    }

    const trade: Trade = {
      id: crypto.randomUUID ? crypto.randomUUID() : require('uuid').v4(),
      strategyId,
      symbol,
      side,
      size,
      price,
      pnl,
      fee: price * size * 0.0002,
      timestamp: new Date(),
      type: 'MARKET',
      status: 'FILLED',
      entryExit,
    };

    this.trades.push(trade);
    this.saveState();

    return trade;
  }

  getPortfolio(currentPrices: Map<string, number>): Portfolio {
    let unrealizedPnL = 0;
    const positions: Position[] = [];

    for (const [symbol, pos] of this.positions) {
      const currentPrice = currentPrices.get(symbol) || pos.entryPrice;
      const positionPnL = pos.side === 'LONG'
        ? (currentPrice - pos.entryPrice) * pos.size
        : (pos.entryPrice - currentPrice) * pos.size;

      unrealizedPnL += positionPnL;
      positions.push({
        symbol: pos.symbol,
        side: pos.side,
        size: pos.size,
        entryPrice: pos.entryPrice,
        markPrice: currentPrice,
        unrealizedPnL: positionPnL,
        leverage: pos.leverage || 10,
        marginUsed: pos.entryPrice * pos.size / (pos.leverage || 10),
        entryTime: pos.entryTime,
      });
    }

    const totalValue = this.cashBalance + unrealizedPnL +
      Array.from(this.positions.values()).reduce((sum, p) => sum + p.entryPrice * p.size / (p.leverage || 10), 0);

    return {
      totalValue,
      availableBalance: this.cashBalance,
      usedBalance: totalValue - this.cashBalance,
      positions,
      dailyPnL: totalValue - this.dailyStartValue,
      unrealizedPnL,
    };
  }

  getAvailableBalance(): number {
    return this.cashBalance;
  }

  getRealizedPnL(): number {
    return this.realizedPnL;
  }

  getTrades(limit: number = 50): Trade[] {
    return this.trades.slice(-limit);
  }

  getSnapshots(): PortfolioSnapshot[] {
    return this.snapshots;
  }

  closeAllPositions(): void {
    this.positions.clear();
    this.saveState();
    logger.info('[PaperPortfolio] All positions closed');
  }

  reset(): void {
    this.cashBalance = this.initialBalance;
    this.positions.clear();
    this.realizedPnL = 0;
    this.trades = [];
    this.snapshots = [];
    this.dailyStartValue = this.initialBalance;
    this.saveState();
    logger.info('[PaperPortfolio] Reset to initial state');
  }
}

export default PaperPortfolio;
