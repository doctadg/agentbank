import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { User, AuthenticatedRequest } from '../types';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload { userId: string; publicKey: string; }

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) { res.status(401).json({ error: 'Missing authorization' }); return; }
  try {
    const payload = jwt.verify(authHeader.substring(7), config.jwtSecret) as JwtPayload;
    const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as User | undefined;
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }
    req.user = user;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}
