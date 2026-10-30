/**
 * OLTO Frontend Subsystem — ONE Sovereign Service Bridge (IPC / RPC)
 * ==================================================================
 * Connects declarative OLTO frontend components with backend sovereign
 * ONE Language services (.one), UnifiedVM execution, and Qplayer.
 */

import { Signal } from '../runtime/Signal';
import { ReactiveResource } from './OltoClient';

export type ServiceHandler = (method: string, params: any) => Promise<any> | any;

export interface ServiceCallRequest {
  service: string;
  method: string;
  params?: any;
}

export interface ServiceCallResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
}

export class OneServiceBridge {
  private static registeredServices: Map<string, ServiceHandler> = new Map();
  private static serviceCallLog: Array<{ service: string; method: string; time: number }> = [];

  /**
   * Registers a backend sovereign .one service provider on the bridge.
   */
  public static registerService(serviceName: string, handler: ServiceHandler): void {
    this.registeredServices.set(serviceName.toLowerCase(), handler);
  }

  /**
   * Unregisters a service.
   */
  public static unregisterService(serviceName: string): boolean {
    return this.registeredServices.delete(serviceName.toLowerCase());
  }

  /**
   * Lists all currently registered sovereign services.
   */
  public static getRegisteredServices(): string[] {
    return Array.from(this.registeredServices.keys());
  }

  /**
   * Calls a backend sovereign service method from the frontend.
   */
  public static async call<T = any>(serviceName: string, method: string, params: any = {}): Promise<ServiceCallResponse<T>> {
    const t0 = performance.now();
    const serviceKey = serviceName.toLowerCase();
    this.serviceCallLog.push({ service: serviceKey, method, time: Date.now() });

    const handler = this.registeredServices.get(serviceKey);
    if (!handler) {
      return {
        success: false,
        error: `[OneServiceBridge Error] Sovereign service '${serviceName}' is not registered or running.`,
        executionTimeMs: Math.round(performance.now() - t0),
      };
    }

    try {
      const result = await handler(method, params);
      return {
        success: true,
        data: result as T,
        executionTimeMs: Math.round((performance.now() - t0) * 100) / 100,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err),
        executionTimeMs: Math.round((performance.now() - t0) * 100) / 100,
      };
    }
  }

  /**
   * Returns a reactive resource backed by fine-grained signals for continuous
   * synchronization with a backend .one service method.
   */
  public static useService<T = any>(serviceName: string, method: string, params: any = {}): ReactiveResource<T> {
    const data = new Signal<T | null>(null);
    const loading = new Signal<boolean>(true);
    const error = new Signal<string | null>(null);

    const execute = async (): Promise<T | null> => {
      loading.set(true);
      error.set(null);

      const resp = await this.call<T>(serviceName, method, params);
      if (resp.success) {
        data.set(resp.data !== undefined ? resp.data : null);
        loading.set(false);
        return resp.data || null;
      } else {
        error.set(resp.error || 'Unknown service error');
        loading.set(false);
        return null;
      }
    };

    // Execute immediately
    execute().catch(() => {});

    return {
      data,
      loading,
      error,
      refetch: execute,
    };
  }

  /**
   * Clears all registered services (useful for testing clean slate).
   */
  public static reset(): void {
    this.registeredServices.clear();
    this.serviceCallLog = [];
  }
}
