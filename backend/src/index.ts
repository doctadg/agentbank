import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { initDb, closeDb } from './db';
import { authMiddleware } from './auth/middleware';
import { AuthenticatedRequest } from './types';
import authRoutes from './auth/routes';
import { createHolderRouter } from './holder/routes';
import { createVaultRouter } from './vault/routes';
import { createAdminRouter } from './admin/routes';
import { createAgentRouter } from './agent/routes';
import { startAgent, stopAgent } from './agent/router';
import { errorHandler } from './middleware/errorHandler';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/vault', createVaultRouter());
app.use('/api/holder', createHolderRouter());
app.use('/api/admin', createAdminRouter());
app.use('/api/agent', createAgentRouter());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.use(errorHandler);

initDb();
app.listen(config.port, () => {
  console.log(`AgentBank API on port ${config.port}`);
  console.log(`  routes: /api/auth /api/holder /api/vault /api/admin /api/agent /api/health`);
  // Kick off the paper copy-trading agent in the background.
  startAgent().catch((e) => console.error('[agent] failed to start:', e));
});

process.on('SIGINT', () => { stopAgent(); closeDb(); process.exit(0); });
process.on('SIGTERM', () => { stopAgent(); closeDb(); process.exit(0); });
