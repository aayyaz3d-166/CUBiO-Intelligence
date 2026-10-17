/**
 * CUBiO Working Memory Lattice — Miller's Law (7 ± 2) Cognitive Buffer
 * Gate: CNL-P30-001 | Sovereign Architecture ("one-cortex")
 *
 * Implements human prefrontal cortex working memory dynamics:
 * — Enforces George Miller's Law (1956): 7 ± 2 active cognitive chunks (clamped [5..9]).
 * — High-speed volatile buffer for multi-goal tracking without RAM/RSS bloat.
 * — Automatic salience & priority-based eviction of lowest-rank chunks.
 * — Bi-directional sync with Sovereign LTM (343-cell lattice) for memory consolidation.
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';
import { SovereignLTMCore } from './sovereign_cognitive_core';

export interface WorkingMemoryChunk {
  chunkId: string;
  intent: string;
  priority: number;        // Higher = more critical [1..100]
  salienceScore: number;   // Computed attention salience [0.0..1.0]
  payload: unknown;
  accessCount: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface WorkingMemorySnapshot {
  capacity: number;
  activeChunkCount: number;
  chunks: WorkingMemoryChunk[];
  pqcWorkingMemorySeal: string;
  timestamp: number;
}

export class WorkingMemoryLattice {
  public static readonly MIN_CAPACITY: number = 5;
  public static readonly DEFAULT_CAPACITY: number = 7;
  public static readonly MAX_CAPACITY: number = 9;

  private capacity: number = WorkingMemoryLattice.DEFAULT_CAPACITY;
  private chunks: Map<string, WorkingMemoryChunk> = new Map();
  private totalEvictions: number = 0;
  private totalConsolidations: number = 0;

  constructor(initialCapacity: number = WorkingMemoryLattice.DEFAULT_CAPACITY) {
    this.setCapacity(initialCapacity);
  }

  /**
   * Sets working memory capacity strictly within Miller's Law boundaries (7 ± 2 -> [5..9]).
   */
  public setCapacity(newCapacity: number): void {
    if (newCapacity < WorkingMemoryLattice.MIN_CAPACITY || newCapacity > WorkingMemoryLattice.MAX_CAPACITY) {
      throw new Error(
        `Miller's Law Violation: Working memory capacity must be within 7 ± 2 (${WorkingMemoryLattice.MIN_CAPACITY}..${WorkingMemoryLattice.MAX_CAPACITY}), received ${newCapacity}`
      );
    }
    this.capacity = newCapacity;

    // Prune if current chunks exceed new capacity
    while (this.chunks.size > this.capacity) {
      this.evictLowestPriorityChunk();
    }
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getActiveChunkCount(): number {
    return this.chunks.size;
  }

  public getActiveChunks(): WorkingMemoryChunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Stores or updates a cognitive chunk in working memory.
   * If capacity is reached, automatically evicts the lowest-salience chunk.
   */
  public storeChunk(
    chunkId: string,
    intent: string,
    priority: number,
    salienceScore: number = 1.0,
    payload: unknown = null
  ): { stored: boolean; evictedChunk?: WorkingMemoryChunk } {
    const now = Date.now();
    let evictedChunk: WorkingMemoryChunk | undefined = undefined;

    // If chunk already exists, update in-place
    if (this.chunks.has(chunkId)) {
      const existing = this.chunks.get(chunkId)!;
      existing.intent = intent;
      existing.priority = priority;
      existing.salienceScore = salienceScore;
      existing.payload = payload;
      existing.accessCount++;
      existing.lastAccessedAt = now;
      return { stored: true };
    }

    // Capacity enforcement via Miller's Law
    if (this.chunks.size >= this.capacity) {
      evictedChunk = this.evictLowestPriorityChunk();
    }

    const newChunk: WorkingMemoryChunk = {
      chunkId,
      intent,
      priority,
      salienceScore,
      payload,
      accessCount: 1,
      createdAt: now,
      lastAccessedAt: now,
    };

    this.chunks.set(chunkId, newChunk);
    return { stored: true, evictedChunk };
  }

  /**
   * Recalls a chunk from working memory, updating its salience and access counter.
   */
  public recallChunk(chunkId: string): WorkingMemoryChunk | undefined {
    const chunk = this.chunks.get(chunkId);
    if (chunk) {
      chunk.accessCount++;
      chunk.lastAccessedAt = Date.now();
    }
    return chunk;
  }

  /**
   * Evicts the chunk with the lowest composite score (priority * 0.6 + salience * 40).
   */
  public evictLowestPriorityChunk(): WorkingMemoryChunk | undefined {
    if (this.chunks.size === 0) return undefined;

    let lowestKey: string | null = null;
    let lowestScore = Infinity;

    for (const [key, chunk] of this.chunks.entries()) {
      const compositeScore = chunk.priority * 0.6 + chunk.salienceScore * 40.0;
      if (compositeScore < lowestScore) {
        lowestScore = compositeScore;
        lowestKey = key;
      }
    }

    if (lowestKey && this.chunks.has(lowestKey)) {
      const evicted = this.chunks.get(lowestKey)!;
      this.chunks.delete(lowestKey);
      this.totalEvictions++;
      return evicted;
    }

    return undefined;
  }

  /**
   * Consolidates all active working memory chunks into Sovereign LTM lattice cells.
   */
  public consolidateToLTM(ltm: SovereignLTMCore, baseCoord: [number, number, number] = [0, 0, 0]): number {
    let count = 0;
    for (const chunk of this.chunks.values()) {
      const cellCoord: [number, number, number] = [
        (baseCoord[0] + count) % 7,
        (baseCoord[1] + count) % 7,
        (baseCoord[2] + count) % 7,
      ];
      ltm.storeMemoryTrace(cellCoord, `WM_CONSOLIDATED_${chunk.chunkId}`, {
        intent: chunk.intent,
        priority: chunk.priority,
        salience: chunk.salienceScore,
        accessCount: chunk.accessCount,
        consolidatedAt: Date.now(),
      });
      count++;
    }
    this.totalConsolidations += count;
    return count;
  }

  /**
   * Emits PQC-sealed working memory state snapshot.
   */
  public generateWorkingMemorySnapshot(): WorkingMemorySnapshot {
    const activeChunks = this.getActiveChunks();
    const serialized = activeChunks
      .map((c) => `${c.chunkId}:${c.priority}:${c.salienceScore.toFixed(4)}:${c.intent}`)
      .sort()
      .join('|');

    const pqcWorkingMemorySeal = PQCLatticeSealEngine.generatePQCSeal(
      Buffer.from(`WM_LATTICE_CAP_${this.capacity}_COUNT_${activeChunks.length}|${serialized}`, 'utf-8')
    );

    return {
      capacity: this.capacity,
      activeChunkCount: activeChunks.length,
      chunks: activeChunks,
      pqcWorkingMemorySeal,
      timestamp: Date.now(),
    };
  }

  public getTotalEvictions(): number {
    return this.totalEvictions;
  }

  public getTotalConsolidations(): number {
    return this.totalConsolidations;
  }
}
