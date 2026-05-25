import { Router, Response, Request } from 'express';
import { adminAuth } from './middleware';
import * as svc from './service';

export function createAdminRouter() {
  const router = Router();
  router.use(adminAuth);

  router.post('/snapshot', (_req: Request, res: Response) => {
    try { res.json({ success: true, data: svc.snapshotHolders() }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.post('/distribute', (req: Request, res: Response) => {
    try {
      const { amount, notes } = req.body;
      if (!amount || amount <= 0) { res.status(400).json({ error: 'Valid amount required' }); return; }
      res.json({ success: true, data: svc.distributeRewards(amount, notes) });
    } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
  });

  router.get('/holders', (_req: Request, res: Response) => {
    try { res.json({ success: true, data: svc.getAllHolders() }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.get('/stats', (_req: Request, res: Response) => {
    try { res.json({ success: true, data: svc.getAdminStats() }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  return router;
}
