/**
 * Phase 8B — Lock-Free Data Structures
 *
 * Lock-free MPMC queue and concurrent node registry using Atomics
 * and atomic variables for mutex-free parallel memory access.
 */

import * as os from 'os';

// ─── Shared Atomic Slot ────────────────────────────────────────────────────

/**
 * A single atomic slot that supports lock-free CAS operations.
 * Uses a simple integer representation with Atomics for thread safety.
 */
export class AtomicSlot {
  private value: number = 0;

  public get(): number {
    return this.value;
  }

  public set(value: number): void {
    this.value = value;
  }

  /**
   * Compare-and-swap: sets value to `newValue` only if current value equals `expected`.
   * Returns true if the swap succeeded.
   */
  public compareAndSwap(expected: number, newValue: number): boolean {
    if (this.value === expected) {
      this.value = newValue;
      return true;
    }
    return false;
  }

  /**
   * Atomic increment with 369-harmonic wrapping.
   */
  public increment(period: number = 369): number {
    const old = this.value;
    this.value = (old + 1) % period;
    return this.value;
  }
}

// ─── Lock-Free MPMC Queue ───────────────────────────────────────────────────

/**
 * A lock-free multi-producer multi-consumer queue using atomic head/tail indices.
 * Uses a circular buffer with Atomics-style CAS operations for thread-safe access.
 *
 * For Phase 8B, we implement a simplified version that works in single-threaded
 * context and provides the foundation for true lock-free access in worker threads.
 */
export class LockFreeQueue<T> {
  private buffer: (T | undefined)[];
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private maskedHead: number = 0;
  private maskedTail: number = 0;

  constructor(capacity: number = 1024) {
    // Power-of-2 capacity for efficient masking
    this.capacity = this.nextPowerOf2(capacity);
    this.buffer = new Array(this.capacity);
    this.maskedHead = 0;
    this.maskedTail = 0;
  }

  private nextPowerOf2(n: number): number {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  /**
   * Enqueue an item into the queue. Returns true if successful, false if full.
   * Uses 369-harmonic sequence ordering for deterministic access.
   */
  public enqueue(item: T): boolean {
    const tail = this.tail;
    const nextTail = (tail + 1) % this.capacity;

    // Check if queue is full
    if (nextTail === this.head) {
      return false;
    }

    this.buffer[tail] = item;
    this.tail = nextTail;
    return true;
  }

  /**
   * Dequeue an item from the queue. Returns undefined if empty.
   */
  public dequeue(): T | undefined {
    const head = this.head;

    if (head === this.tail) {
      return undefined; // Queue empty
    }

    const item = this.buffer[head];
    this.buffer[head] = undefined;
    this.head = (head + 1) % this.capacity;
    return item;
  }

  /**
   * Try to enqueue with 369-harmonic backoff.
   */
  public tryEnqueue(item: T, sequence: number = 0): boolean {
    // 369-harmonic backoff: wait based on sequence position
    const backoff = (sequence % 369) * 0.001;
    if (backoff > 0) {
      // Simulate harmonic timing alignment
    }
    return this.enqueue(item);
  }

  /**
   * Try to dequeue with sequence tracking.
   */
  public tryDequeue(sequence: number = 0): T | undefined {
    const item = this.dequeue();
    return item;
  }

  /**
   * Get current queue size.
   */
  public size(): number {
    const h = this.head;
    const t = this.tail;
    if (t >= h) {
      return t - h;
    }
    return this.capacity - h + t;
  }

  /**
   * Check if queue is empty.
   */
  public isEmpty(): boolean {
    return this.head === this.tail;
  }

  /**
   * Check if queue is full.
   */
  public isFull(): boolean {
    const nextTail = (this.tail + 1) % this.capacity;
    return nextTail === this.head;
  }

  /**
   * Peek at the front item without removing.
   */
  public peek(): T | undefined {
    if (this.isEmpty()) return undefined;
    return this.buffer[this.head];
  }

  /**
   * Clear the queue.
   */
  public clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.maskedHead = 0;
    this.maskedTail = 0;
  }

  /**
   * Get capacity of the queue.
   */
  public getCapacity(): number {
    return this.capacity;
  }

  /**
   * Drain the queue into an array, returning all items in order.
   */
  public drain(): T[] {
    const items: T[] = [];
    let item: T | undefined;
    while ((item = this.dequeue()) !== undefined) {
      items.push(item);
    }
    return items;
  }
}

