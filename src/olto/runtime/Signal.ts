/**
 * OLTO Frontend Subsystem — Fine-Grained Reactive Signal Engine
 * ==============================================================
 * High-performance, zero-virtual-DOM dependency tracking engine.
 * Provides micro-task batched updates, computed reactive cells,
 * and automatic subscriber cleanup.
 */

export type Subscriber = {
  execute: () => void;
  dependencies: Set<Set<Subscriber>>;
};

let activeSubscriber: Subscriber | null = null;
let batchDepth = 0;
const pendingSubscribers = new Set<Subscriber>();

export class Signal<T> {
  private value: T;
  private subscribers = new Set<Subscriber>();

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  public get(): T {
    if (activeSubscriber) {
      this.subscribers.add(activeSubscriber);
      activeSubscriber.dependencies.add(this.subscribers);
    }
    return this.value;
  }

  public set(newValue: T | ((prev: T) => T)): void {
    const resolvedValue =
      typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(this.value)
        : newValue;

    if (this.value !== resolvedValue) {
      this.value = resolvedValue;
      this.notify();
    }
  }

  public peek(): T {
    return this.value;
  }

  private notify(): void {
    const subs = Array.from(this.subscribers);
    for (const sub of subs) {
      if (batchDepth > 0) {
        pendingSubscribers.add(sub);
      } else {
        sub.execute();
      }
    }
  }
}

export class Computed<T> {
  private computation: () => T;
  private cachedValue!: T;
  private isDirty = true;
  private signal: Signal<T>;
  private subscriber: Subscriber;

  constructor(computation: () => T) {
    this.computation = computation;
    this.signal = new Signal<T>(undefined as any);

    this.subscriber = {
      execute: () => {
        this.isDirty = true;
        this.signal.set(this.get());
      },
      dependencies: new Set(),
    };

    // Initial evaluation
    this.signal.set(this.get());
  }

  public get(): T {
    if (this.isDirty) {
      cleanupSubscriber(this.subscriber);
      const prevSubscriber = activeSubscriber;
      activeSubscriber = this.subscriber;
      try {
        this.cachedValue = this.computation();
        this.isDirty = false;
      } finally {
        activeSubscriber = prevSubscriber;
      }
    }

    if (activeSubscriber) {
      // Connect parent subscriber to our internal signal
      this.signal.get();
    }

    return this.cachedValue;
  }

  public peek(): T {
    if (this.isDirty) {
      return this.computation();
    }
    return this.cachedValue;
  }
}

export function createEffect(fn: () => void): () => void {
  let isRunning = false;
  const subscriber: Subscriber = {
    execute: () => {
      if (isRunning) return;
      isRunning = true;
      cleanupSubscriber(subscriber);
      const prev = activeSubscriber;
      activeSubscriber = subscriber;
      try {
        fn();
      } finally {
        activeSubscriber = prev;
        isRunning = false;
      }
    },
    dependencies: new Set(),
  };

  // Run immediately to track dependencies
  subscriber.execute();

  // Return dispose function
  return () => {
    cleanupSubscriber(subscriber);
  };
}

export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const queue = Array.from(pendingSubscribers);
      pendingSubscribers.clear();
      for (const sub of queue) {
        sub.execute();
      }
    }
  }
}

function cleanupSubscriber(sub: Subscriber): void {
  for (const depSet of sub.dependencies) {
    depSet.delete(sub);
  }
  sub.dependencies.clear();
}

// ──────────────── Convenience Factory Functions ────────────────
export function signal<T>(initial: T): [() => T, (val: T | ((prev: T) => T)) => void] {
  const s = new Signal(initial);
  return [() => s.get(), (val) => s.set(val)];
}

export function computed<T>(fn: () => T): () => T {
  const c = new Computed(fn);
  return () => c.get();
}
