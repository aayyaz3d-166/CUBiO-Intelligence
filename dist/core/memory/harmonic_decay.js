export class HarmonicDecayEngine {
    lambda;
    threshold;
    constructor(lambda = 0.05, threshold = 0.001) {
        this.lambda = lambda;
        this.threshold = threshold;
    }
    /**
     * Evaluates spatial cell resonance using Euler decay: R(t) = R_0 * e^(-lambda * t)
     * Reclaims memory for cells falling below the threshold with zero GC pause.
     */
    evaluateAndHeal(cells, currentTimestamp) {
        const recycledCellIds = [];
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
    registerCell(cells, cellId, activityScore = 1.0, timestamp) {
        cells.set(cellId, {
            cellId,
            activityScore,
            lastTouchTimestamp: timestamp !== undefined ? timestamp : Date.now(),
        });
    }
}