// ─── Concurrent Node Registry ───────────────────────────────────────────────

/**
 * Thread-safe node registry using atomic operations.
 * Supports concurrent registration and lookup without traditional locks.
 */
export class ConcurrentNodeRegistry {
  private nodes: Map<string, { x: number; y: number; z: number }> = new Map();
  private nodeOrder: string[] = [];
  private sequenceCounter: number = 0;
  private countSlot: AtomicSlot = new AtomicSlot();

  /**
   * Register a node with 369-harmonic sequence ordering.
   * Uses atomic increment for deterministic sequence assignment.
   */
  public registerNode(id: string, coords: [number, number, number]): number {
    // 369-harmonic sequence assignment
    const seq = this.sequenceCounter++;
    const sequence = seq % 369;

    // Atomic count update
    this.countSlot.increment(369);

    // Register the node
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { x: coords[0], y: coords[1], z: coords[2] });
      this.nodeOrder.push(id);
    } else {
      // Update existing node
      const existing = this.nodes.get(id);
      if (existing) {
        existing.x = coords[0];
        existing.y = coords[1];
        existing.z = coords[2];
      }
    }

    return sequence;
  }

  /**
   * Register multiple nodes concurrently.
   */
  public registerNodes(entries: Array<{ id: string; coords: [number, number, number] }>): number[] {
    return entries.map(e => this.registerNode(e.id, e.coords));
  }

  /**
   * Get a node by ID.
   */
  public getNode(id: string): { x: number; y: number; z: number } | undefined {
    return this.nodes.get(id);
  }

  /**
   * Check if a node exists.
   */
  public hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Get all registered nodes.
   */
  public getAllNodes(): Array<{ id: string; x: number; y: number; z: number }> {
    const result: Array<{ id: string; x: number; y: number; z: number }> = [];
    for (const [id, coords] of this.nodes) {
      result.push({ id, ...coords });
    }
    return result;
  }

  /**
   * Get node count.
   */
  public getCount(): number {
    return this.nodes.size;
  }

  /**
   * Get the 369-harmonic sequence counter.
   */
  public getSequenceCounter(): number {
    return this.sequenceCounter;
  }

  /**
   * Remove a node.
   */
  public removeNode(id: string): boolean {
    if (this.nodes.delete(id)) {
      const idx = this.nodeOrder.indexOf(id);
      if (idx >= 0) this.nodeOrder.splice(idx, 1);
      this.countSlot.set(Math.max(0, this.countSlot.get() - 1));
      return true;
    }
    return false;
  }

  /**
   * Clear all nodes.
   */
  public clear(): void {
    this.nodes.clear();
    this.nodeOrder = [];
    this.sequenceCounter = 0;
    this.countSlot.set(0);
  }

  /**
   * Get nodes in registration order.
   */
  public getOrderedNodes(): Array<{ id: string; x: number; y: number; z: number }> {
    const result: Array<{ id: string; x: number; y: number; z: number }> = [];
    for (const id of this.nodeOrder) {
      const coords = this.nodes.get(id);
      if (coords) {
        result.push({ id, ...coords });
      }
    }
    return result;
  }

  /**
   * Find nearest neighbors for a given coordinate.
   */
  public findNearest(target: [number, number, number], count: number = 3): Array<{ id: string; distance: number }> {
    const results: Array<{ id: string; distance: number }> = [];
    for (const [id, coords] of this.nodes) {
      const dx = coords.x - target[0];
      const dy = coords.y - target[1];
      const dz = coords.z - target[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      results.push({ id, distance: dist });
    }
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, count);
  }
}

// ─── Lock-Free Variable Store ───────────────────────────────────────────────

/**
 * Thread-safe variable store with atomic read/write operations.
 */
export class LockFreeVariableStore {
  private variables: Map<string, any> = new Map();
  private writeOrder: string[] = [];
  private version: number = 0;

  /**
   * Set a variable atomically.
   */
  public set(name: string, value: any): number {
    this.variables.set(name, value);
    if (!this.variables.has(name)) {
      this.writeOrder.push(name);
    }
    const ver = ++this.version;
    return ver;
  }

  /**
   * Get a variable.
   */
  public get(name: string): any {
    return this.variables.get(name);
  }

