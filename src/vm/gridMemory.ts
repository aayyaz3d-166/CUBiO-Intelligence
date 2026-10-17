/**
 * ONE Language & CubiO Spatial VM - Phase 2
 * Module 3: 3D Spatial Memory Grid (gridMemory.ts)
 *
 * 3D array lattice sized 7x7x7 (343 spatial memory cells).
 * Addressing: [x, y, z] where x, y, z in [0..6].
 *
 * Phase 2 Enhancements:
 * - Chebyshev distance partitioning relative to center [3, 3, 3]:
 *     r = max(|x - 3|, |y - 3|, |z - 3|) in {0, 1, 2, 3}
 *     - Shell 0 (r=0): 1 Cell (Core [3, 3, 3])
 *     - Shell 1 (r=1): 26 Cells (3^3 - 1^3 = 27 - 1 = 26)
 *     - Shell 2 (r=2): 98 Cells (5^3 - 3^3 = 125 - 27 = 98)
 *     - Shell 3 (r=3): 218 Cells (7^3 - 5^3 = 343 - 125 = 218)
 *     Total = 1 + 26 + 98 + 218 = 343 Cells.
 * - Shell-based allocation with outward overflow cascade if target shell is exhausted.
 */

export interface SpatialCoord {
  x: number;
  y: number;
  z: number;
}

export interface MemoryCell {
  coord: SpatialCoord;
  index: number;
  shellRadius: number; // Chebyshev distance r from [3,3,3]
  occupied: boolean;
  data: Uint8Array | null;
  bitDensity: number;
  entropyScore: number;
  tags: string[];
  lastAccessed: number;
  writeCount: number;
  quantizationBits?: number;
}

export class GridMemory {
  public static readonly DIM_X = 7;
  public static readonly DIM_Y = 7;
  public static readonly DIM_Z = 7;
  public static readonly TOTAL_CELLS = 7 * 7 * 7; // 343 cells
  public static readonly CENTER_COORD: SpatialCoord = { x: 3, y: 3, z: 3 };

  private cells: MemoryCell[];
  private shellIndices: number[][]; // indices mapped by shell radius [0..3]

  constructor() {
    this.cells = new Array(GridMemory.TOTAL_CELLS);
    this.shellIndices = [[], [], [], []];
    this.initializeLattice();
  }

  private initializeLattice(): void {
    let idx = 0;
    for (let z = 0; z < GridMemory.DIM_Z; z++) {
      for (let y = 0; y < GridMemory.DIM_Y; y++) {
        for (let x = 0; x < GridMemory.DIM_X; x++) {
          const coord: SpatialCoord = { x, y, z };
          const shellRadius = GridMemory.computeChebyshevRadius(coord);

          this.cells[idx] = {
            coord,
            index: idx,
            shellRadius,
            occupied: false,
            data: null,
            bitDensity: 0,
            entropyScore: 0,
            tags: [],
            lastAccessed: 0,
            writeCount: 0,
          };

          this.shellIndices[shellRadius].push(idx);
          idx++;
        }
      }
    }
  }

  /**
   * Chebyshev distance r = max(|x - 3|, |y - 3|, |z - 3|)
   */
  public static computeChebyshevRadius(coord: SpatialCoord): number {
    return Math.max(
      Math.abs(coord.x - GridMemory.CENTER_COORD.x),
      Math.abs(coord.y - GridMemory.CENTER_COORD.y),
      Math.abs(coord.z - GridMemory.CENTER_COORD.z)
    );
  }

  /**
   * Linear 1D index to [x, y, z] coordinate
   */
  public static indexToCoord(index: number): SpatialCoord {
    if (index < 0 || index >= GridMemory.TOTAL_CELLS) {
      throw new RangeError(`Index ${index} out of bounds [0..${GridMemory.TOTAL_CELLS - 1}]`);
    }
    const x = index % GridMemory.DIM_X;
    const y = Math.floor(index / GridMemory.DIM_X) % GridMemory.DIM_Y;
    const z = Math.floor(index / (GridMemory.DIM_X * GridMemory.DIM_Y));
    return { x, y, z };
  }

