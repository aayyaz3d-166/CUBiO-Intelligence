/**
 * OLTO Frontend Subsystem — Component Instance & Lifecycle Manager
 * =================================================================
 * Manages reactive state registry, action dispatching, and lifecycle
 * triggers (onMount, onDestroy) for active components.
 */

import { Signal, Computed, createEffect } from './Signal';
import { OltoDOMElement } from './OltoDOMRenderer';

export type LifecycleHook = () => void | Promise<void>;

export class OltoComponentInstance {
  public name: string;
  public stateSignals: Map<string, Signal<any>> = new Map();
  public computedProps: Map<string, Computed<any>> = new Map();
  public mountHooks: LifecycleHook[] = [];
  public destroyHooks: LifecycleHook[] = [];
  public rootElement: OltoDOMElement | null = null;
  public isMounted: boolean = false;
  private cleanups: (() => void)[] = [];

  constructor(name: string) {
    this.name = name;
  }

  public registerState<T>(name: string, initialValue: T): Signal<T> {
    const s = new Signal<T>(initialValue);
    this.stateSignals.set(name, s);
    return s;
  }

  public getState<T>(name: string): Signal<T> {
    const s = this.stateSignals.get(name);
    if (!s) {
      throw new Error(`[OltoRuntime Error] State '${name}' is not registered on component '${this.name}'.`);
    }
    return s as Signal<T>;
  }

  public registerComputed<T>(name: string, fn: () => T): Computed<T> {
    const c = new Computed<T>(fn);
    this.computedProps.set(name, c);
    return c;
  }

  public getComputed<T>(name: string): Computed<T> {
    const c = this.computedProps.get(name);
    if (!c) {
      throw new Error(`[OltoRuntime Error] Computed property '${name}' is not registered on '${this.name}'.`);
    }
    return c as Computed<T>;
  }

  public registerWatch(targetSignal: () => any, callback: () => void): void {
    const dispose = createEffect(() => {
      targetSignal();
      callback();
    });
    this.cleanups.push(dispose);
  }

  public onMount(hook: LifecycleHook): void {
    this.mountHooks.push(hook);
  }

  public onDestroy(hook: LifecycleHook): void {
    this.destroyHooks.push(hook);
  }

  public async mount(parent?: OltoDOMElement): Promise<void> {
    if (this.isMounted) return;

    if (parent && this.rootElement) {
      parent.appendChild(this.rootElement);
    }

    this.isMounted = true;

    for (const hook of this.mountHooks) {
      await hook();
    }
  }

  public async destroy(): Promise<void> {
    if (!this.isMounted) return;

    for (const hook of this.destroyHooks) {
      await hook();
    }

    // Dispose all tracked effects
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups = [];

    // Detach from parent DOM element
    if (this.rootElement && this.rootElement.parent) {
      this.rootElement.parent.removeChild(this.rootElement);
    }

    this.isMounted = false;
  }
}
