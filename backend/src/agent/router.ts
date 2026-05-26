/**
 * Paper copy-trading agent.
 *
 * Subscribes to each followed leader's userFills via Hyperliquid WS.
 * On every NEW open/close fill, computes a proportional mirror order and
 * records it as a paper trade + position. No real orders are placed.
 *
 * Also subscribes to webData2 per leader to keep their account value fresh
 * (used as the denominator for proportional sizing), and polls allMids on
 * an interval to mark our open positions to market.
 */

import { config } from '../config';
import {
  HLWebSocketClient,
  fetchAllMids,
  fetchClearinghouseState,
  fetchUserFillsByTime,
} from './hl-client';
import { HLFill, HLClearinghouseState } from './types';
import { classifyFill, computeOpen, computeClose, realizedPnl, SizingConfig } from './sizing';
import * as repo from './repo';

const STARTING_EQUITY = config.agent.startingEquity;

// In-memory caches keyed by lowercased leader wallet.
const leaderAccountValue = new Map<string, number>();
const leaderPositions = new Map<string, Map<string, number>>(); // wallet -> coin -> szi
let allMids: Record<string, number> = {};

let ws: HLWebSocketClient | null = null;
let markInterval: NodeJS.Timeout | null = null;
let snapshotInterval: NodeJS.Timeout | null = null;

// ─── Public API ────────────────────────────────────────
export async function startAgent() {
  if (ws) return;
  if (config.agent.followed.length === 0) {
    console.log('[agent] no followed wallets configured, skipping startup');
    return;
  }

  console.log(`[agent] starting — following ${config.agent.followed.length} wallets, starting equity $${STARTING_EQUITY.toLocaleString()}, paused=${config.agent.paused}`);

  // 1. Seed mids + leader states once
  try { allMids = parseMids(await fetchAllMids()); } catch (e: any) { console.warn('[agent] allMids seed failed:', e.message); }
  for (const wallet of config.agent.followed) {
    await seedLeader(wallet);
  }

  // 2. Wire WS
  ws = new HLWebSocketClient();
  ws.on('open', () => console.log('[agent] HL WS connected'));
  ws.on('close', () => console.log('[agent] HL WS disconnected'));
  ws.on('error', (e) => console.warn('[agent] HL WS error:', (e as any).message));

  ws.on('allMids', (data: Record<string, string>) => { allMids = parseMids(data); });
  ws.subscribe({ type: 'allMids' });

  for (const wallet of config.agent.followed) {
    ws.on(`webData2:${wallet}`, (data: any) => {
      if (data?.clearinghouseState) absorbState(wallet, data.clearinghouseState);
    });
    ws.on(`userFills:${wallet}`, (data: any) => {
      const fills = (data?.fills ?? []) as HLFill[];
      // On the initial snapshot we must NOT mirror historical fills — just bump the cursor.
      if (data?.isSnapshot) {
        const maxTid = fills.reduce((m, f) => Math.max(m, f.tid), 0);
        if (maxTid > 0) repo.setCursor(wallet, maxTid, Date.now());
        return;
      }
      for (const f of fills) handleNewFill(wallet, f);
    });
    ws.subscribe({ type: 'webData2', user: wallet });
    ws.subscribe({ type: 'userFills', user: wallet });
  }
  ws.connect();

  // 3. Mark-to-market open positions every 15s and snapshot equity every 60s
  markInterval = setInterval(async () => {
    try { allMids = parseMids(await fetchAllMids()); } catch {}
  }, 15_000);
  snapshotInterval = setInterval(() => {
    try {
      const { realized, unrealized } = computeLiveStats();
      repo.snapshotEquity(realized, unrealized, STARTING_EQUITY);
    } catch (e: any) { console.warn('[agent] equity snapshot failed:', e.message); }
  }, 60_000);
}

export function stopAgent() {
  if (markInterval) { clearInterval(markInterval); markInterval = null; }
  if (snapshotInterval) { clearInterval(snapshotInterval); snapshotInterval = null; }
  if (ws) { ws.destroy(); ws = null; }
}

