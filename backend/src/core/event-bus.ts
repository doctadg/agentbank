/**
 * Event Bus
 *
 * Simple EventEmitter wrapper replacing Redis message-bus.
 * All PerpsTrader message-bus.publish() calls map to eventBus.emit().
 */

import { EventEmitter } from 'events';

export type EventMap = Record<string, any>;

export interface EventPayload<T = any> {
  type: string;
  data: T;
  timestamp: number;
}

class EventBus extends EventEmitter {
  private history: EventPayload[] = [];
  private maxHistory: number = 1000;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Emit an event (replaces message-bus.publish)
   */
  emitEvent<T = any>(type: string, data: T): void {
    const payload: EventPayload<T> = {
      type,
      data,
      timestamp: Date.now(),
    };

    // Store in history for late subscribers
    this.history.push(payload);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.emit(type, payload);
    this.emit('*', payload);
  }

  /**
   * Subscribe to an event type (replaces message-bus.subscribe)
   */
  onEvent<T = any>(type: string, handler: (payload: EventPayload<T>) => void): () => void {
    const wrapper = (payload: EventPayload) => {
      handler(payload as EventPayload<T>);
    };

    this.on(type, wrapper);
    return () => this.off(type, wrapper);
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: (payload: EventPayload) => void): () => void {
    this.on('*', handler);
    return () => this.off('*', handler);
  }

  /**
   * Get recent events of a given type
   */
  getRecentEvents(type?: string, limit: number = 50): EventPayload[] {
    const filtered = type
      ? this.history.filter(e => e.type === type)
      : this.history;
    return filtered.slice(-limit);
  }
}

export const eventBus = new EventBus();
export default eventBus;
