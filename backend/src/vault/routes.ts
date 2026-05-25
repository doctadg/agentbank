import { Router, Response } from 'express';
import * as svc from './service';

export function createVaultRouter() {
  const router = Router();
  router.get('/stats', (_req, res: Response) => {
    try { res.json({ success: true, data: svc.getVaultStats() }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });
  return router;
}
