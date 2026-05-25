import { Router, Request, Response } from 'express';
import * as svc from './service';

export function createAgentRouter() {
  const router = Router();

  router.get('/activity', (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const since = typeof req.query.since === 'string' ? req.query.since : undefined;
      const types = svc.parseTypes(typeof req.query.types === 'string' ? req.query.types : undefined);
      const events = svc.listEvents({ limit, since, types });
      res.json({ success: true, data: { events } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  router.get('/activity/stats', (_req: Request, res: Response) => {
    try {
      res.json({ success: true, data: svc.getStats() });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  return router;
}
