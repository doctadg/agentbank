import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { User } from '../types';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import crypto from 'crypto';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';

const router = Router();

router.post('/nonce', (req: Request, res: Response) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey || typeof publicKey !== 'string') { res.status(400).json({ error: 'publicKey required' }); return; }
    try { const d = bs58.decode(publicKey); if (d.length !== 32) throw new Error(); } catch { res.status(400).json({ error: 'Invalid public key' }); return; }
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const message = `AgentBank Authentication\n\nNonce: ${nonce}\nExpires: ${expiresAt}`;
    getDb().prepare('INSERT OR REPLACE INTO nonces (public_key, nonce, expires_at) VALUES (?, ?, ?)').run(publicKey, nonce, expiresAt);
    res.json({ nonce, message, expiresAt });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/verify', (req: Request, res: Response) => {
  try {
    const { publicKey, signature, nonce } = req.body;
    if (!publicKey || !signature || !nonce) { res.status(400).json({ error: 'publicKey, signature, nonce required' }); return; }
    const db = getDb();
    const nr = db.prepare('SELECT * FROM nonces WHERE public_key = ? AND nonce = ?').get(publicKey, nonce) as any;
    if (!nr) { res.status(401).json({ error: 'Invalid nonce' }); return; }
    if (new Date(nr.expires_at) < new Date()) { db.prepare('DELETE FROM nonces WHERE public_key = ? AND nonce = ?').run(publicKey, nonce); res.status(401).json({ error: 'Nonce expired' }); return; }
    const msg = `AgentBank Authentication\n\nNonce: ${nonce}\nExpires: ${nr.expires_at}`;
    const msgBytes = new TextEncoder().encode(msg);
    let sigB: Uint8Array, pubB: Uint8Array;
    try { sigB = bs58.decode(signature); pubB = bs58.decode(publicKey); } catch { res.status(401).json({ error: 'Invalid encoding' }); return; }
    if (!nacl.sign.detached.verify(msgBytes, sigB, pubB)) { res.status(401).json({ error: 'Signature failed' }); return; }
    db.prepare('DELETE FROM nonces WHERE public_key = ? AND nonce = ?').run(publicKey, nonce);
    let user = db.prepare('SELECT * FROM users WHERE public_key = ?').get(publicKey) as User | undefined;
    if (!user) { const id = crypto.randomUUID(); db.prepare('INSERT INTO users (id, public_key) VALUES (?, ?)').run(id, publicKey); user = { id, public_key: publicKey, created_at: new Date().toISOString() }; }
    const token = jwt.sign({ userId: user.id, publicKey: user.public_key }, config.jwtSecret, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, publicKey: user.public_key } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
