import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import * as service from './service';

/**
 * Staking Routes — all require auth middleware
 * Mounted at /api/stake
 */
export function createStakeRouter() {
  const router = Router();

  // GET /api/stake/position
  router.get('/position', (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const position = service.getPosition(req.user);
      res.json({ success: true, data: position });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/stake/deposit
  router.post('/deposit', (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const { amount } = req.body;
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({ success: false, error: 'Valid amount required' });
        return;
      }
      const result = service.deposit(req.user.id, amount);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/stake/withdraw
  router.post('/withdraw', (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const { amount } = req.body;
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({ success: false, error: 'Valid amount required' });
        return;
      }
      const result = service.withdraw(req.user.id, amount);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // POST /api/stake/claim
  router.post('/claim', (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const result = service.claimRewards(req.user.id);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // GET /api/stake/history
  router.get('/history', (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
      const limit = parseInt(req.query.limit as string) || 50;
      const history = service.getHistory(req.user.id, limit);
      res.json({ success: true, data: history });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
