import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { HLFill, HLClearinghouseState } from './types';

const HL_INFO = 'https://api.hyperliquid.xyz/info';
const HL_WS = 'wss://api.hyperliquid.xyz/ws';

// ─── REST helpers ──────────────────────────────────────
export async function hlPost<T>(body: object): Promise<T> {
  const res = await fetch(HL_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HL info ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchAllMids = () => hlPost<Record<string, string>>({ type: 'allMids' });

export const fetchClearinghouseState = (user: string) =>
  hlPost<HLClearinghouseState>({ type: 'clearinghouseState', user });

export const fetchUserFillsByTime = (user: string, startTime: number) =>
  hlPost<HLFill[] | null>({ type: 'userFillsByTime', user, startTime });

// ─── WebSocket client ──────────────────────────────────
/**
 * Emits:
 *   'open'                  → ws connected
 *   'close'                 → ws disconnected
 *   `userFills:<addr-lc>`   → { isSnapshot: boolean, user: string, fills: HLFill[] }
 *   `webData2:<addr-lc>`    → { clearinghouseState: HLClearinghouseState, user: string, ... }
 */
export class HLWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions = new Set<string>();     // JSON-stringified subs
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;

  constructor() { super(); this.setMaxListeners(100); }

  connect() {
    if (this.destroyed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const ws = new WebSocket(HL_WS);
    this.ws = ws;

    ws.on('open', () => {
      this.reconnectAttempt = 0;
      // resubscribe everything
      for (const sub of this.subscriptions) {
        ws.send(JSON.stringify({ method: 'subscribe', subscription: JSON.parse(sub) }));
      }
      if (this.pingInterval) clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ method: 'ping' })); } catch {}
        }
      }, 30_000);
      this.emit('open');
    });

    ws.on('message', (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.channel === 'pong' || msg.channel === 'subscriptionResponse') return;
      if (msg.channel === 'userFills' && msg.data?.user) {
        this.emit(`userFills:${msg.data.user.toLowerCase()}`, msg.data);
      } else if (msg.channel === 'webData2' && msg.data?.user) {
        this.emit(`webData2:${msg.data.user.toLowerCase()}`, msg.data);
      } else if (msg.channel === 'allMids') {
        this.emit('allMids', msg.data);
      }
    });

    const onClose = () => {
      if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
      this.ws = null;
      this.emit('close');
      if (this.destroyed || this.subscriptions.size === 0) return;
      this.reconnectAttempt++;
      const delay = Math.min(15_000, 500 * Math.pow(1.5, this.reconnectAttempt));
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };

    ws.on('close', onClose);
    ws.on('error', (err) => {
      // Will be followed by 'close'
      this.emit('error', err);
    });
  }

  subscribe(sub: object) {
    const key = JSON.stringify(sub);
    if (this.subscriptions.has(key)) return;
    this.subscriptions.add(key);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: 'subscribe', subscription: sub }));
    } else if (!this.ws) {
      this.connect();
    }
  }

  unsubscribe(sub: object) {
    const key = JSON.stringify(sub);
    if (!this.subscriptions.has(key)) return;
    this.subscriptions.delete(key);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: 'unsubscribe', subscription: sub }));
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
    this.subscriptions.clear();
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
  }
}
