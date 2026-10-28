/**
 * CUBiO / AGI ONE — GATE CNL-P26.4
 * CELL INSPECTOR SUBSYSTEM
 *
 * File: f:\ONE language\src\studio\cell_inspector.ts
 * Module: @one/studio/cell-inspector
 * Specification: Gate CNL-P26.4 Section 6 & 13
 *
 * Dedicated Cell Inspector exposing all 12 mandated mathematical & spatial fields:
 *   1. Cell ID (0..342)
 *   2. Display Index (1..343)
 *   3. Address369 (26..368)
 *   4. Coordinates (i, j, k)
 *   5. Quantum Probability (0.0 <= p <= 1.0)
 *   6. Intent Resonance (0.0 <= r <= 1.0)
 *   7. Canonical Phase ([-PI, PI) rad)
 *   8. Complex Wave State (real, imag, amplitude)
 *   9. Snapshot Epoch
 *  10. Canonical Hash (SHA-256)
 *  11. Evidence Class ('SIMULATED')
 *  12. Simulation Status ('COMPUTED')
 *
 * TELEMETRY TRUTH LOCK:
 * Any missing, uninstrumented, or undefined value MUST strictly display '—' or 'UNAVAILABLE'.
 * NEVER fabricate or invent unmeasured quantities.
 */

import { QuantumCellState, LatticeSnapshot, ComplexMath } from '../core/spatial_quantum_mapper';
import { ValidatedRenderFrame } from './native_state_bridge';

export interface CellInspectionDetails {
  readonly cellId: number | string;
  readonly displayIndex: number | string;
  readonly address369: number | string;
  readonly coordinates: readonly [number, number, number] | string;
  readonly probability: number | string;
  readonly intentResonance: number | string;
  readonly canonicalPhase: number | string;
  readonly complexWaveState: {
    readonly real: number | string;
    readonly imag: number | string;
    readonly amplitude: number | string;
  } | string;
  readonly epoch: number | string;
  readonly canonicalHash: string;
  readonly evidenceClass: string;
  readonly simulationStatus: string;
  readonly isCenterOriginNode: boolean;
  readonly isAvailable: boolean;
}

export class CellInspector {
  public static readonly CENTER_NODE_ID: number = 171;
  public static readonly CENTER_NODE_ADDRESS369: number = 197; // 26 + 171
  private activeCellId: number = 171; // Default to Center Origin Node (3, 3, 3)

  constructor(initialCellId: number = 171) {
    if (initialCellId >= 0 && initialCellId <= 342) {
      this.activeCellId = initialCellId;
    }
  }

  public setActiveCell(cellId: number): void {
    if (cellId < 0 || cellId > 342 || !Number.isInteger(cellId)) {
      throw new Error(`[CellInspector] Invalid cellId: ${cellId}. Must be integer in 0..342`);
    }
    this.activeCellId = cellId;
  }

  public getActiveCell(): number {
    return this.activeCellId;
  }

  /**
   * Inspects a cell from the current ValidatedRenderFrame.
   * If frame is null or cell is missing, returns honest UNAVAILABLE / '—' values.
   */
  public inspectCell(frame: ValidatedRenderFrame | null, cellId?: number): CellInspectionDetails {
    const targetId = cellId !== undefined ? cellId : this.activeCellId;

    if (targetId < 0 || targetId > 342 || !Number.isInteger(targetId)) {
      return this.createUnavailableInspection(targetId);
    }

    if (!frame || !frame.snapshot || !frame.snapshot.lattice_state_matrix) {
      return this.createUnavailableInspection(targetId);
    }

    const snapshot = frame.snapshot;
    const matrix = snapshot.lattice_state_matrix;
    const cell: QuantumCellState | undefined = matrix[targetId];

    if (!cell) {
      return this.createUnavailableInspection(targetId);
    }

    const isCenter = cell.cell_id === 171;
    const amplitude = cell.amplitude !== undefined
      ? cell.amplitude
      : ComplexMath.magnitude(cell.wave_state);

    return {
      cellId: cell.cell_id,
      displayIndex: cell.display_index,
      address369: cell.address369,
      coordinates: [cell.i, cell.j, cell.k],
      probability: cell.probability,
      intentResonance: cell.resonance,
      canonicalPhase: cell.phase,
      complexWaveState: {
        real: cell.wave_state.real,
        imag: cell.wave_state.imag,
        amplitude: amplitude
      },
      epoch: frame.stateEpoch,
      canonicalHash: frame.canonicalHash || snapshot.canonical_hash || '—',
      evidenceClass: snapshot.evidence_class || 'SIMULATED',
      simulationStatus: snapshot.simulation_status || 'COMPUTED',
      isCenterOriginNode: isCenter,
      isAvailable: true
    };
  }