/** Snapshot of current agent state (for /api/agent endpoints). */
export function getLiveState() {
  const { realizedPnl: _r, openPositions: _op, ...stats } = repo.getAggregateStats();
  const { realized, unrealized, positions } = computeLiveStats();
  const equity = STARTING_EQUITY + realized + unrealized;
  return {
    startingEquity: STARTING_EQUITY,
    equity,
    realizedPnl: realized,
    unrealizedPnl: unrealized,
    pnlPct: (equity / STARTING_EQUITY - 1) * 100,
    openPositions: positions,
    openPositionsCount: positions.length,
    paused: config.agent.paused,
    followedCount: config.agent.followed.length,
    ...stats,
  };
}

// ─── Internal ──────────────────────────────────────────
function parseMids(data: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('@')) out[k] = parseFloat(v); // skip spot @-indexed
  }
  return out;
}

function absorbState(wallet: string, state: HLClearinghouseState) {
  const av = parseFloat(state.marginSummary?.accountValue || '0');
  if (isFinite(av) && av > 0) leaderAccountValue.set(wallet, av);
  const m = new Map<string, number>();
  for (const ap of state.assetPositions ?? []) {
    const szi = parseFloat(ap.position?.szi || '0');
    if (isFinite(szi) && szi !== 0) m.set(ap.position.coin, szi);
  }
  leaderPositions.set(wallet, m);
}

async function seedLeader(wallet: string) {
  try {
    const state = await fetchClearinghouseState(wallet);
    absorbState(wallet, state);
  } catch (e: any) {
    console.warn(`[agent] seed clearinghouse failed for ${wallet}:`, e.message);
  }
  // Establish a fill cursor at "now" so the WS snapshot doesn't backfill ancient trades.
  // (If we wanted to backfill 24h we'd fetch + replay here instead.)
  const cur = repo.getCursor(wallet);
  if (!cur) repo.setCursor(wallet, 0, Date.now());
}

function vaultEquityNow(): number {
  const { realized, unrealized } = computeLiveStats();
  return STARTING_EQUITY + realized + unrealized;
}

function sizingCfg(): SizingConfig {
  return {
    sizingMultiplier: config.agent.sizingMultiplier,
    maxOrderPct: config.agent.maxOrderPct,
    minOrderUsd: config.agent.minOrderUsd,
  };
}

// Hyperliquid prefixes spot / prediction-market / vault tokens (e.g. "xyz:SPCX",
// "@1234"). Plain perp symbols are uppercase alnum, sometimes with a leading digit
// (1000PEPE, 1MBONK). Exclude anything with non-alnum characters.
function isSupportedCoin(coin: string): boolean {
  return /^[A-Z0-9][A-Z0-9]{0,11}$/.test(coin);
}

