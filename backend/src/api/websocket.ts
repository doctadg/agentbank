/**
 * WebSocket Server
 *
 * Real-time streaming server for price updates, fills, and orderbook data.
 * Uses the ws library with the EventBus to broadcast events to connected clients.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import eventBus from '../core/event-bus';
import logger from '../core/logger';

interface ClientInfo {
  ws: WebSocket;
  subscriptions: Set<string>;
  connectedAt: number;
}

const clients: Map<WebSocket, ClientInfo> = new Map();

let wss: WebSocketServer | null = null;

/**
 * Initialize the WebSocket server on the given HTTP server.
 */
export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const clientInfo: ClientInfo = {
      ws,
      subscriptions: new Set(),
      connectedAt: Date.now(),
    };
    clients.set(ws, clientInfo);

    logger.info(`[WS] Client connected. Total clients: ${clients.size}`);

    // Send welcome message
    sendMessage(ws, {
      type: 'connected',
      data: { message: 'AgentBank WebSocket connected', timestamp: Date.now() },
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(ws, msg);
      } catch (error) {
        logger.warn('[WS] Invalid message received:', error);
        sendMessage(ws, { type: 'error', data: { message: 'Invalid JSON' } });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info(`[WS] Client disconnected. Total clients: ${clients.size}`);
    });

    ws.on('error', (error: Error) => {
      logger.error('[WS] Client error:', error);
      clients.delete(ws);
    });
  });

  // Subscribe to EventBus events and broadcast to WS clients
  setupEventBroadcasters();

  logger.info('[WS] WebSocket server initialized on /ws');
}

/**
 * Handle incoming messages from WebSocket clients.
 */
function handleClientMessage(ws: WebSocket, msg: any): void {
  const { action, channel, data } = msg;

  switch (action) {
    case 'subscribe': {
      const client = clients.get(ws);
      if (client && channel) {
        client.subscriptions.add(channel);
        sendMessage(ws, {
          type: 'subscribed',
          data: { channel },
        });
        logger.debug(`[WS] Client subscribed to ${channel}`);
      }
      break;
    }

    case 'unsubscribe': {
      const client = clients.get(ws);
      if (client && channel) {
        client.subscriptions.delete(channel);
        sendMessage(ws, {
          type: 'unsubscribed',
          data: { channel },
        });
      }
      break;
    }

    case 'ping': {
      sendMessage(ws, { type: 'pong', data: { timestamp: Date.now() } });
      break;
    }

    default:
      sendMessage(ws, {
        type: 'error',
        data: { message: `Unknown action: ${action}` },
      });
  }
}

/**
 * Send a JSON message to a WebSocket client.
 */
function sendMessage(ws: WebSocket, payload: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * Broadcast a message to all clients subscribed to a channel.
 */
function broadcast(channel: string, data: any): void {
  const payload = JSON.stringify({ type: channel, data, timestamp: Date.now() });

  clients.forEach((client) => {
    if (client.subscriptions.has(channel) || client.subscriptions.has('*')) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  });
}

/**
 * Set up EventBus listeners that broadcast to WebSocket clients.
 */
function setupEventBroadcasters(): void {
  // Price updates
  eventBus.onEvent('market:price', (payload) => {
    broadcast('market:price', payload.data);
  });

  // Orderbook updates
  eventBus.onEvent('market:orderbook', (payload) => {
    broadcast('market:orderbook', payload.data);
  });

  // Trade fills
  eventBus.onEvent('trade:executed', (payload) => {
    broadcast('trade:fill', payload.data);
  });

  // System events
  eventBus.onEvent('system:emergency_stop', (payload) => {
    broadcast('system', payload.data);
  });
}

/**
 * Get WebSocket server stats.
 */
export function getWsStats(): { connectedClients: number; channels: string[] } {
  const channels = new Set<string>();
  clients.forEach((client) => {
    client.subscriptions.forEach((ch) => channels.add(ch));
  });
  return {
    connectedClients: clients.size,
    channels: Array.from(channels),
  };
}

/**
 * Shut down the WebSocket server.
 */
export function closeWebSocket(): void {
  if (wss) {
    clients.forEach((client) => {
      client.ws.close();
    });
    clients.clear();
    wss.close();
    wss = null;
    logger.info('[WS] WebSocket server closed');
  }
}
