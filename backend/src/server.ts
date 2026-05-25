/**
 * AgentBank Server — Express Entry Point
 *
 * Bootstraps all subsystems in order:
 *   config → Database → EventBus → HyperliquidClient → MarketIngester → ExecutionEngine
 *   → Express API routes → WebSocket server → Listen
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import logger from './core/logger';
import { initDatabase, closeDatabase } from './db/database';
import eventBus from './core/event-bus';
import { HyperliquidClient } from './exchange/hyperliquid-client';
import { HyperliquidAdapter } from './exchange/hyperliquid-adapter';
import { getMarketIngester, MarketIngester } from './market/market-ingester';
import executionEngine from './execution/execution-engine';
import apiRoutes from './api';
import { initWebSocket, closeWebSocket, getWsStats } from './api/websocket';
import { errorHandler } from './middleware/errorHandler';

async function main() {
  logger.info('╔══════════════════════════════════════╗');
  logger.info('║       AgentBank Backend v1.0.0       ║');
  logger.info('╚══════════════════════════════════════╝');

  // 1. Initialize Database
  try {
    initDatabase(config.dbPath);
    logger.info('[Boot] Database initialized');
  } catch (error) {
    logger.error('[Boot] Database initialization failed:', error);
    process.exit(1);
  }

  // 2. Initialize HyperliquidClient
  let hyperliquidClient: HyperliquidClient | null = null;
  let hyperliquidAdapter: HyperliquidAdapter | null = null;

  try {
    hyperliquidClient = new HyperliquidClient();

    if (hyperliquidClient.isConfigured()) {
      await hyperliquidClient.initialize();
      hyperliquidAdapter = new HyperliquidAdapter(hyperliquidClient);
      logger.info('[Boot] Hyperliquid client initialized');
    } else {
      logger.warn('[Boot] Hyperliquid client not configured — paper trading mode');
    }
  } catch (error) {
    logger.warn('[Boot] Hyperliquid client initialization failed (paper mode will be used):', error);
  }

  // 3. Start Market Ingester
  let marketIngester: MarketIngester | null = null;
  try {
    marketIngester = getMarketIngester();
    await marketIngester.start();
    logger.info('[Boot] Market ingester started');
  } catch (error) {
    logger.warn('[Boot] Market ingester failed to start:', error);
  }

  // 4. Wire up price updates to execution engine
  eventBus.onEvent('market:price', (payload) => {
    const { symbol, price } = payload.data;
    if (symbol && price) {
      executionEngine.updatePrice(symbol, price);
    }
  });

  // 5. Set up Express
  const app = express();

  // Middleware
  app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  // Health check at root (lightweight, no auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', apiRoutes);

  // Error handler
  app.use(errorHandler);

  // 6. Create HTTP server
  const server = http.createServer(app);

  // 7. Initialize WebSocket
  initWebSocket(server);

  // 8. Start listening
  const PORT = config.port;
  server.listen(PORT, () => {
    logger.info(`[Boot] Server listening on port ${PORT}`);
    logger.info(`[Boot] Environment: ${config.paperTrading ? 'PAPER TRADING' : 'LIVE TRADING'}`);
    logger.info(`[Boot] Hyperliquid: ${config.hyperliquidTestnet ? 'TESTNET' : 'MAINNET'}`);
    logger.info(`[Boot] API: http://localhost:${PORT}/api`);
    logger.info(`[Boot] WebSocket: ws://localhost:${PORT}/ws`);
  });

  // 9. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`[Shutdown] ${signal} received, shutting down gracefully...`);

    // Stop market ingester
    try {
      marketIngester?.stop();
    } catch (e) {
      // ignore
    }

    // Close WebSocket
    closeWebSocket();

    // Close HTTP server
    server.close(() => {
      logger.info('[Shutdown] HTTP server closed');
    });

    // Close database
    closeDatabase();

    logger.info('[Shutdown] Complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason) => {
    logger.error('[Process] Unhandled rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('[Process] Uncaught exception:', error);
    shutdown('uncaughtException');
  });
}

main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
