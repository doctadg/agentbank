/**
 * Market Data API Routes
 *
 * GET /api/market/candles/:symbol  — Get candle data
 * GET /api/market/orderbook/:symbol — Get order book snapshot
 * GET /api/market/prices           — Get all latest prices
 * GET /api/market/symbols          — Get tracked symbols
 */

import { Router, Request, Response } from 'express';
import { getMarketIngester } from '../../market/market-ingester';
import logger from '../../core/logger';

const router = Router();

// ─── GET /api/market/candles/:symbol ──────────────────────────────────────

router.get('/candles/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const timeframe = (req.query.timeframe as string) || '1h';
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }

    const ingester = getMarketIngester();
    const candles = await ingester.fetchCandles(symbol.toUpperCase(), timeframe, limit);

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      timeframe,
      candles,
    });
  } catch (error: any) {
    logger.error(`[Market] Failed to get candles for ${req.params.symbol}:`, error);
    res.status(500).json({ error: error.message || 'Failed to get candles' });
  }
});

// ─── GET /api/market/orderbook/:symbol ────────────────────────────────────

router.get('/orderbook/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }

    const ingester = getMarketIngester();
    const orderbook = await ingester.fetchOrderbook(symbol.toUpperCase());

    if (!orderbook) {
      res.status(404).json({ error: `Orderbook not available for ${symbol}` });
      return;
    }

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      orderbook: {
        bids: orderbook.bids,
        asks: orderbook.asks,
        midPrice: orderbook.midPrice,
        spread: orderbook.spread,
        timestamp: orderbook.timestamp,
      },
    });
  } catch (error: any) {
    logger.error(`[Market] Failed to get orderbook for ${req.params.symbol}:`, error);
    res.status(500).json({ error: error.message || 'Failed to get orderbook' });
  }
});

// ─── GET /api/market/prices ───────────────────────────────────────────────

router.get('/prices', async (_req: Request, res: Response) => {
  try {
    const ingester = getMarketIngester();
    const prices = ingester.getAllPrices();

    const priceMap: Record<string, number> = {};
    for (const [symbol, price] of prices.entries()) {
      priceMap[symbol] = price;
    }

    res.json({
      success: true,
      prices: priceMap,
      count: prices.size,
    });
  } catch (error: any) {
    logger.error('[Market] Failed to get prices:', error);
    res.status(500).json({ error: error.message || 'Failed to get prices' });
  }
});

// ─── GET /api/market/symbols ──────────────────────────────────────────────

router.get('/symbols', async (_req: Request, res: Response) => {
  try {
    const ingester = getMarketIngester();
    const status = ingester.getStatus();

    res.json({
      success: true,
      symbols: status.trackedSymbols,
      pricesAvailable: status.pricesAvailable,
      orderbooksAvailable: status.orderbooksAvailable,
    });
  } catch (error: any) {
    logger.error('[Market] Failed to get symbols:', error);
    res.status(500).json({ error: error.message || 'Failed to get symbols' });
  }
});

export default router;