  private createUnavailableInspection(targetId: number): CellInspectionDetails {
    return {
      cellId: targetId >= 0 && targetId <= 342 ? targetId : '—',
      displayIndex: targetId >= 0 && targetId <= 342 ? targetId + 1 : '—',
      address369: targetId >= 0 && targetId <= 342 ? 26 + targetId : '—',
      coordinates: '—',
      probability: '—',
      intentResonance: '—',
      canonicalPhase: '—',
      complexWaveState: '—',
      epoch: '—',
      canonicalHash: '—',
      evidenceClass: 'UNAVAILABLE',
      simulationStatus: 'UNAVAILABLE',
      isCenterOriginNode: targetId === 171,
      isAvailable: false
    };
  }

  /**
   * Formats the 12 fields into a structured multi-line report.
   */
  public formatInspectionDetails(details: CellInspectionDetails): string {
    const lines: string[] = [];

    const coordStr = Array.isArray(details.coordinates)
      ? `(${details.coordinates[0]}, ${details.coordinates[1]}, ${details.coordinates[2]})`
      : '—';

    const probStr = typeof details.probability === 'number'
      ? details.probability.toFixed(6)
      : String(details.probability);

    const resStr = typeof details.intentResonance === 'number'
      ? details.intentResonance.toFixed(6)
      : String(details.intentResonance);

    const phaseStr = typeof details.canonicalPhase === 'number'
      ? `${details.canonicalPhase.toFixed(6)} rad`
      : String(details.canonicalPhase);

    let waveStr = '—';
    if (typeof details.complexWaveState === 'object' && details.complexWaveState !== null) {
      const w = details.complexWaveState;
      const r = typeof w.real === 'number' ? w.real.toFixed(4) : w.real;
      const im = typeof w.imag === 'number' ? w.imag.toFixed(4) : w.imag;
      const amp = typeof w.amplitude === 'number' ? w.amplitude.toFixed(4) : w.amplitude;
      waveStr = `${r} + ${im}i (amp: ${amp})`;
    }

    const centerTag = details.isCenterOriginNode ? ' [CENTER ORIGIN NODE]' : '';

    lines.push(`--------------------------------------------------------------------------------`);
    lines.push(`  CELL INSPECTOR — NODE ${details.cellId}${centerTag}`);
    lines.push(`--------------------------------------------------------------------------------`);
    lines.push(`  1.  Cell ID:           ${details.cellId}`);
    lines.push(`  2.  Display Index:     ${details.displayIndex} (Range: 1..343)`);
    lines.push(`  3.  Address369:        ${details.address369} (Range: 26..368)`);
    lines.push(`  4.  Coordinates:       ${coordStr} (i, j, k in 0..6)`);
    lines.push(`  5.  Probability:       ${probStr} (0.0 <= p <= 1.0)`);
    lines.push(`  6.  Intent Resonance:  ${resStr} (0.0 <= r <= 1.0)`);
    lines.push(`  7.  Canonical Phase:   ${phaseStr} ([-PI, PI) rad)`);
    lines.push(`  8.  Complex Wave State:${waveStr}`);
    lines.push(`  9.  Snapshot Epoch:    ${details.epoch}`);
    lines.push(`  10. Canonical Hash:    ${details.canonicalHash}`);
    lines.push(`  11. Evidence Class:    ${details.evidenceClass}`);
    lines.push(`  12. Simulation Status: ${details.simulationStatus}`);
    lines.push(`--------------------------------------------------------------------------------`);

    return lines.join('\n');
  }

  /**
   * Formats a single-line horizontal inspector bar for HUD/footer display.
   */
  public formatInspectorBar(details: CellInspectionDetails): string {
    const coordStr = Array.isArray(details.coordinates)
      ? `(${details.coordinates[0]},${details.coordinates[1]},${details.coordinates[2]})`
      : '—';
    const probStr = typeof details.probability === 'number'
      ? details.probability.toFixed(4)
      : String(details.probability);
    const resStr = typeof details.intentResonance === 'number'
      ? details.intentResonance.toFixed(4)
      : String(details.intentResonance);
    const centerTag = details.isCenterOriginNode ? ' ★' : '';

    return `CELL: ${details.cellId}${centerTag} | ADDR: ${details.address369} | POS: ${coordStr} | PROB: ${probStr} | RES: ${resStr} | STATUS: ${details.simulationStatus}`;
  }
}
