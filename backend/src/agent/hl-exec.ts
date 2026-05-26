/**
 * Live order execution against Hyperliquid via the API wallet sub-key.
 *
 * Uses @nktkas/hyperliquid for EIP-712 signing + REST submission.
 * All orders are routed to the master account that approved the API wallet.
 *
 * Safety: this module is a no-op unless config.agent.mode === 'live' AND
 * both HL_API_PRIVATE_KEY + HL_MASTER_ADDRESS are set. The router calls
 * `isLiveEnabled()` before dispatching.
 */

import * as hl from '@nktkas/hyperliquid';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config';

let _info: hl.InfoClient | null = null;
let _exchange: hl.ExchangeClient | null = null;
let _assetIndexByCoin: Map<string, { idx: number; szDecimals: number; maxLeverage: number }> | null = null;

function transport() {
  return new hl.HttpTransport(config.agent.testnet ? { isTestnet: true } : {});
}

export function isLiveEnabled(): boolean {
  return config.agent.mode === 'live'
    && !!config.agent.hlApiKey
    && config.agent.hlApiKey.startsWith('0x')
    && config.agent.hlApiKey.length === 66
    && !!config.agent.hlMaster
    && config.agent.hlMaster.startsWith('0x');
}

export function getInfoClient(): hl.InfoClient {
  if (!_info) _info = new hl.InfoClient({ transport: transport() });
  return _info;
}

export function getExchangeClient(): hl.ExchangeClient {
  if (_exchange) return _exchange;
  if (!isLiveEnabled()) throw new Error('Live mode disabled or HL credentials missing');
  const wallet = privateKeyToAccount(config.agent.hlApiKey as `0x${string}`);
  _exchange = new hl.ExchangeClient({
    wallet,
    transport: transport(),
    defaultVaultAddress: config.agent.hlMaster as `0x${string}`,
  });
  return _exchange;
}

/** Load + cache the perp universe so we can map coin → asset index. */
export async function getAssetIndex(coin: string): Promise<{ idx: number; szDecimals: number; maxLeverage: number }> {
  if (!_assetIndexByCoin) {
    const meta = await getInfoClient().meta();
    _assetIndexByCoin = new Map();
    meta.universe.forEach((u: any, i: number) => {
      _assetIndexByCoin!.set(u.name, {
        idx: i,
        szDecimals: u.szDecimals,
        maxLeverage: u.maxLeverage ?? 1,
      });
    });
  }
  const a = _assetIndexByCoin.get(coin);
  if (!a) throw new Error(`unknown perp coin: ${coin}`);
  return a;
}

/** Round size to the asset's szDecimals (HL requires exact step). */
function roundSize(sz: number, szDecimals: number): number {
  const k = Math.pow(10, szDecimals);
  return Math.floor(sz * k) / k;
}

/** Round price to HL's tick / sig figs rules (5 sig figs, max 6 decimals after the digits before the dot). */
function roundPx(px: number, szDecimals: number): string {
  // For perps: max 5 significant figures, max (6 - szDecimals) decimal places.
  const maxDec = Math.max(0, 6 - szDecimals);
  // Limit to 5 sig figs
  const sig = 5;
  const order = Math.floor(Math.log10(Math.abs(px)));
  const sigDec = Math.max(0, sig - 1 - order);
  const dec = Math.min(maxDec, sigDec);
  return px.toFixed(dec);
}

/** Set cross leverage on this asset for the master (idempotent — no-ops if already set). */
async function ensureLeverage(assetIdx: number, leverage: number): Promise<void> {
  try {
    await getExchangeClient().updateLeverage({
      asset: assetIdx,
      isCross: true,
      leverage: Math.max(1, Math.floor(leverage)),
    });
  } catch (e: any) {
    // HL returns an error if leverage is already at target — that's fine.
    const m = String(e?.message || '').toLowerCase();
    if (!m.includes('already') && !m.includes('no change')) throw e;
  }
}

export interface PlacedOrder {
  cloid?: string;
  oid?: number;
  status: 'filled' | 'resting' | 'error';
  filledSz?: number;
  filledPx?: number;
  error?: string;
  raw?: any;
}

/**
 * Place an IOC (immediate-or-cancel) "crossed" limit order — used for opens.
 * Slippage protection: limit price = mid * (1 ± slippageBps/10000).
 */
export async function placeMarketOpen(input: {
  coin: string;
  isBuy: boolean;          // true = open long, false = open short
  notionalUsd: number;     // sized in USD
  leverage: number;
  slippageBps?: number;    // default 50 bps = 0.5%
}): Promise<PlacedOrder> {
  if (!isLiveEnabled()) return { status: 'error', error: 'live disabled' };

  const { idx, szDecimals, maxLeverage } = await getAssetIndex(input.coin);
  const lev = Math.min(input.leverage, maxLeverage, config.agent.maxLeverage);

  // Fetch mid from allMids
  const mids = await getInfoClient().allMids();
  const mid = parseFloat((mids as any)[input.coin]);
  if (!isFinite(mid) || mid <= 0) return { status: 'error', error: `no mid for ${input.coin}` };

  const slip = (input.slippageBps ?? 50) / 10_000;
  const limitPx = input.isBuy ? mid * (1 + slip) : mid * (1 - slip);
  const pxStr = roundPx(limitPx, szDecimals);
  const sz = roundSize(input.notionalUsd / mid, szDecimals);
  if (sz <= 0) return { status: 'error', error: 'rounded size is 0' };

  // Set leverage first (HL applies it to this asset for the master).
  await ensureLeverage(idx, lev);

  const cloid = randomCloid();
  let resp: any;
  try {
    resp = await getExchangeClient().order({
      orders: [{
        a: idx, b: input.isBuy, p: pxStr, s: String(sz),
        r: false, t: { limit: { tif: 'Ioc' } }, c: cloid,
      }],
      grouping: 'na',
    });
  } catch (e: any) {
    return { status: 'error', error: e?.message ?? String(e), raw: e };
  }

  return parseOrderResponse(resp, cloid);
}

