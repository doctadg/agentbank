import { Router, Response, Request } from 'express';
import { adminAuth } from './middleware';
import * as svc from './service';
import {
  isLiveEnabled, placeMarketOpen, placeMarketClose, cancelAll, getVaultAccountValue,
} from '../agent/hl-exec';

export function createAdminRouter() {
  const router = Router();
  router.use(adminAuth);

  // ── HL live execution admin ─────────────────────────
  router.get('/agent/exec-status', async (_req: Request, res: Response) => {
    try {
      const live = isLiveEnabled();
      const equity = live ? await getVaultAccountValue() : 0;
      res.json({ success: true, data: { live, equity } });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  /**
   * Canary: place one tiny IOC long on a coin.
   * Body: { coin: string, notionalUsd?: number (default 11), leverage?: number (default 1) }
   */
  router.post('/agent/test-order', async (req: Request, res: Response) => {
    try {
      if (!isLiveEnabled()) { res.status(400).json({ success: false, error: 'live mode disabled or HL credentials missing' }); return; }
      const coin: string = req.body?.coin || 'HYPE';
      const notionalUsd: number = Math.max(0, Math.min(parseFloat(req.body?.notionalUsd ?? 11), 1000));
      const leverage: number = Math.max(1, Math.min(parseInt(req.body?.leverage ?? 1, 10), 20));
      const isBuy: boolean = req.body?.isBuy !== false;
      const r = await placeMarketOpen({ coin, isBuy, notionalUsd, leverage });
      res.json({ success: r.status === 'filled' || r.status === 'resting', data: r });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  /**
   * Close a fraction of an open position. Body: { coin, fraction?: number (default 1) }
   */
  router.post('/agent/close-position', async (req: Request, res: Response) => {
    try {
      if (!isLiveEnabled()) { res.status(400).json({ success: false, error: 'live disabled' }); return; }
      const coin: string = req.body?.coin;
      if (!coin) { res.status(400).json({ success: false, error: 'coin required' }); return; }
      const fraction: number = Math.max(0, Math.min(parseFloat(req.body?.fraction ?? 1), 1));
      const r = await placeMarketClose({ coin, fraction });
      res.json({ success: r.status === 'filled', data: r });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  router.post('/agent/cancel-all', async (_req: Request, res: Response) => {
    try { res.json({ success: true, data: await cancelAll() }); }
    catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

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
