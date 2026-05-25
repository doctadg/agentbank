import { Router, Response, Request } from 'express';
import { adminAuth } from './middleware';
import * as svc from './service';

export function createAdminRouter() {
  const router = Router();
  router.use(adminAuth);

  router.post('/snapshot', async (_req: Request, res: Response) => {
    try { res.json({ success: true, data: await svc.snapshotHolders() }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.post('/reset', (_req: Request, res: Response) => {
    try { res.json({ success: true, data: svc.resetData() }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
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
