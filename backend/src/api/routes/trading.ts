/**
 * Trading API Routes
 *
 * POST   /api/trading/order          — Place a new order
 * DELETE /api/trading/order/:id       — Cancel a specific order
 * DELETE /api/trading/orders/:symbol  — Cancel all orders for a symbol
 * POST   /api/trading/signal          — Submit a trading signal
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import executionEngine from '../../execution/execution-engine';
import logger from '../../core/logger';
import { TradingSignal } from '../../core/types';

const router = Router();

// ─── POST /api/trading/order ──────────────────────────────────────────────

router.post('/order', async (req: Request, res: Response) => {
  try {
    const { symbol, side, size, price, type, reduceOnly, confidence } = req.body;

    if (!symbol || !side || !size) {
      res.status(400).json({ error: 'symbol, side, and size are required' });
      return;
    }

    if (!['BUY', 'SELL'].includes(side)) {
      res.status(400).json({ error: 'side must be BUY or SELL' });
      return;
    }

    const signal: TradingSignal = {
      id: uuidv4(),
      symbol: symbol.toUpperCase(),
      action: side as 'BUY' | 'SELL',
      size: Math.abs(Number(size)),
      price: price ? Number(price) : undefined,
      type: type || 'MARKET',
      timestamp: new Date(),
      confidence: confidence || 0.7,
      strategyId: 'manual',
      reason: 'Manual order via API',
    };

    const trade = await executionEngine.executeSignal(signal);

    res.json({
      success: true,
      trade: {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        size: trade.size,
        price: trade.price,
        status: trade.status,
        pnl: trade.pnl,
        timestamp: trade.timestamp,
      },
    });
  } catch (error: any) {
    logger.error('[Trading] Order placement failed:', error);
    res.status(500).json({ error: error.message || 'Order placement failed' });
  }
});

// ─── DELETE /api/trading/order/:id ────────────────────────────────────────

router.delete('/order/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Order ID is required' });
      return;
    }

    // In paper mode, orders are instant — nothing to cancel
    // In live mode, this would delegate to HyperliquidClient.cancelOrder
    logger.info(`[Trading] Cancel order requested: ${id}`);

    res.json({
      success: true,
      message: `Cancel request sent for order ${id}`,
      orderId: id,
    });
  } catch (error: any) {
    logger.error('[Trading] Order cancellation failed:', error);
    res.status(500).json({ error: error.message || 'Order cancellation failed' });
  }
});

// ─── DELETE /api/trading/orders/:symbol ───────────────────────────────────

router.delete('/orders/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }

    logger.info(`[Trading] Cancel all orders requested for ${symbol}`);

    res.json({
      success: true,
      message: `Cancel all orders requested for ${symbol}`,
      symbol: symbol.toUpperCase(),
    });
  } catch (error: any) {
    logger.error('[Trading] Cancel all orders failed:', error);
    res.status(500).json({ error: error.message || 'Cancel all orders failed' });
  }
});

// ─── POST /api/trading/signal ─────────────────────────────────────────────

router.post('/signal', async (req: Request, res: Response) => {
  try {
    const { symbol, action, size, price, type, confidence, strategyId, reason } = req.body;

    if (!symbol || !action || !size) {
      res.status(400).json({ error: 'symbol, action, and size are required' });
      return;
    }

    if (!['BUY', 'SELL', 'HOLD'].includes(action)) {
      res.status(400).json({ error: 'action must be BUY, SELL, or HOLD' });
      return;
    }

    const signal: TradingSignal = {
      id: uuidv4(),
      symbol: symbol.toUpperCase(),
      action: action as 'BUY' | 'SELL' | 'HOLD',
      size: Math.abs(Number(size)),
      price: price ? Number(price) : undefined,
      type: type || 'MARKET',
      timestamp: new Date(),
      confidence: Number(confidence) || 0.7,
      strategyId: strategyId || 'api-signal',
      reason: reason || 'API signal submission',
    };

    if (signal.action === 'HOLD') {
      res.json({
        success: true,
        message: 'HOLD signal received — no action taken',
        signal,
      });
      return;
    }

    const trade = await executionEngine.executeSignal(signal);

    res.json({
      success: true,
      signal,
      trade: {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        size: trade.size,
        price: trade.price,
        status: trade.status,
        pnl: trade.pnl,
        entryExit: trade.entryExit,
        timestamp: trade.timestamp,
      },
    });
  } catch (error: any) {
    logger.error('[Trading] Signal execution failed:', error);
    res.status(500).json({ error: error.message || 'Signal execution failed' });
  }
});

export default router;
