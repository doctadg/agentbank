/** Hyperliquid fill, as returned by userFills / userFillsByTime. */
export interface HLFill {
  coin: string;
  px: string;
  sz: string;
  side: 'A' | 'B';
  time: number;
  dir: string;             // "Open Long", "Close Long", "Open Short", "Close Short", "Buy", "Sell"
  closedPnl: string;
  fee: string;
  hash: string;
  startPosition: string;
  oid: number;
  tid: number;
  crossed: boolean;
  twapId: number | null;
  feeToken: string;
}

export interface HLMarginSummary {
  accountValue: string;
  totalNtlPos: string;
  totalRawUsd: string;
  totalMarginUsed: string;
}

export interface HLClearinghouseState {
  marginSummary: HLMarginSummary;
  crossMarginSummary: HLMarginSummary;
  assetPositions: Array<{ type: string; position: { coin: string; szi: string; entryPx: string; positionValue: string; unrealizedPnl: string; leverage: { type: string; value: number } } }>;
  time: number;
}

export type AgentAction =
  | 'open_long'
  | 'open_short'
  | 'close_long'
  | 'close_short'
  | 'reduce_long'
  | 'reduce_short';

export interface PaperPosition {
  id: number;
  source_wallet: string;
  coin: string;
  side: 'long' | 'short';
  sz: number;
  entry_px: number;
  notional: number;
  opened_at: number;
  is_open: 0 | 1;
  closed_at: number | null;
  close_px: number | null;
  realized_pnl: number;
}

export interface PaperTrade {
  id: number;
  ts: number;
  source_wallet: string;
  source_tid: number;
  coin: string;
  action: AgentAction;
  source_px: number;
  source_sz: number;
  source_notional: number;
  leader_acct_value: number;
  leader_pct: number;
  vault_acct_value: number;
  mirror_sz: number;
  mirror_notional: number;
  mirror_px: number;
  realized_pnl: number | null;
  position_id: number | null;
  notes: string | null;
}
