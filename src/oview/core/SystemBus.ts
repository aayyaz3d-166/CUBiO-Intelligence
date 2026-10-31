/**
 * Oview OS — High-Speed System Event Bus (IPC Substrate)
 * =======================================================
 * SystemBus.ts: Micro-second event dispatching, typed pub-sub channels,
 * and system telemetry logging for sovereign application communication.
 */

import { SystemEvent } from './types';

export type EventHandler<T = any> = (event: SystemEvent<T>) => void;

export class SystemBus {
  private static instance: SystemBus | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private eventHistory: SystemEvent[] = [];
  private maxHistory: number = 200;

  private constructor() {}

  public static getInstance(): SystemBus {
    if (!SystemBus.instance) {
      SystemBus.instance = new SystemBus();
    }
    return SystemBus.instance;
  }

  public static resetInstance(): void {
    if (SystemBus.instance) {
      SystemBus.instance.listeners.clear();
      SystemBus.instance.eventHistory = [];
    }
    SystemBus.instance = new SystemBus();
  }

  /**
   * Subscribes to a specific system topic.
   */
  public on<T = any>(topic: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    this.listeners.get(topic)!.add(handler);

    return () => {
      this.off(topic, handler);
    };
  }

  /**
   * Subscribes to a topic for exactly one dispatch.
   */
  public once<T = any>(topic: string, handler: EventHandler<T>): () => void {
    const unsub = this.on<T>(topic, (event) => {
      unsub();
      handler(event);
    });
    return unsub;
  }

  /**
   * Unsubscribes an event handler from a topic.
   */
  public off(topic: string, handler: EventHandler): void {
    const set = this.listeners.get(topic);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(topic);
      }
    }
  }

  /**
   * Emits an event to all subscribers of a topic.
   */
  public emit<T = any>(topic: string, payload: T, source: string = 'system'): void {
    const event: SystemEvent<T> = {
      type: topic,
      source,
      payload,
      timestamp: Date.now(),
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    const directListeners = this.listeners.get(topic);
    if (directListeners) {
      for (const handler of Array.from(directListeners)) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[SystemBus Error in handler for '${topic}']`, err);
        }
      }
    }

    // Wildcard listeners: 'window:*', 'system:*'
    const prefix = topic.split(':')[0] + ':*';
    const wildcardListeners = this.listeners.get(prefix);
    if (wildcardListeners) {
      for (const handler of Array.from(wildcardListeners)) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[SystemBus Error in wildcard handler for '${prefix}']`, err);
        }
      }
    }

    // Global listeners: '*'
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      for (const handler of Array.from(allListeners)) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[SystemBus Error in global handler]`, err);
        }
      }
    }
  }

  /**
   * Returns recent event history for debugging and AI telemetry.
   */
  public getHistory(): readonly SystemEvent[] {
    return this.eventHistory;
  }

  /**
   * Clears all subscriptions.
   */
  public clear(): void {
    this.listeners.clear();
    this.eventHistory = [];
  }
}
