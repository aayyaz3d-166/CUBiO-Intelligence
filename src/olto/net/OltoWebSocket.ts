/**
 * OLTO Frontend Subsystem — Reactive WebSocket Stream
 * ===================================================
 * Real-time event streaming primitives connected to fine-grained Signals.
 * Supports auto-reconnect, structured JSON dispatch, and reactive subscriptions.
 */

import { Signal } from '../runtime/Signal';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface OltoSocketOptions {
  autoReconnect?: boolean;
  reconnectIntervalMs?: number;
  maxReconnectAttempts?: number;
}

export class OltoWebSocket {
  public status: Signal<SocketStatus>;
  public lastMessage: Signal<any>;
  public messageCount: Signal<number>;

  private url: string;
  private socket: any = null;
  private options: OltoSocketOptions;
  private reconnectAttempts: number = 0;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isExplicitlyClosed: boolean = false;

  constructor(url: string, options: OltoSocketOptions = {}) {
    this.url = url;
    this.options = {
      autoReconnect: options.autoReconnect ?? true,
      reconnectIntervalMs: options.reconnectIntervalMs ?? 3000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
    };

    this.status = new Signal<SocketStatus>('disconnected');
    this.lastMessage = new Signal<any>(null);
    this.messageCount = new Signal<number>(0);
  }

  /**
   * Connects to the remote WebSocket server.
   */
  public connect(): void {
    if (this.socket && this.status.get() === 'connected') return;

    this.isExplicitlyClosed = false;
    this.status.set('connecting');

    // Cross-platform WebSocket constructor
    const WSConstructor = (typeof globalThis !== 'undefined' && (globalThis as any).WebSocket)
      ? (globalThis as any).WebSocket
      : null;

    if (!WSConstructor) {
      // In non-browser environments without native WS, transition to connected for mockable IPC
      this.status.set('connected');
      return;
    }

    try {
      this.socket = new WSConstructor(this.url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.status.set('connected');
        this.emit('open', { url: this.url });
      };

      this.socket.onmessage = (event: any) => {
        let payload = event.data;
        try {
          payload = JSON.parse(event.data);
        } catch (_) {}

        this.lastMessage.set(payload);
        this.messageCount.set(c => c + 1);

        if (payload && payload.type) {
          this.emit(payload.type, payload.data || payload);
        }
        this.emit('message', payload);
      };

      this.socket.onerror = (err: any) => {
        this.status.set('error');
        this.emit('error', err);
      };

      this.socket.onclose = () => {
        this.status.set('disconnected');
        this.emit('close', {});

        if (!this.isExplicitlyClosed && this.options.autoReconnect && this.reconnectAttempts < (this.options.maxReconnectAttempts || 5)) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), this.options.reconnectIntervalMs);
        }
      };
    } catch (err) {
      this.status.set('error');
    }
  }

  /**
   * Sends data over the socket connection.
   */
  public send(data: any): void {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    if (this.socket && typeof this.socket.send === 'function' && this.status.get() === 'connected') {
      this.socket.send(raw);
    } else {
      // Simulated/local echo dispatch for headless testing
      this.emit('send', data);
    }
  }

  /**
   * Subscribes to an event type. Returns an unsubscribe callback.
   */
  public subscribe(eventType: string, handler: (data: any) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    return () => {
      const set = this.listeners.get(eventType);
      if (set) {
        set.delete(handler);
      }
    };
  }

  /**
   * Emits incoming message to local subscribers.
   */
  public emit(eventType: string, data: any): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[OltoWebSocket Error] Handler error for '${eventType}':`, err);
        }
      }
    }
  }

  /**
   * Closes the active socket connection cleanly.
   */
  public close(): void {
    this.isExplicitlyClosed = true;
    if (this.socket && typeof this.socket.close === 'function') {
      this.socket.close();
    }
    this.status.set('disconnected');
    this.socket = null;
  }
}
