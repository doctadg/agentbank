import crypto from 'crypto';
import { getDb } from '../db';
import { AgentEvent, AgentEventType } from '../types';

const VALID_TYPES: AgentEventType[] = [
  'trade_open', 'trade_close', 'signal', 'reasoning', 'distribution', 'snapshot', 'system',
];

export interface ActivityQuery {
  limit?: number;
  since?: string;
  types?: AgentEventType[];
}

export function listEvents(q: ActivityQuery = {}): AgentEvent[] {
  const db = getDb();
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
  const types = (q.types ?? []).filter((t) => VALID_TYPES.includes(t));

  const conditions: string[] = [];
  const params: any[] = [];

  if (q.since) {
    conditions.push('created_at > ?');
    params.push(q.since);
  }
  if (types.length) {
    conditions.push(`type IN (${types.map(() => '?').join(',')})`);
    params.push(...types);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM agent_events ${where} ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(...params) as AgentEvent[];
}

export function getStats() {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM agent_events').get() as any).c as number;
  const last24h = (db.prepare(
    "SELECT COUNT(*) as c FROM agent_events WHERE created_at > datetime('now', '-1 day')",
  ).get() as any).c as number;
  const latest = db
    .prepare('SELECT created_at FROM agent_events ORDER BY created_at DESC LIMIT 1')
    .get() as { created_at: string } | undefined;
  const byType = db
    .prepare(
      "SELECT type, COUNT(*) as c FROM agent_events WHERE created_at > datetime('now', '-1 day') GROUP BY type",
    )
    .all() as { type: AgentEventType; c: number }[];
  return {
    total,
    last24h,
    latestAt: latest?.created_at ?? null,
    byType: Object.fromEntries(byType.map((r) => [r.type, r.c])),
  };
}

export function recordEvent(input: {
  type: AgentEventType;
  message: string;
  symbol?: string | null;
  side?: 'long' | 'short' | null;
  price?: number | null;
  size?: number | null;
  pnl?: number | null;
  detail?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}): AgentEvent {
  const db = getDb();
  const id = crypto.randomUUID();
  const created_at = input.createdAt ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO agent_events (id, type, symbol, side, price, size, pnl, message, detail, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.type,
    input.symbol ?? null,
    input.side ?? null,
    input.price ?? null,
    input.size ?? null,
    input.pnl ?? null,
    input.message,
    input.detail ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    created_at,
  );
  return db.prepare('SELECT * FROM agent_events WHERE id = ?').get(id) as AgentEvent;
}

export function parseTypes(raw?: string): AgentEventType[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim() as AgentEventType)
    .filter((t) => VALID_TYPES.includes(t));
}
