import { Router, Request, Response } from 'express';
import * as repo from './repo';
import { getLiveState } from './router';

export function createAgentRouter() {
  const r = Router();

  r.get('/state', (_req: Request, res: Response) => {
    try { res.json({ success: true, data: getLiveState() }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  r.get('/trades', (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);
      res.json({ success: true, data: repo.listRecentTrades(limit) });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  r.get('/positions', (_req: Request, res: Response) => {
    try { res.json({ success: true, data: getLiveState().openPositions }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  r.get('/equity', (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '500'), 10) || 500, 1), 5000);
      res.json({ success: true, data: repo.getEquityHistory(limit) });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  return r;
}
