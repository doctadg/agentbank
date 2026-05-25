/**
 * AgentBank Staking API — Express Entry Point
 */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { initDb, closeDb } from './db';
import { authMiddleware } from './auth/middleware';
import { AuthenticatedRequest } from './types';
import authRoutes from './auth/routes';
import { createStakeRouter } from './stake/routes';
import { createVaultRouter } from './vault/routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/vault', createVaultRouter());

// Protected routes — wrap auth middleware for router mounting
const stakeRouter = createStakeRouter();
app.use('/api/stake', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  authMiddleware(req, res, next);
}, stakeRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start
async function start() {
  await initDb();
  app.listen(config.port, () => {
    console.log(`🚀 AgentBank Staking API running on port ${config.port}`);
    console.log(`   CORS: ${config.corsOrigin}`);
    console.log(`   Routes: /api/auth, /api/stake, /api/vault`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

export default app;
