import { Router, Response } from 'express';
import * as service from './service';

/**
 * Vault Routes — public, no auth required
 * Mounted at /api/vault
 */
export function createVaultRouter() {
  const router = Router();

  // GET /api/vault/stats
  router.get('/stats', (_req, res: Response) => {
    try {
      const stats = service.getVaultStats();
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/vault/distributions
  router.get('/distributions', (_req, res: Response) => {
    try {
      const distributions = service.getDistributions();
      res.json({ success: true, data: distributions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