  /**
   * [x, y, z] coordinate to linear 1D index: x + 7*y + 49*z
   */
  public static coordToIndex(coord: SpatialCoord): number {
    GridMemory.validateCoord(coord);
    return coord.x + coord.y * GridMemory.DIM_X + coord.z * (GridMemory.DIM_X * GridMemory.DIM_Y);
  }

  /**
   * Validates coordinate bounds [0..6]
   */
  public static validateCoord(coord: SpatialCoord): void {
    if (
      coord.x < 0 ||
      coord.x >= GridMemory.DIM_X ||
      coord.y < 0 ||
      coord.y >= GridMemory.DIM_Y ||
      coord.z < 0 ||
      coord.z >= GridMemory.DIM_Z
    ) {
      throw new RangeError(
        `Coordinate [${coord.x}, ${coord.y}, ${coord.z}] is outside the 7x7x7 lattice bounds [0..6]`
      );
    }
  }

  /**
   * Get total cell count in specified Chebyshev shell radius [0..3]
   */
  public getShellCellCount(shellRadius: number): number {
    if (shellRadius < 0 || shellRadius > 3) {
      throw new RangeError(`Shell radius ${shellRadius} must be in [0..3]`);
    }
    return this.shellIndices[shellRadius].length;
  }

  /**
   * Get all cell indices in specified Chebyshev shell radius [0..3]
   */
  public getShellIndices(shellRadius: number): number[] {
    if (shellRadius < 0 || shellRadius > 3) {
      throw new RangeError(`Shell radius ${shellRadius} must be in [0..3]`);
    }
    return [...this.shellIndices[shellRadius]];
  }

  /**
   * Write data to a specific spatial cell.
   */
  public write(
    coord: SpatialCoord,
    data: Uint8Array,
    metadata: {
      bitDensity?: number;
      entropyScore?: number;
      tags?: string[];
      quantizationBits?: number;
    } = {}
  ): MemoryCell {
    const idx = GridMemory.coordToIndex(coord);
    const cell = this.cells[idx];

    cell.occupied = true;
    cell.data = new Uint8Array(data); // copy
    cell.bitDensity = metadata.bitDensity ?? 0;
    cell.entropyScore = metadata.entropyScore ?? 0;
    cell.tags = metadata.tags ? [...metadata.tags] : [];
    cell.quantizationBits = metadata.quantizationBits;
    cell.lastAccessed = Date.now();
    cell.writeCount++;

    return cell;
  }

  /**
   * Read data from a specific spatial cell.
   */
  public read(coord: SpatialCoord): MemoryCell | null {
    const idx = GridMemory.coordToIndex(coord);
    const cell = this.cells[idx];
    if (!cell.occupied) {
      return null;
    }
    cell.lastAccessed = Date.now();
    return cell;
  }

  /**
   * Clear a cell
   */
  public clear(coord: SpatialCoord): boolean {
    const idx = GridMemory.coordToIndex(coord);
    const cell = this.cells[idx];
    if (!cell.occupied) return false;

    cell.occupied = false;
    cell.data = null;
    cell.bitDensity = 0;
    cell.entropyScore = 0;
    cell.tags = [];
    cell.quantizationBits = undefined;
    return true;
  }

  /**
   * Phase 2: Shell-Based Allocation with Outward Overflow.
   * Allocates the first available cell in the requested Chebyshev shell radius [0..3].
   * If the requested shell is completely full, it cascades outward (r+1, r+2, ...)
   * or inward if outermost shell is full, ensuring safe overflow without VM crashes.
   */
  public allocateByShell(
    targetShellRadius: number,
    payload: Uint8Array,
    metadata: {
      bitDensity?: number;
      entropyScore?: number;
      tags?: string[];
      quantizationBits?: number;
    } = {}
  ): { cell: MemoryCell; targetShell: number; allocatedShell: number; overflowed: boolean } {
    const r = Math.max(0, Math.min(3, Math.floor(targetShellRadius)));

    // Order of shell search: target shell first, then outwards, then remaining inwards
    const searchOrder: number[] = [];
    for (let current = r; current <= 3; current++) {
      searchOrder.push(current);
    }
    for (let current = r - 1; current >= 0; current--) {
      searchOrder.push(current);
    }

    for (const shell of searchOrder) {
      const indices = this.shellIndices[shell];
      for (const idx of indices) {
        const candidate = this.cells[idx];
        if (!candidate.occupied) {
          const writtenCell = this.write(candidate.coord, payload, metadata);
          return {
            cell: writtenCell,
            targetShell: r,
            allocatedShell: shell,
            overflowed: shell !== r,
          };
        }
      }
    }

    throw new Error('GridMemory 3D lattice is completely full (343/343 cells occupied).');
  }