function handleNewFill(wallet: string, fill: HLFill) {
  if (config.agent.paused) return;
  if (!fill?.tid) return;
  if (repo.tradeExistsForTid(wallet, fill.tid)) return;

  const cursor = repo.getCursor(wallet);
  if (cursor && fill.tid <= cursor.last_tid) return;

  if (!isSupportedCoin(fill.coin)) {
    repo.setCursor(wallet, fill.tid, fill.time);
    return;
  }

  const cls = classifyFill(fill);
  if (!cls) {
    repo.setCursor(wallet, fill.tid, fill.time);
    return;
  }

  const leaderAv = leaderAccountValue.get(wallet) || 0;
  if (leaderAv <= 0) {
    // No state yet — bump cursor so we don't keep hammering this fill.
    repo.setCursor(wallet, fill.tid, fill.time);
    return;
  }

  if (cls.isOpen) {
    const dec = computeOpen(fill, leaderAv, vaultEquityNow(), sizingCfg());
    if (!dec) {
      repo.setCursor(wallet, fill.tid, fill.time);
      return;
    }
    const positionId = repo.openPosition({
      wallet, coin: dec.coin, side: cls.side,
      sz: dec.mirrorSz, entryPx: dec.mirrorPx,
      notional: dec.mirrorNotional, openedAt: fill.time,
    });
    repo.recordTrade({
      ts: fill.time,
      source_wallet: wallet,
      source_tid: fill.tid,
      coin: fill.coin,
      action: dec.action,
      source_px: parseFloat(fill.px),
      source_sz: parseFloat(fill.sz),
      source_notional: parseFloat(fill.px) * parseFloat(fill.sz),
      leader_acct_value: leaderAv,
      leader_pct: dec.leaderPct,
      vault_acct_value: vaultEquityNow(),
      mirror_sz: dec.mirrorSz,
      mirror_notional: dec.mirrorNotional,
      mirror_px: dec.mirrorPx,
      realized_pnl: null,
      position_id: positionId,
      notes: null,
    });
    console.log(`[agent] OPEN ${cls.side.toUpperCase()} ${fill.coin} $${dec.mirrorNotional.toFixed(0)} (mirror of ${shortAddr(wallet)} @ ${(dec.leaderPct*100).toFixed(2)}%)`);
  } else {
    // Close: find matching open paper position
    const pos = repo.findOpenPosition(wallet, fill.coin, cls.side);
    if (!pos) {
      // We never opened this — skip (could happen if router started after leader opened)
      repo.setCursor(wallet, fill.tid, fill.time);
      return;
    }
    const leaderSzBefore = Math.abs(parseFloat(fill.startPosition || '0'));
    const dec = computeClose(fill, leaderSzBefore);
    if (!dec) {
      repo.setCursor(wallet, fill.tid, fill.time);
      return;
    }
    const closedSz = pos.sz * dec.closeFraction;
    const closePx = parseFloat(fill.px);
    const pnl = realizedPnl(cls.side, pos.entry_px, closePx, closedSz);
    repo.reducePosition(pos.id, closedSz, closePx, pnl, fill.time);
    repo.recordTrade({
      ts: fill.time,
      source_wallet: wallet,
      source_tid: fill.tid,
      coin: fill.coin,
      action: dec.action,
      source_px: parseFloat(fill.px),
      source_sz: parseFloat(fill.sz),
      source_notional: parseFloat(fill.px) * parseFloat(fill.sz),
      leader_acct_value: leaderAv,
      leader_pct: 0,
      vault_acct_value: vaultEquityNow(),
      mirror_sz: closedSz,
      mirror_notional: closedSz * closePx,
      mirror_px: closePx,
      realized_pnl: pnl,
      position_id: pos.id,
      notes: dec.closeFraction < 0.99 ? `reduce ${(dec.closeFraction*100).toFixed(0)}%` : null,
    });
    console.log(`[agent] ${dec.action.toUpperCase()} ${fill.coin} ${pnl>=0?'+':''}$${pnl.toFixed(2)}`);
  }

  repo.setCursor(wallet, fill.tid, fill.time);
}

function computeLiveStats(): { realized: number; unrealized: number; positions: Array<{ id: number; coin: string; side: 'long'|'short'; sz: number; entryPx: number; markPx: number; notional: number; unrealizedPnl: number; sourceWallet: string }> } {
  const stats = repo.getAggregateStats();
  const open = repo.listOpenPositions();
  const positions = open.map((p) => {
    const mark = allMids[p.coin] ?? p.entry_px;
    const unreal = realizedPnl(p.side, p.entry_px, mark, p.sz);
    return {
      id: p.id, coin: p.coin, side: p.side,
      sz: p.sz, entryPx: p.entry_px, markPx: mark,
      notional: p.sz * mark, unrealizedPnl: unreal,
      sourceWallet: p.source_wallet,
    };
  });
  const unrealized = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  return { realized: stats.realizedPnl, unrealized, positions };
}

function shortAddr(a: string) { return a.slice(0, 6) + '…' + a.slice(-4); }
