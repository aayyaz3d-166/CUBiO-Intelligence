/**
 * ONE Language & CubiO Spatial VM — Phase 3
 * Module: Spatial Query Engine (spatialQuery.ts)
 *
 * Provides structured queries against the 7×7×7 lattice:
 *  - Range queries: all cells in Chebyshev radius band [rMin, rMax]
 *  - Entropy threshold queries: cells with S(rho) above/below threshold
 *  - Tag-based queries: cells matching any/all given tags
 *  - Density-band queries: cells with bitDensity in [dMin, dMax]
 *  - Nearest-neighbor query: k closest occupied cells to a given coord
 *  - Aggregate statistics per shell or over selected cells
 */

import { GridMemory, MemoryCell, SpatialCoord } from './gridMemory';

export type QueryPredicate = (cell: MemoryCell) => boolean;

export interface QueryResult {
  cells: MemoryCell[];
  totalScanned: number;
  matchCount: number;
  executionTimeMs: number;
}

export interface ShellAggregateStats {
  shellRadius: number;
  count: number;
  avgEntropy: number;
  avgBitDensity: number;
  totalBytes: number;
  minEntropy: number;
  maxEntropy: number;
}

export class SpatialQueryEngine {
  private memory: GridMemory;

  constructor(memory: GridMemory) {
    this.memory = memory;
  }

  /**
   * General predicate-based query over all occupied cells
   */
  public query(predicate: QueryPredicate): QueryResult {
    const t0 = Date.now();
    const cells: MemoryCell[] = [];
    let scanned = 0;

    for (let r = 0; r <= 3; r++) {
      for (const idx of this.memory.getShellIndices(r)) {
        const coord = GridMemory.indexToCoord(idx);
        const cell = this.memory.getCell(coord);
        scanned++;
        if (cell.occupied && predicate(cell)) {
          cells.push(cell);
        }
      }
    }

    return {
      cells,
      totalScanned: scanned,
      matchCount: cells.length,
      executionTimeMs: Date.now() - t0,
    };
  }

  /**
   * Query cells within Chebyshev radius band [rMin, rMax]
   */
  public queryByShellRange(rMin: number, rMax: number, occupiedOnly: boolean = true): QueryResult {
    const t0 = Date.now();
    const cells: MemoryCell[] = [];
    let scanned = 0;

    for (let r = Math.max(0, rMin); r <= Math.min(3, rMax); r++) {
      for (const idx of this.memory.getShellIndices(r)) {
        const coord = GridMemory.indexToCoord(idx);
        const cell = this.memory.getCell(coord);
        scanned++;
        if (!occupiedOnly || cell.occupied) {
          cells.push(cell);
        }
      }
    }

    return {
      cells,
      totalScanned: scanned,
      matchCount: cells.length,
      executionTimeMs: Date.now() - t0,
    };
  }

  /**
   * Query cells with entropyScore in [sMin, sMax]
   */
  public queryByEntropyRange(sMin: number, sMax: number): QueryResult {
    return this.query(
      (cell) => cell.entropyScore >= sMin && cell.entropyScore <= sMax
    );
  }

  /**
   * Query cells with bitDensity in [dMin, dMax]
   */
  public queryByDensityRange(dMin: number, dMax: number): QueryResult {
    return this.query(
      (cell) => cell.bitDensity >= dMin && cell.bitDensity <= dMax
    );
  }

  /**
   * Tag-based query: occupied cells that contain any of the given tags
   */
  public queryByAnyTag(tags: string[]): QueryResult {
    const tagSet = new Set(tags);
    return this.query(
      (cell) => cell.tags.some((t) => tagSet.has(t))
    );
  }

  /**
   * Tag-based query: occupied cells that contain ALL of the given tags
   */
  public queryByAllTags(tags: string[]): QueryResult {
    const tagSet = new Set(tags);
    return this.query(
      (cell) => tags.every((t) => cell.tags.includes(t))
    );
  }