  /**
   * Spatial Broadcast: Write copies of data to all cells within Manhattan or Chebyshev distance.
   */
  public broadcast(
    center: SpatialCoord,
    radius: number,
    data: Uint8Array,
    metadata: {
      bitDensity?: number;
      entropyScore?: number;
      tags?: string[];
      quantizationBits?: number;
    } = {}
  ): number {
    GridMemory.validateCoord(center);
    let affectedCount = 0;

    for (let z = Math.max(0, center.z - radius); z <= Math.min(GridMemory.DIM_Z - 1, center.z + radius); z++) {
      for (let y = Math.max(0, center.y - radius); y <= Math.min(GridMemory.DIM_Y - 1, center.y + radius); y++) {
        for (let x = Math.max(0, center.x - radius); x <= Math.min(GridMemory.DIM_X - 1, center.x + radius); x++) {
          this.write({ x, y, z }, data, metadata);
          affectedCount++;
        }
      }
    }

    return affectedCount;
  }

  /**
   * Compact: Defragments occupied cells toward origin or inner core.
   */
  public compact(): { moved: number; occupiedTotal: number } {
    const occupiedCells = this.cells.filter((c) => c.occupied);
    const total = occupiedCells.length;
    let moved = 0;

    const oldCells = occupiedCells.map((c) => ({
      data: c.data!,
      bitDensity: c.bitDensity,
      entropyScore: c.entropyScore,
      tags: c.tags,
      quantizationBits: c.quantizationBits,
    }));

    for (const cell of this.cells) {
      cell.occupied = false;
      cell.data = null;
      cell.bitDensity = 0;
      cell.entropyScore = 0;
      cell.tags = [];
      cell.quantizationBits = undefined;
    }

    for (let i = 0; i < oldCells.length; i++) {
      const coord = GridMemory.indexToCoord(i);
      this.write(coord, oldCells[i].data, oldCells[i]);
      moved++;
    }

    return { moved, occupiedTotal: total };
  }

  /**
   * Dynamic Entropy-Aware Routing (Phase 1 legacy compatibility)
   */
  public allocateByEntropy(entropyScore: number, bitDensity: number): SpatialCoord {
    const normalizedEntropy = Math.max(0, Math.min(2.0, entropyScore)) / 2.0;
    const targetShell = Math.floor(normalizedEntropy * 3.99);
    const dummy = new Uint8Array(0);
    const result = this.allocateByShell(targetShell, dummy, { entropyScore, bitDensity });
    // clear dummy marker
    result.cell.occupied = false;
    result.cell.data = null;
    return result.cell.coord;
  }

  /**
   * Detailed shell statistics
   */
  public getShellStats() {
    return [0, 1, 2, 3].map((r) => {
      const indices = this.shellIndices[r];
      const occupied = indices.filter((idx) => this.cells[idx].occupied).length;
      return {
        shellRadius: r,
        totalCells: indices.length,
        occupiedCells: occupied,
        freeCells: indices.length - occupied,
        occupancyRatio: indices.length > 0 ? occupied / indices.length : 0,
      };
    });
  }

  /**
   * Overall lattice memory statistics
   */
  public getStats() {
    let occupied = 0;
    let totalBytes = 0;
    for (const cell of this.cells) {
      if (cell.occupied) {
        occupied++;
        totalBytes += cell.data ? cell.data.byteLength : 0;
      }
    }
    return {
      totalCells: GridMemory.TOTAL_CELLS,
      occupiedCells: occupied,
      freeCells: GridMemory.TOTAL_CELLS - occupied,
      occupancyRatio: occupied / GridMemory.TOTAL_CELLS,
      totalBytes,
      shells: this.getShellStats(),
    };
  }

  /**
   * Direct cell access
   */
  public getCell(coord: SpatialCoord): MemoryCell {
    const idx = GridMemory.coordToIndex(coord);
    return this.cells[idx];
  }
}
