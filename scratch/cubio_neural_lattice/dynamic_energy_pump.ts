/**
 * CUBiO Dynamic Energy Pump — Sovereign Memory RSS & Energy Flux Regulator
 * Gate: CNL-P28-001 | Sovereign Architecture ("one-heart")
 *
 * Models the human heart's dynamic output regulation:
 * — Cardiac output adapts stroke volume and heart rate to metabolic demand.
 * — Our pump dynamically allocates/reclaims memory RSS and energy "flux" quanta
 *   based on real-time task demand, ensuring strict <512 MB ceiling at all times,
 *   while maximizing throughput during peak cognitive or sensor load.
 */

import { PQCLatticeSealEngine } from '../../src/core/crypto/pqc_lattice_seal';
import { HeartRhythmMode, HARMONIC_FREQ_MAP } from './heart_engine_core';

// ── Pump Configuration Constants ─────────────────────────────────────────────
const RSS_CEILING_MB:    number = 512.0;
const RSS_FLOOR_MB:      number = 48.0;      // Minimum idle footprint
const ENERGY_QUANTUM_MB: number = 8.0;       // Smallest allocatable memory chunk
const GOLDEN_RATIO:      number = 1.6180339887;
const HARMONIC_DAMPING:  number = 0.369;     // 3-6-9 resonance damping coefficient

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface EnergyFluxDemand {
  demandId: string;
  taskType: 'SENSOR_FUSION' | 'LTM_RECALL' | 'INFERENCE' | 'PQC_SIGNING' | 'SWARM_SYNC' | 'IDLE';
  requestedRssQuanta: number;    // How many 8 MB quanta the task requests
  priorityLevel: 1 | 2 | 3;     // 1 = critical, 2 = normal, 3 = background
  timestamp: number;
}

export interface PumpAllocationReceipt {
  receiptId: string;
  demandId: string;
  allocatedRssMb: number;        // Actual MB allocated (may be throttled)
  energyFluxWatts: number;       // Simulated watt-equivalent energy flux
  isThrottled: boolean;          // True if demand was partially capped
  cappedBy: string;              // Reason for cap (ceiling / floor / harmonic)
  pqcReceiptSeal: string;
}

export interface PumpCycleReport {
  gate: string;
  cycleId: number;
  currentRssUsedMb: number;
  peakRssUsedMb: number;
  rssHeadroomMb: number;
  totalAllocations: number;
  totalThrottledAllocations: number;
  harmonicPumpFrequency: 3 | 6 | 9;
  energyFluxWattsTotal: number;
  isWithinCeiling: boolean;
  pqcPumpSeal: string;
}

// ── Task energy profiles (base quanta per task type) ────────────────────────
const TASK_BASE_QUANTA: Record<EnergyFluxDemand['taskType'], number> = {
  IDLE:          1,   //  8 MB
  LTM_RECALL:    2,   // 16 MB
  PQC_SIGNING:   3,   // 24 MB
  SWARM_SYNC:    4,   // 32 MB
  SENSOR_FUSION: 6,   // 48 MB
  INFERENCE:     8,   // 64 MB
};

export class DynamicEnergyPump {
  private currentRssMb: number = RSS_FLOOR_MB;
  private peakRssMb: number = RSS_FLOOR_MB;
  private readonly allocationHistory: PumpAllocationReceipt[] = [];
  private totalAllocations: number = 0;
  private totalThrottled: number = 0;
  private energyFluxTotal: number = 0;
  private currentMode: HeartRhythmMode = 'RESTING';
  private cycleCounter: number = 0;

  constructor() {}

  /**
   * Sets the current autonomic mode (received from heart engine / reflex bridge).
   * Adjusts pump capacity curve accordingly — higher freq = wider pump band.
   */
  public setAutonomicMode(mode: HeartRhythmMode): void {
    this.currentMode = mode;
  }

