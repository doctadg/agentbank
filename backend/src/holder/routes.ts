import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import * as svc from './service';

export function createHolderRouter() {
  const router = Router();

  router.get('/leaderboard', (_req, res: Response) => {
    try { res.json({ success: true, data: svc.getLeaderboard() }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.get('/me', (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const pos = svc.getHolderPosition(req.user.public_key);
      res.json({ success: true, data: pos });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.get('/:publicKey/position', (req: AuthenticatedRequest, res: Response) => {
    try {
      const pos = svc.getHolderPosition(req.params.publicKey);
      if (!pos) { res.status(404).json({ success: false, error: 'Holder not found' }); return; }
      res.json({ success: true, data: pos });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.get('/:publicKey/history', (req: AuthenticatedRequest, res: Response) => {
    try { res.json({ success: true, data: svc.getHolderHistory(req.params.publicKey) }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.get('/:publicKey/rewards', (req: AuthenticatedRequest, res: Response) => {
    try { res.json({ success: true, data: svc.getHolderRewards(req.params.publicKey) }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  return router;
}
