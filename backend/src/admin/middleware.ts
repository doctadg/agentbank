import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { config } from '../config';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-admin-key'] as string
    || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);

  if (!key) { res.status(401).json({ error: 'Admin key required' }); return; }

  // Check DB first, then fallback to config key
  const db = getDb();
  const dbKey = db.prepare('SELECT key FROM admin_keys WHERE key = ?').get(key);
  if (dbKey || key === config.adminApiKey) { next(); return; }

  res.status(401).json({ error: 'Invalid admin key' });
}