  /**
   * Dynamically allocates memory RSS quanta based on task demand, respecting harmonic curve.
   * Analogous to the Frank-Starling cardiac output law: greater venous return → greater stroke.
   */
  public allocateEnergyFlux(demand: EnergyFluxDemand): PumpAllocationReceipt {
    const freqMhz = HARMONIC_FREQ_MAP[this.currentMode];
    // Harmonic scaling factor: 3 MHz → conservative; 9 MHz → aggressive allocation
    const harmonicScale = (freqMhz / 9.0) * GOLDEN_RATIO;

    // Base quanta override with demand's request (clamp to task profile baseline)
    const baseQuanta = Math.max(demand.requestedRssQuanta, TASK_BASE_QUANTA[demand.taskType]);
    let requestedMb = baseQuanta * ENERGY_QUANTUM_MB * harmonicScale;

    // Apply harmonic damping for background priority tasks
    if (demand.priorityLevel === 3) {
      requestedMb *= HARMONIC_DAMPING;
    }

    // Ceiling enforcement: never exceed 512 MB
    const projectedRss = this.currentRssMb + requestedMb;
    let allocatedMb = requestedMb;
    let isThrottled = false;
    let cappedBy = 'NONE';

    if (projectedRss > RSS_CEILING_MB) {
      // Cap to whatever headroom remains (minimum floor guaranteed)
      allocatedMb = Math.max(0, RSS_CEILING_MB - this.currentRssMb);
      isThrottled = true;
      cappedBy = 'RSS_512MB_CEILING';
    }

    // Floor enforcement: always maintain minimum idle baseline
    if (this.currentRssMb < RSS_FLOOR_MB) {
      this.currentRssMb = RSS_FLOOR_MB;
    }

    this.currentRssMb = Math.min(RSS_CEILING_MB, this.currentRssMb + allocatedMb);
    if (this.currentRssMb > this.peakRssMb) this.peakRssMb = this.currentRssMb;

    // Simulated energy flux (watts) — proportional to freq and allocated footprint
    const energyFluxWatts = Number((allocatedMb * freqMhz * 0.0012 * HARMONIC_DAMPING).toFixed(6));
    this.energyFluxTotal += energyFluxWatts;
    this.totalAllocations++;
    if (isThrottled) this.totalThrottled++;

    // PQC-seal the allocation receipt
    const receiptPayload = `ALLOC:${demand.demandId}|MB:${allocatedMb.toFixed(4)}|WATTS:${energyFluxWatts}|THROTTLE:${isThrottled}`;
    const pqcReceiptSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(receiptPayload, 'utf-8'));

    const receipt: PumpAllocationReceipt = {
      receiptId: `PUMP_RECEIPT_${String(this.totalAllocations).padStart(5, '0')}`,
      demandId: demand.demandId,
      allocatedRssMb: Number(allocatedMb.toFixed(4)),
      energyFluxWatts,
      isThrottled,
      cappedBy,
      pqcReceiptSeal,
    };

    this.allocationHistory.push(receipt);
    return receipt;
  }

  /**
   * Reclaims memory after task completion — models ventricular relaxation / diastole.
   */
  public reclaimEnergyFlux(reclaimMb: number): void {
    this.currentRssMb = Math.max(RSS_FLOOR_MB, this.currentRssMb - reclaimMb);
  }

  /**
   * Runs a full pump cycle: emits allocations for a standard mixed workload
   * and returns a comprehensive gate certification report.
   */
  public runPumpCycle(demands: EnergyFluxDemand[]): PumpCycleReport {
    this.cycleCounter++;

    for (const d of demands) {
      this.allocateEnergyFlux(d);
    }

    const freqMhz = HARMONIC_FREQ_MAP[this.currentMode];
    const isWithinCeiling = this.currentRssMb <= RSS_CEILING_MB;

    const pumpPayload = JSON.stringify({
      gate: 'CNL-P28-001',
      cycleId: this.cycleCounter,
      rss: this.currentRssMb,
      peakRss: this.peakRssMb,
      totalAlloc: this.totalAllocations,
      throttled: this.totalThrottled,
      freqMhz,
      fluxTotal: this.energyFluxTotal,
      withinCeiling: isWithinCeiling,
    });
    const pqcPumpSeal = PQCLatticeSealEngine.generatePQCSeal(Buffer.from(pumpPayload, 'utf-8'));

    return {
      gate: 'CNL-P28-001',
      cycleId: this.cycleCounter,
      currentRssUsedMb: Number(this.currentRssMb.toFixed(4)),
      peakRssUsedMb: Number(this.peakRssMb.toFixed(4)),
      rssHeadroomMb: Number((RSS_CEILING_MB - this.currentRssMb).toFixed(4)),
      totalAllocations: this.totalAllocations,
      totalThrottledAllocations: this.totalThrottled,
      harmonicPumpFrequency: freqMhz,
      energyFluxWattsTotal: Number(this.energyFluxTotal.toFixed(6)),
      isWithinCeiling,
      pqcPumpSeal,
    };
  }

  // Accessors
  public getCurrentRssMb(): number { return this.currentRssMb; }
  public getPeakRssMb(): number { return this.peakRssMb; }
  public getTotalAllocations(): number { return this.totalAllocations; }
  public getAllocationHistory(): PumpAllocationReceipt[] { return this.allocationHistory; }
}
