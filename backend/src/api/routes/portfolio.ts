/**
 * Portfolio API Routes
 *
 * GET /api/portfolio           — Get portfolio overview
 * GET /api/portfolio/positions — Get current positions
 * GET /api/portfolio/trades    — Get recent trades
 * GET /api/portfolio/pnl       — Get P&L summary
 */

import { Router, Request, Response } from 'express';
import executionEngine from '../../execution/execution-engine';
import { getTrades, getTradeCount, getPortfolioPerformance } from '../../db/database';
import logger from '../../core/logger';

const router = Router();

// ─── GET /api/portfolio ───────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    const portfolio = await executionEngine.getPortfolio();

    res.json({
      success: true,
      portfolio: {
        totalValue: portfolio.totalValue,
        availableBalance: portfolio.availableBalance,
        usedBalance: portfolio.usedBalance,
        dailyPnL: portfolio.dailyPnL,
        unrealizedPnL: portfolio.unrealizedPnL,
        positionCount: portfolio.positions.length,
        positions: portfolio.positions.map((p) => ({
          symbol: p.symbol,
          side: p.side,
          size: p.size,
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          unrealizedPnL: p.unrealizedPnL,
          leverage: p.leverage,
          marginUsed: p.marginUsed,
        })),
      },
    });
  } catch (error: any) {
    logger.error('[Portfolio] Failed to get portfolio:', error);
    res.status(500).json({ error: error.message || 'Failed to get portfolio' });
  }
});

// ─── GET /api/portfolio/positions ─────────────────────────────────────────

router.get('/positions', async (_req: Request, res: Response) => {
  try {
    const positions = await executionEngine.getPositions();

    res.json({
      success: true,
      positions: positions.map((p) => ({
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        entryPrice: p.entryPrice,
        markPrice: p.markPrice,
        unrealizedPnL: p.unrealizedPnL,
        leverage: p.leverage,
        marginUsed: p.marginUsed,
      })),
    });
  } catch (error: any) {
    logger.error('[Portfolio] Failed to get positions:', error);
    res.status(500).json({ error: error.message || 'Failed to get positions' });
  }
});

// ─── GET /api/portfolio/trades ────────────────────────────────────────────

router.get('/trades', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const symbol = req.query.symbol as string | undefined;

    const trades = getTrades(symbol, limit, offset);
    const total = getTradeCount(symbol);

    res.json({
      success: true,
      trades,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error: any) {
    logger.error('[Portfolio] Failed to get trades:', error);
    res.status(500).json({ error: error.message || 'Failed to get trades' });
  }
});

// ─── GET /api/portfolio/pnl ───────────────────────────────────────────────

router.get('/pnl', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '30d';

    const performance = getPortfolioPerformance(period);
    const realizedPnL = await executionEngine.getRealizedPnL();

    res.json({
      success: true,
      pnl: {
        period,
        totalPnL: performance.totalPnL,
        tradeCount: performance.tradeCount,
        realizedPnL,
      },
    });
  } catch (error: any) {
    logger.error('[Portfolio] Failed to get P&L:', error);
    res.status(500).json({ error: error.message || 'Failed to get P&L' });
  }
});

export default router;
