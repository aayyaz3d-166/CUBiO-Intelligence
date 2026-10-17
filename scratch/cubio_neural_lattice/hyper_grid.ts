/**
 * CUBiO Hyper-Grid: N-Dimensional Tensor Space Engine (N >= 4)
 * Gate: CNL-P5-001 | Sovereign Architecture
 */

export interface HyperCoordinate {
  dimensions: number[];
  coords: number[];
  linearIndex: number;
  normalizedCoords: number[];
}

export interface HyperSliceRange {
  min: number;
  max: number;
}

export class HyperGridEngine {
  private readonly dimensions: number[];
  private readonly strides: number[];
  public readonly totalCells: number;
  public readonly rank: number; // N dimensions

  constructor(dimensions: number[]) {
    if (!dimensions || dimensions.length < 4) {
      throw new Error(`[HyperGrid Error] HyperGrid requires N >= 4 dimensions. Provided: ${dimensions ? dimensions.length : 0}`);
    }

    for (let i = 0; i < dimensions.length; i++) {
      if (!Number.isInteger(dimensions[i]) || dimensions[i] <= 0) {
        throw new Error(`[HyperGrid Error] Dimension size at axis ${i} must be a positive integer. Got ${dimensions[i]}`);
      }
    }

    this.dimensions = [...dimensions];
    this.rank = dimensions.length;

    // Calculate strides: strides[d] = product of dimensions[k] for k from d+1 to rank-1
    this.strides = new Array(this.rank);
    let currentStride = 1;
    for (let d = this.rank - 1; d >= 0; d--) {
      this.strides[d] = currentStride;
      currentStride *= this.dimensions[d];
    }
    this.totalCells = currentStride;
  }

  /**
   * Maps discrete N-dimensional tensor coordinates to a 1D linear lattice index.
   */
  public mapCoordinates(coords: number[]): HyperCoordinate {
    if (coords.length !== this.rank) {
      throw new Error(`[HyperGrid Error] Coordinate length (${coords.length}) does not match grid rank (${this.rank})`);
    }

    let linearIndex = 0;
    const normalizedCoords: number[] = new Array(this.rank);

    for (let d = 0; d < this.rank; d++) {
      const c = coords[d];
      const maxBound = this.dimensions[d];

      if (c < 0 || c >= maxBound) {
        throw new Error(`[HyperGrid Bounds Violation] Axis ${d} coordinate ${c} is outside [0, ${maxBound - 1}]`);
      }

      linearIndex += c * this.strides[d];
      normalizedCoords[d] = maxBound > 1 ? Math.round((c / (maxBound - 1)) * 1e6) / 1e6 : 0.0;
    }

    return {
      dimensions: [...this.dimensions],
      coords: [...coords],
      linearIndex,
      normalizedCoords,
    };
  }

  /**
   * Maps linear lattice index back to discrete N-dimensional coordinates.
   */
  public unmapIndex(linearIndex: number): number[] {
    if (linearIndex < 0 || linearIndex >= this.totalCells) {
      throw new Error(`[HyperGrid Error] Linear index ${linearIndex} is out of bounds [0, ${this.totalCells - 1}]`);
    }

    const coords: number[] = new Array(this.rank);
    let remainder = linearIndex;

    for (let d = 0; d < this.rank; d++) {
      coords[d] = Math.floor(remainder / this.strides[d]);
      remainder %= this.strides[d];
    }

    return coords;
  }

  /**
   * Traverses adjacent neighboring cells in N-dimensional space (Manhattan distance = 1).
   */
  public getAdjacentNeighbors(coords: number[]): number[] {
    const neighbors: number[] = [];

    for (let d = 0; d < this.rank; d++) {
      // Step backward on axis d
      if (coords[d] > 0) {
        const neighborCoords = [...coords];
        neighborCoords[d] -= 1;
        neighbors.push(this.mapCoordinates(neighborCoords).linearIndex);
      }
      // Step forward on axis d
      if (coords[d] < this.dimensions[d] - 1) {
        const neighborCoords = [...coords];
        neighborCoords[d] += 1;
        neighbors.push(this.mapCoordinates(neighborCoords).linearIndex);
      }
    }

    return neighbors;
  }

  /**
   * Slices N-dimensional tensor volume based on per-axis range filters.
   */
  public querySlice(ranges: HyperSliceRange[]): number[] {
    if (ranges.length !== this.rank) {
      throw new Error(`[HyperGrid Slice Error] Slice ranges length (${ranges.length}) does not match rank (${this.rank})`);
    }

    const matchingIndices: number[] = [];

    const recurse = (currentAxis: number, currentCoords: number[]) => {
      if (currentAxis === this.rank) {
        matchingIndices.push(this.mapCoordinates(currentCoords).linearIndex);
        return;
      }

      const minVal = Math.max(0, ranges[currentAxis].min);
      const maxVal = Math.min(this.dimensions[currentAxis] - 1, ranges[currentAxis].max);

      for (let c = minVal; c <= maxVal; c++) {
        currentCoords[currentAxis] = c;
        recurse(currentAxis + 1, currentCoords);
      }
    };

    recurse(0, new Array(this.rank));
    return matchingIndices;
  }

  public getDimensions(): number[] {
    return [...this.dimensions];
  }

  public getStrides(): number[] {
    return [...this.strides];
  }
}