  /**
   * K-Nearest-Neighbor query (Chebyshev distance) from a given coordinate
   */
  public knn(center: SpatialCoord, k: number): MemoryCell[] {
    const allOccupied: Array<{ cell: MemoryCell; dist: number }> = [];

    for (let r = 0; r <= 3; r++) {
      for (const idx of this.memory.getShellIndices(r)) {
        const coord = GridMemory.indexToCoord(idx);
        const cell = this.memory.getCell(coord);
        if (!cell.occupied) continue;
        const dist = Math.max(
          Math.abs(coord.x - center.x),
          Math.abs(coord.y - center.y),
          Math.abs(coord.z - center.z)
        );
        allOccupied.push({ cell, dist });
      }
    }

    allOccupied.sort((a, b) => a.dist - b.dist);
    return allOccupied.slice(0, k).map((e) => e.cell);
  }

  /**
   * Entropy centroid: weighted average coordinate of occupied cells,
   * weighted by entropy score
   */
  public entropyCentroid(): SpatialCoord {
    let wx = 0, wy = 0, wz = 0, wSum = 0;
    for (let r = 0; r <= 3; r++) {
      for (const idx of this.memory.getShellIndices(r)) {
        const coord = GridMemory.indexToCoord(idx);
        const cell = this.memory.getCell(coord);
        if (!cell.occupied) continue;
        const w = cell.entropyScore > 0 ? cell.entropyScore : 1e-6;
        wx += coord.x * w;
        wy += coord.y * w;
        wz += coord.z * w;
        wSum += w;
      }
    }
    if (wSum === 0) return { x: 3, y: 3, z: 3 };
    return {
      x: Math.round(wx / wSum),
      y: Math.round(wy / wSum),
      z: Math.round(wz / wSum),
    };
  }

  /**
   * Per-shell aggregate statistics
   */
  public shellAggregates(): ShellAggregateStats[] {
    return [0, 1, 2, 3].map((r) => {
      const occupied: MemoryCell[] = [];
      for (const idx of this.memory.getShellIndices(r)) {
        const coord = GridMemory.indexToCoord(idx);
        const cell = this.memory.getCell(coord);
        if (cell.occupied) occupied.push(cell);
      }

      if (occupied.length === 0) {
        return {
          shellRadius: r, count: 0, avgEntropy: 0, avgBitDensity: 0,
          totalBytes: 0, minEntropy: 0, maxEntropy: 0,
        };
      }

      const entropyValues = occupied.map((c) => c.entropyScore);
      const avgEntropy = entropyValues.reduce((a, b) => a + b, 0) / occupied.length;
      const avgBitDensity = occupied.map((c) => c.bitDensity).reduce((a, b) => a + b, 0) / occupied.length;
      const totalBytes = occupied.reduce((a, c) => a + (c.data?.byteLength ?? 0), 0);

      return {
        shellRadius: r,
        count: occupied.length,
        avgEntropy,
        avgBitDensity,
        totalBytes,
        minEntropy: Math.min(...entropyValues),
        maxEntropy: Math.max(...entropyValues),
      };
    });
  }

  /**
   * Full scan: return summary statistics for all occupied cells
   */
  public globalStats(): {
    occupiedCells: number;
    totalBytes: number;
    avgEntropy: number;
    avgBitDensity: number;
    entropyHistogram: Record<string, number>;
  } {
    let occupied = 0, totalBytes = 0, sumEntropy = 0, sumDensity = 0;
    const hist: Record<string, number> = {
      'ZONE_A [0.0, 0.6)': 0,
      'ZONE_B [0.6, 1.4]': 0,
      'ZONE_C (1.4, 2.0]': 0,
    };

    for (let r = 0; r <= 3; r++) {
      for (const idx of this.memory.getShellIndices(r)) {
        const coord = GridMemory.indexToCoord(idx);
        const cell = this.memory.getCell(coord);
        if (!cell.occupied) continue;
        occupied++;
        totalBytes += cell.data?.byteLength ?? 0;
        sumEntropy += cell.entropyScore;
        sumDensity += cell.bitDensity;

        if (cell.entropyScore < 0.6) hist['ZONE_A [0.0, 0.6)']++;
        else if (cell.entropyScore <= 1.4) hist['ZONE_B [0.6, 1.4]']++;
        else hist['ZONE_C (1.4, 2.0]']++;
      }
    }

    return {
      occupiedCells: occupied,
      totalBytes,
      avgEntropy: occupied > 0 ? sumEntropy / occupied : 0,
      avgBitDensity: occupied > 0 ? sumDensity / occupied : 0,
      entropyHistogram: hist,
    };
  }
}
