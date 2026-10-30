/**
 * OLTO Frontend Subsystem — Reactive Network Client (REST & API Primitives)
 * =========================================================================
 * Provides fine-grained Signal-integrated network capabilities:
 *   - Auto-updating reactive resource objects { data, loading, error, refetch }
 *   - Bearer token session management without raw secret exposure
 *   - Built-in E9001 runtime safety guard against leaked server secrets
 *   - Cross-platform compatible (Node.js & standard browser fetch)
 */

import { Signal } from '../runtime/Signal';

export interface RequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  authToken?: string;
  query?: Record<string, string | number | boolean>;
}

export interface ReactiveResource<T> {
  data: Signal<T | null>;
  loading: Signal<boolean>;
  error: Signal<string | null>;
  refetch: () => Promise<T | null>;
}

export class OltoClient {
  private static defaultBaseUrl: string = '';
  private static globalAuthToken: string | null = null;

  public static setBaseUrl(url: string): void {
    this.defaultBaseUrl = url.replace(/\/+$/, '');
  }

  public static setAuthToken(token: string | null): void {
    this.globalAuthToken = token;
  }

  public static getAuthToken(): string | null {
    return this.globalAuthToken;
  }

  /**
   * Performs an asynchronous GET request and returns a reactive resource
   * backed by fine-grained signals.
   */
  public static useFetch<T = any>(endpoint: string, options: RequestOptions = {}): ReactiveResource<T> {
    const data = new Signal<T | null>(null);
    const loading = new Signal<boolean>(true);
    const error = new Signal<string | null>(null);

    const doFetch = async (): Promise<T | null> => {
      loading.set(true);
      error.set(null);

      try {
        const result = await this.get<T>(endpoint, options);
        data.set(result);
        loading.set(false);
        return result;
      } catch (err: any) {
        error.set(err.message || String(err));
        loading.set(false);
        return null;
      }
    };

    // Trigger initial fetch
    doFetch().catch(() => {});

    return {
      data,
      loading,
      error,
      refetch: doFetch,
    };
  }

  /**
   * Performs an HTTP GET request.
   */
  public static async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  /**
   * Performs an HTTP POST request.
   */
  public static async post<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', endpoint, body, options);
  }

  /**
   * Performs an HTTP PUT request.
   */
  public static async put<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', endpoint, body, options);
  }

  /**
   * Performs an HTTP DELETE request.
   */
  public static async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  /**
   * Core request dispatcher with safety checks.
   */
  private static async request<T>(method: string, endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    // 1. Security Check: Prevent leaking server API secrets in headers or URLs
    this.assertSecurityCompliance(endpoint, options);

    const fullUrl = this.resolveUrl(endpoint, options.query);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...options.headers,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const token = options.authToken || this.globalAuthToken;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = options.timeoutMs || 10000;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller ? controller.signal : undefined,
      });

      if (!response.ok) {
        let errMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        try {
          const errBody = await response.json();
          if (errBody && errBody.message) errMessage = errBody.message;
        } catch (_) {}
        throw new Error(errMessage);
      }

      if (response.status === 204) {
        return null as unknown as T;
      }

      return (await response.json()) as T;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private static resolveUrl(endpoint: string, query?: Record<string, string | number | boolean>): string {
    let base = endpoint;
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = this.defaultBaseUrl ? `${this.defaultBaseUrl}/${base.replace(/^\/+/, '')}` : base;
    }

    if (query) {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) {
          parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
      }
      if (parts.length > 0) {
        base += (base.includes('?') ? '&' : '?') + parts.join('&');
      }
    }

    return base;
  }

  /**
   * Runtime Security Invariant (E9001):
   * Ensures client requests do not pass raw database credentials, master keys,
   * or stripe secrets in client-side headers.
   */
  private static assertSecurityCompliance(endpoint: string, options: RequestOptions): void {
    const dangerousPatterns = ['sk_live_', 'AIzaSy', 'secret_key', 'db_password', 'root_token'];

    // Check endpoint URL
    for (const pat of dangerousPatterns) {
      if (endpoint.includes(pat)) {
        throw new Error(`[E9001: ClientSecretExposureViolation] Dangerous secret token '${pat}' detected in endpoint URL. Move privileged credentials to backend .one service.`);
      }
    }

    // Check custom headers
    if (options.headers) {
      for (const [headerKey, headerVal] of Object.entries(options.headers)) {
        for (const pat of dangerousPatterns) {
          if (headerVal.includes(pat)) {
            throw new Error(`[E9001: ClientSecretExposureViolation] Dangerous secret detected in header '${headerKey}'. Client-side OLTO execution cannot hold server secrets.`);
          }
        }
      }
    }
  }
}
