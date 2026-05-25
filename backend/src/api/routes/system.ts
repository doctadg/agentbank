/**
 * System API Routes
 *
 * GET /api/system/health — Health check
 * GET /api/system/status — Full system status
 */

import { Router, Request, Response } from 'express';
import os from 'os';
import { config } from '../../config';
import { getMarketIngester } from '../../market/market-ingester';
import executionEngine from '../../execution/execution-engine';
import logger from '../../core/logger';

const router = Router();

const startTime = Date.now();

// ─── GET /api/system/health ───────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  const uptime = Date.now() - startTime;
  const memUsage = process.memoryUsage();

  res.json({
    status: 'ok',
    uptime: Math.floor(uptime / 1000),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    },
    version: '1.0.0',
  });
});

// ─── GET /api/system/status ───────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const uptime = Date.now() - startTime;
    const memUsage = process.memoryUsage();
    const loadAvg = os.loadavg();

    // Gather subsystem status
    const marketStatus = getMarketIngester().getStatus();
    const antiChurn = executionEngine.getAntiChurnStats();
    const portfolio = await executionEngine.getPortfolio();

    res.json({
      success: true,
      system: {
        status: 'running',
        uptime: Math.floor(uptime / 1000),
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        nodeVersion: process.version,
        environment: config.paperTrading ? 'paper' : 'live',
        testnet: config.hyperliquidTestnet,
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        systemTotal: Math.round(os.totalmem() / 1024 / 1024),
        systemFree: Math.round(os.freemem() / 1024 / 1024),
      },
      load: {
        '1m': loadAvg[0].toFixed(2),
        '5m': loadAvg[1].toFixed(2),
        '15m': loadAvg[2].toFixed(2),
        cpuCount: os.cpus().length,
      },
      market: marketStatus,
      portfolio: {
        totalValue: portfolio.totalValue,
        positionCount: portfolio.positions.length,
        dailyPnL: portfolio.dailyPnL,
      },
      execution: {
        antiChurn,
      },
    });
  } catch (error: any) {
    logger.error('[System] Failed to get status:', error);
    res.status(500).json({ error: error.message || 'Failed to get system status' });
  }
});

export default router;
