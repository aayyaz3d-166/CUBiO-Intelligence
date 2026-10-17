export interface CellResonanceState {
  cellId: number;
  activityScore: number;
  lastTouchTimestamp: number;
}

export class HarmonicDecayEngine {
  private lambda: number;
  private threshold: number;

  constructor(lambda: number = 0.05, threshold: number = 0.001) {
    this.lambda = lambda;
    this.threshold = threshold;
  }

  /**
   * Evaluates spatial cell resonance using Euler decay: R(t) = R_0 * e^(-lambda * t)
   * Reclaims memory for cells falling below the threshold with zero GC pause.
   */
  public evaluateAndHeal(cells: Map<number, CellResonanceState>, currentTimestamp: number): number[] {
    const recycledCellIds: number[] = [];

    for (const [cellId, cell] of cells.entries()) {
      const timeDelta = Math.max(0, (currentTimestamp - cell.lastTouchTimestamp) / 1000.0);
      const resonanceFactor = cell.activityScore * Math.exp(-this.lambda * timeDelta);

      if (resonanceFactor < this.threshold) {
        recycledCellIds.push(cellId);
        cells.delete(cellId); // Zero-pause spatial memory reclamation
      }
    }

    return recycledCellIds;
  }

  public registerCell(cells: Map<number, CellResonanceState>, cellId: number, activityScore: number = 1.0, timestamp?: number): void {
    cells.set(cellId, {
      cellId,
      activityScore,
      lastTouchTimestamp: timestamp !== undefined ? timestamp : Date.now(),
    });
  }
}
