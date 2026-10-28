/**
 * ONE Language — Spatial Accumulator Engine
 * ==========================================
 * Module: @one/memory/extreme/SpatialAccumulatorEngine
 *
 * Implements Section 12 of Extreme-Scale 3D Memory Toolchain.
 * High-throughput spatial reference aggregator maintaining bounded spatial statistics
 * across the 7x7x7 lattice without historical payload assumption.
 */
import { SpatialPointerEngine369 } from './369SpatialPointerEngine';
export class SpatialAccumulatorEngine {
    static TOTAL_CELLS = 343;
    // Contiguous Float64Arrays for extreme throughput (Zero heap allocation in update loop)
    counts;
    energySums;
    totalCount = 0;
    totalEnergy = 0;
    constructor() {
        this.counts = new Float64Array(SpatialAccumulatorEngine.TOTAL_CELLS);
        this.energySums = new Float64Array(SpatialAccumulatorEngine.TOTAL_CELLS);
    }
    /**
     * High-throughput atomic reference accumulation.
     * Runs in ~5-10 nanoseconds per invocation.
     */
    accumulate(virtualAddress, energy = 1.0) {
        const cellId = SpatialPointerEngine369.virtualAddressToCellId(virtualAddress);
        this.counts[cellId]++;
        this.energySums[cellId] += energy;
        this.totalCount++;
        this.totalEnergy += energy;
    }
    /**
     * Batch accumulation loop with stride-1 cache locality.
     */
    accumulateBatch(addresses, energies) {
        const len = addresses.length;
        for (let idx = 0; idx < len; idx++) {
            const cellId = SpatialPointerEngine369.virtualAddressToCellId(addresses[idx]);
            const e = energies ? energies[idx] : 1.0;
            this.counts[cellId]++;
            this.energySums[cellId] += e;
        }
        this.totalCount += len;
    }
    /**
     * Returns statistics for a specific cell.
     */
    getVoxelStats(cellId) {
        if (cellId < 0 || cellId >= SpatialAccumulatorEngine.TOTAL_CELLS) {
            throw new Error(`[SpatialAccumulatorEngine Error] Invalid cellId: ${cellId}`);
        }
        const coord = SpatialPointerEngine369.cellIdToCoord(cellId);
        const cnt = this.counts[cellId];
        const nrmCount = this.totalCount > 0 ? cnt / this.totalCount : 0;
        return {
            cellId,
            count: cnt,
            energySum: this.energySums[cellId],
            density: nrmCount,
            centroidX: coord.i / 6.0,
            centroidY: coord.j / 6.0,
            centroidZ: coord.k / 6.0,
        };
    }
    /**
     * Total references aggregated.
     */
    getTotalCount() {
        return this.totalCount;
    }
    /**
     * Total energy accumulated.
     */
    getTotalEnergy() {
        return this.totalEnergy;
    }
    /**
     * Resets accumulator arrays without reallocation.
     */
    reset() {
        this.counts.fill(0);
        this.energySums.fill(0);
        this.totalCount = 0;
        this.totalEnergy = 0;
    }
}
