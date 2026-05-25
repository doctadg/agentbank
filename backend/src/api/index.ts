/**
 * API Route Index
 *
 * Mounts all route modules onto a single router.
 */

import { Router } from 'express';
import tradingRoutes from './routes/trading';
import portfolioRoutes from './routes/portfolio';
import marketRoutes from './routes/market';
import systemRoutes from './routes/system';

const router = Router();

// Mount route modules
router.use('/trading', tradingRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/market', marketRoutes);
router.use('/system', systemRoutes);

export default router;