/**
 * Close a fraction of an existing position. Pulls current position size from
 * clearinghouseState and submits a reduceOnly IOC.
 */
export async function placeMarketClose(input: {
  coin: string;
  fraction: number;        // 0..1 of our current position
  slippageBps?: number;
}): Promise<PlacedOrder> {
  if (!isLiveEnabled()) return { status: 'error', error: 'live disabled' };

  const state = await getInfoClient().clearinghouseState({ user: config.agent.hlMaster as `0x${string}` });
  const pos = state.assetPositions.find((p: any) => p.position?.coin === input.coin);
  if (!pos) return { status: 'error', error: `no open position in ${input.coin}` };
  const szi = parseFloat(pos.position.szi);
  if (!isFinite(szi) || szi === 0) return { status: 'error', error: 'zero szi' };

  const { idx, szDecimals } = await getAssetIndex(input.coin);
  const closeAbs = roundSize(Math.abs(szi) * input.fraction, szDecimals);
  if (closeAbs <= 0) return { status: 'error', error: 'close size rounds to 0' };

  const mids = await getInfoClient().allMids();
  const mid = parseFloat((mids as any)[input.coin]);
  if (!isFinite(mid) || mid <= 0) return { status: 'error', error: `no mid for ${input.coin}` };

  // To close a long we sell (isBuy = false); to close a short we buy.
  const isBuy = szi < 0;
  const slip = (input.slippageBps ?? 50) / 10_000;
  const limitPx = isBuy ? mid * (1 + slip) : mid * (1 - slip);
  const pxStr = roundPx(limitPx, szDecimals);

  const cloid = randomCloid();
  let resp: any;
  try {
    resp = await getExchangeClient().order({
      orders: [{
        a: idx, b: isBuy, p: pxStr, s: String(closeAbs),
        r: true, t: { limit: { tif: 'Ioc' } }, c: cloid,
      }],
      grouping: 'na',
    });
  } catch (e: any) {
    return { status: 'error', error: e?.message ?? String(e), raw: e };
  }
  return parseOrderResponse(resp, cloid);
}

/** Emergency: cancel every resting order on the master. */
export async function cancelAll(): Promise<{ cancelled: number; error?: string }> {
  if (!isLiveEnabled()) return { cancelled: 0, error: 'live disabled' };
  try {
    const state = await getInfoClient().openOrders({ user: config.agent.hlMaster as `0x${string}` });
    if (!state || state.length === 0) return { cancelled: 0 };
    const cancels = state.map((o: any) => ({ a: o.coin, o: o.oid }));
    // HL cancel expects { a: assetIdx, o: oid }; openOrders returns coin name, so map first.
    const meta = await getInfoClient().meta();
    const idxByCoin = new Map<string, number>();
    meta.universe.forEach((u: any, i: number) => idxByCoin.set(u.name, i));
    const cancelPayload = cancels
      .map((c) => ({ a: idxByCoin.get(c.a as string)!, o: c.o }))
      .filter((c) => Number.isInteger(c.a));
    if (cancelPayload.length === 0) return { cancelled: 0 };
    await getExchangeClient().cancel({ cancels: cancelPayload });
    return { cancelled: cancelPayload.length };
  } catch (e: any) {
    return { cancelled: 0, error: e?.message ?? String(e) };
  }
}

/** Read the master's perp account value (used as live vault denominator). */
export async function getVaultAccountValue(): Promise<number> {
  if (!config.agent.hlMaster) return 0;
  const s = await getInfoClient().clearinghouseState({ user: config.agent.hlMaster as `0x${string}` });
  return parseFloat(s.marginSummary.accountValue || '0');
}

// ─── Helpers ───────────────────────────────────────────
function randomCloid(): `0x${string}` {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && (crypto as any).getRandomValues) {
    (crypto as any).getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return ('0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

function parseOrderResponse(resp: any, cloid: string): PlacedOrder {
  // HL response shape: { status: 'ok', response: { type: 'order', data: { statuses: [{ filled: {...} } | { resting: {...} } | { error: '...' }] } } }
  try {
    const status = resp?.response?.data?.statuses?.[0];
    if (!status) return { status: 'error', error: 'no status in response', cloid, raw: resp };
    if (status.error) return { status: 'error', error: status.error, cloid, raw: resp };
    if (status.filled) {
      return {
        status: 'filled',
        cloid,
        oid: status.filled.oid,
        filledSz: parseFloat(status.filled.totalSz),
        filledPx: parseFloat(status.filled.avgPx),
        raw: resp,
      };
    }
    if (status.resting) {
      return { status: 'resting', cloid, oid: status.resting.oid, raw: resp };
    }
    return { status: 'error', error: 'unknown status', cloid, raw: resp };
  } catch (e: any) {
    return { status: 'error', error: e?.message ?? String(e), cloid, raw: resp };
  }
}
