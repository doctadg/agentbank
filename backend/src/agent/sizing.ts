import { HLFill, AgentAction } from './types';

export interface SizingConfig {
  /** Multiplier on leader's % allocation (1 = exact mirror, 0.5 = half-size). */
  sizingMultiplier: number;
  /** Cap any single mirror order at this fraction of vault notional. */
  maxOrderPct: number;
  /** Skip orders smaller than this dollar notional. */
  minOrderUsd: number;
}

export interface MirrorOpenDecision {
  kind: 'open';
  action: 'open_long' | 'open_short';
  coin: string;
  mirrorSz: number;          // base asset
  mirrorNotional: number;    // USD
  mirrorPx: number;          // = leader px (paper assumes no slippage)
  leaderPct: number;         // notional / leader_acct_value
}

export interface MirrorCloseDecision {
  kind: 'close';
  action: 'close_long' | 'close_short' | 'reduce_long' | 'reduce_short';
  coin: string;
  /**
   * Fraction of our existing position to close. 1 = full close.
   * For "Close" fills with zero startPosition leftover after the fill, we close 100%.
   * For partial reductions, we close the same fraction the leader did.
   */
  closeFraction: number;
}

export type MirrorDecision = MirrorOpenDecision | MirrorCloseDecision | null;

/**
 * Classify a leader fill into the action we'd take.
 * Returns null for fills we don't act on (e.g. spot trades or non-position-changing fills).
 */
export function classifyFill(fill: HLFill): { side: 'long' | 'short'; isOpen: boolean } | null {
  // dir is "Open Long" | "Open Short" | "Close Long" | "Close Short" | "Buy" | "Sell" (spot)
  if (fill.dir.includes('Long')) {
    return { side: 'long', isOpen: fill.dir.startsWith('Open') };
  }
  if (fill.dir.includes('Short')) {
    return { side: 'short', isOpen: fill.dir.startsWith('Open') };
  }
  return null; // ignore spot Buy/Sell — different surface
}

/**
 * Compute mirror order params for an Open fill.
 * Returns null if the resulting size would be below the minimum notional.
 */
export function computeOpen(
  fill: HLFill,
  leaderAcctValue: number,
  vaultAcctValue: number,
  cfg: SizingConfig,
): MirrorOpenDecision | null {
  const sz = parseFloat(fill.sz);
  const px = parseFloat(fill.px);
  if (!isFinite(sz) || !isFinite(px) || sz <= 0 || px <= 0) return null;
  if (leaderAcctValue <= 0 || vaultAcctValue <= 0) return null;

  const cls = classifyFill(fill);
  if (!cls || !cls.isOpen) return null;

  const sourceNotional = sz * px;
  const leaderPct = sourceNotional / leaderAcctValue;
  // Our mirror notional: leader_pct × vault × multiplier, capped at maxOrderPct of vault
  const targetNotional = leaderPct * cfg.sizingMultiplier * vaultAcctValue;
  const cap = cfg.maxOrderPct * vaultAcctValue;
  const mirrorNotional = Math.min(targetNotional, cap);

  if (mirrorNotional < cfg.minOrderUsd) return null;

  const mirrorSz = mirrorNotional / px;

  return {
    kind: 'open',
    action: cls.side === 'long' ? 'open_long' : 'open_short',
    coin: fill.coin,
    mirrorSz,
    mirrorNotional,
    mirrorPx: px,
    leaderPct,
  };
}

/**
 * Compute close decision for a Close fill.
 * `leaderPositionSizeBeforeFill` is abs(startPosition) — how big leader's position was right before this close.
 * If leader fully closed (sz == leaderPositionSizeBeforeFill), we close 100% of our position.
 * If partial, we close the same fraction.
 */
export function computeClose(
  fill: HLFill,
  leaderPositionSizeBeforeFill: number,
): MirrorCloseDecision | null {
  const cls = classifyFill(fill);
  if (!cls || cls.isOpen) return null;
  const sz = parseFloat(fill.sz);
  if (!isFinite(sz) || sz <= 0) return null;

  let closeFraction = 1;
  if (leaderPositionSizeBeforeFill > 0) {
    closeFraction = Math.min(1, sz / leaderPositionSizeBeforeFill);
  }
  const fullClose = closeFraction >= 0.99;
  const action: AgentAction = fullClose
    ? (cls.side === 'long' ? 'close_long' : 'close_short')
    : (cls.side === 'long' ? 'reduce_long' : 'reduce_short');

  return {
    kind: 'close',
    action: action as MirrorCloseDecision['action'],
    coin: fill.coin,
    closeFraction,
  };
}

/** Realized PnL for closing `closedSz` of a position bought at entryPx, at currentPx. */
export function realizedPnl(side: 'long' | 'short', entryPx: number, currentPx: number, closedSz: number): number {
  if (side === 'long') return (currentPx - entryPx) * closedSz;
  return (entryPx - currentPx) * closedSz;
}