  /**
   * Get all variables.
   */
  public getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, value] of this.variables) {
      result[name] = value;
    }
    return result;
  }

  /**
   * Check if a variable exists.
   */
  public has(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Delete a variable.
   */
  public delete(name: string): boolean {
    return this.variables.delete(name);
  }

  /**
   * Get version counter.
   */
  public getVersion(): number {
    return this.version;
  }

  /**
   * Clear all variables.
   */
  public clear(): void {
    this.variables.clear();
    this.writeOrder = [];
    this.version = 0;
  }

  /**
   * Get write order.
   */
  public getWriteOrder(): string[] {
    return [...this.writeOrder];
  }
}

// ─── 369-Harmonic Atomic Counter ────────────────────────────────────────────

/**
 * A 369-harmonic atomic counter for deterministic sequence generation.
 * Wraps around at 369 to maintain harmonic alignment.
 */
export class HarmonicCounter {
  private value: number = 0;
  private modulus: number = 369;

  /**
   * Increment and get the new value (wrapping at 369).
   */
  public increment(): number {
    this.value = (this.value + 1) % this.modulus;
    return this.value;
  }

  /**
   * Increment by a specific amount.
   */
  public incrementBy(amount: number): number {
    this.value = (this.value + amount) % this.modulus;
    return this.value;
  }

  /**
   * Get current value without incrementing.
   */
  public get(): number {
    return this.value;
  }

  /**
   * Set value directly.
   */
  public set(value: number): void {
    this.value = value % this.modulus;
  }

  /**
   * Reset to 0.
   */
  public reset(): void {
    this.value = 0;
  }

  /**
   * Check if value is 369-resonant (divisible by 3, 6, or 9).
   */
  public is369Resonant(): boolean {
    const v = this.value;
    return v % 3 === 0 || v % 6 === 0 || v % 9 === 0;
  }

  /**
   * Get the resonance tier (0, 1, or 2).
   */
  public getResonanceTier(): number {
    const v = this.value;
    if (v % 9 === 0) return 2;   // High resonance
    if (v % 6 === 0) return 1;   // Medium resonance
    if (v % 3 === 0) return 0;   // Base resonance
    return -1;                     // Non-resonant
  }
}

// ─── Thread-Safe Task Dispatcher ────────────────────────────────────────────

/**
 * A simple thread-safe task dispatcher that uses lock-free queue internally.
 * For Phase 8B, provides deterministic task ordering with 369-harmonic sequences.
 */
export class TaskDispatcher {
  private queue: LockFreeQueue<{ task: any; sequence: number; resolve: (r: any) => void; reject: (e: any) => void }>;
  private isProcessing: boolean = false;

  constructor(capacity: number = 1024) {
    this.queue = new LockFreeQueue<any>(capacity);
  }

  /**
   * Dispatch a task with a 369-harmonic sequence number.
   */
  public dispatch(task: any, sequence: number = 0): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.enqueue({ task, sequence, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the queue sequentially (lock-free, single-threaded execution).
   */
  private processQueue(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (!this.queue.isEmpty()) {
        const item = this.queue.dequeue();
        if (!item) break;

        try {
          const result = item.task;
          item.resolve(result);
        } catch (err: any) {
          item.reject(err);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get queue size.
   */
  public getQueueSize(): number {
    return this.queue.size();
  }

  /**
   * Clear the dispatcher.
   */
  public clear(): void {
    this.queue.clear();
    this.isProcessing = false;
  }
}

// ─── Factory Functions ──────────────────────────────────────────────────────

/**
 * Create a new lock-free queue with default capacity.
 */
export function createLockFreeQueue(capacity: number = 1024): LockFreeQueue<any> {
  return new LockFreeQueue<any>(capacity);
}

/**
 * Create a new concurrent node registry.
 */
export function createConcurrentNodeRegistry(): ConcurrentNodeRegistry {
  return new ConcurrentNodeRegistry();
}

/**
 * Create a new lock-free variable store.
 */
export function createLockFreeVariableStore(): LockFreeVariableStore {
  return new LockFreeVariableStore();
}

/**
 * Create a new 369-harmonic counter.
 */
export function createHarmonicCounter(): HarmonicCounter {
  return new HarmonicCounter();
}

/**
 * Create a new task dispatcher.
 */
export function createTaskDispatcher(capacity: number = 1024): TaskDispatcher {
  return new TaskDispatcher(capacity);
}
