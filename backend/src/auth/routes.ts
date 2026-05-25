import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { User } from '../types';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { authMiddleware, JwtPayload } from './middleware';
import crypto from 'crypto';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

const router = Router();

// POST /api/auth/nonce
router.post('/nonce', (req: Request, res: Response) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey || typeof publicKey !== 'string') {
      res.status(400).json({ error: 'publicKey is required' });
      return;
    }

    // Validate it looks like a base58 public key
    try {
      const decoded = bs58.decode(publicKey);
      if (decoded.length !== 32) {
        throw new Error('Invalid key length');
      }
    } catch {
      res.status(400).json({ error: 'Invalid Solana public key format' });
      return;
    }

    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min
    const message = `AgentBank Staking Authentication\n\nNonce: ${nonce}\nExpires: ${expiresAt}`;

    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO nonces (public_key, nonce, expires_at)
      VALUES (?, ?, ?)
    `).run(publicKey, nonce, expiresAt);

    res.json({ nonce, message, expiresAt });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate nonce', details: err.message });
  }
});

// POST /api/auth/verify
router.post('/verify', (req: Request, res: Response) => {
  try {
    const { publicKey, signature, nonce } = req.body;

    if (!publicKey || !signature || !nonce) {
      res.status(400).json({ error: 'publicKey, signature, and nonce are required' });
      return;
    }

    const db = getDb();

    // Look up the nonce
    const nonceRow = db.prepare('SELECT * FROM nonces WHERE public_key = ? AND nonce = ?')
      .get(publicKey, nonce) as { public_key: string; nonce: string; expires_at: string } | undefined;

    if (!nonceRow) {
      res.status(401).json({ error: 'Invalid nonce' });
      return;
    }

    // Check expiry
    if (new Date(nonceRow.expires_at) < new Date()) {
      db.prepare('DELETE FROM nonces WHERE public_key = ? AND nonce = ?').run(publicKey, nonce);
      res.status(401).json({ error: 'Nonce expired' });
      return;
    }

    // Construct the message that was signed
    const message = `AgentBank Staking Authentication\n\nNonce: ${nonce}\nExpires: ${nonceRow.expires_at}`;
    const messageBytes = new TextEncoder().encode(message);

    // Decode the signature and public key from base58
    let signatureBytes: Uint8Array;
    let publicKeyBytes: Uint8Array;
    try {
      signatureBytes = bs58.decode(signature);
      publicKeyBytes = bs58.decode(publicKey);
    } catch {
      res.status(401).json({ error: 'Invalid signature or public key encoding' });
      return;
    }

    // Verify using nacl.sign.detached.verify (tweetnacl-ts API)
    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!verified) {
      res.status(401).json({ error: 'Signature verification failed' });
      return;
    }

    // Delete used nonce
    db.prepare('DELETE FROM nonces WHERE public_key = ? AND nonce = ?').run(publicKey, nonce);

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE public_key = ?').get(publicKey) as User | undefined;
    if (!user) {
      const userId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO users (id, public_key, balance, staked_amount, pending_rewards, total_earned)
        VALUES (?, ?, 0, 0, 0, 0)
      `).run(userId, publicKey);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
    }

    // Issue JWT
    const payload: JwtPayload = { userId: user.id, publicKey: user.public_key };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user.id,
        publicKey: user.public_key,
        balance: user.balance,
        stakedAmount: user.staked_amount,
        pendingRewards: user.pending_rewards,
        totalEarned: user.total_earned,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Authentication failed', details: err.message });
  }
});

export default router;
