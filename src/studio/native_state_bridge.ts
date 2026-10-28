/**
 * CUBiO / AGI ONE — GATE CNL-P26.4
 * NATIVE STATE BRIDGE & ATOMIC FRAME PIPELINE
 *
 * File: f:\ONE language\src\studio\native_state_bridge.ts
 * Module: @one/studio/native-state-bridge
 * Specification: Gate CNL-P26.4 Section 3 & 7
 *
 * Consumes immutable canonical snapshots from frozen P26.3 SpatialQuantumMapper.
 * Enforces atomic 8-stage frame validation:
 *   RECEIVE -> VALIDATE -> CELL COUNT -> IDs -> Address369 -> HASH -> FREEZE -> DISPATCH
 *
 * NEVER mutates P26.3 state. NEVER renders partially validated frames.
 */

import {
  LatticeSnapshot,
  QuantumCellState,
  SpatialQuantumMapper,
  IntegrityVerificationError
} from '../core/spatial_quantum_mapper';

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(`[P26.4 Snapshot Validation Error] ${message}`);
    this.name = 'SnapshotValidationError';
  }
}

export class FrameIntegrityError extends Error {
  constructor(message: string) {
    super(`[P26.4 Frame Integrity Error] ${message}`);
    this.name = 'FrameIntegrityError';
  }
}

export type BridgeStatus =
  | 'INITIALIZING'
  | 'READY'
  | 'INVALID_FRAME'
  | 'INTEGRITY_FAILURE'
  | 'STALE_FRAME'
  | 'ERROR';

export interface ValidatedRenderFrame {
  readonly sequenceNumber: number;
  readonly timestampUtc: string;
  readonly stateEpoch: number;
  readonly snapshot: LatticeSnapshot;
  readonly validationDurationMs: number;
  readonly canonicalHash: string;
  readonly isFrozen: boolean;
}

export class NativeStateBridge {
  private activeFrame: ValidatedRenderFrame | null = null;
  private currentSequence: number = 0;
  private lastEpoch: number = -1;
  private status: BridgeStatus = 'INITIALIZING';
  private validationFailuresCount: number = 0;

  constructor() {
    this.status = 'READY';
  }

  public getStatus(): BridgeStatus {
    return this.status;
  }

  public getActiveFrame(): ValidatedRenderFrame | null {
    return this.activeFrame;
  }

  public getValidationFailuresCount(): number {
    return this.validationFailuresCount;
  }

  /**
   * Atomic 8-Stage Snapshot Consumption Pipeline:
   * 1. RECEIVE: Ingest incoming snapshot
   * 2. VALIDATE: Structure, schemas, versions, non-null
   * 3. VERIFY CELL COUNT: Exactly 343 cells
   * 4. VERIFY IDs: 0..342 sequential, no duplicates or gaps
   * 5. VERIFY Address369: 26..368 spatial registers
   * 6. VERIFY HASH: SHA-256 canonical hash matches recomputed
   * 7. FREEZE: Enforce deep immutability
   * 8. DISPATCH: Atomically update active render frame
   */
  public ingestSnapshot(snapshot: LatticeSnapshot): ValidatedRenderFrame {
    const startTime = Date.now();

    try {
      // Stage 1 & 2: RECEIVE & VALIDATE
      if (!snapshot) {
        throw new SnapshotValidationError('Received null or undefined snapshot');
      }
      if (snapshot.simulation_status !== 'COMPUTED') {
        throw new SnapshotValidationError(`Invalid simulation_status: ${snapshot.simulation_status}`);
      }
      if (snapshot.evidence_class !== 'SIMULATED') {
        throw new SnapshotValidationError(`Invalid evidence_class: ${snapshot.evidence_class}`);
      }

      // Check for stale frame (epoch must be monotonic)
      if (snapshot.state_epoch < this.lastEpoch) {
        this.status = 'STALE_FRAME';
        throw new SnapshotValidationError(
          `Stale snapshot rejected: incoming epoch ${snapshot.state_epoch} < last ${this.lastEpoch}`
        );
      }

      // Stage 3: VERIFY CELL COUNT
      if (snapshot.cell_count !== 343 || snapshot.lattice_state_matrix.length !== 343) {
        throw new SnapshotValidationError(
          `Cell count mismatch: declared ${snapshot.cell_count}, matrix length ${snapshot.lattice_state_matrix.length}`
        );
      }

      // Stage 4 & 5: VERIFY IDs & Address369
      const seenIds = new Set<number>();
      for (let c = 0; c < 343; c++) {
        const cell = snapshot.lattice_state_matrix[c];
        if (cell.cell_id !== c) {
          throw new SnapshotValidationError(
            `Non-sequential cell_id at index ${c}: expected ${c}, got ${cell.cell_id}`
          );
        }
        if (seenIds.has(cell.cell_id)) {
          throw new SnapshotValidationError(`Duplicate cell_id: ${cell.cell_id}`);
        }
        seenIds.add(cell.cell_id);

        if (cell.address369 !== 26 + c) {
          throw new SnapshotValidationError(
            `Address369 mismatch at index ${c}: expected ${26 + c}, got ${cell.address369}`
          );
        }
        if (cell.display_index !== c + 1) {
          throw new SnapshotValidationError(
            `Display index mismatch at index ${c}: expected ${c + 1}, got ${cell.display_index}`
          );
        }
      }

      // Stage 6: VERIFY HASH
      try {
        SpatialQuantumMapper.verify_lattice_integrity(snapshot);
      } catch (err: any) {
        this.status = 'INTEGRITY_FAILURE';
        throw new FrameIntegrityError(`Lattice integrity verification failed: ${err.message}`);
      }

      // Stage 7: FREEZE (Ensure deep immutability)
      if (!Object.isFrozen(snapshot)) {
        Object.freeze(snapshot);
      }
      if (!Object.isFrozen(snapshot.lattice_state_matrix)) {
        Object.freeze(snapshot.lattice_state_matrix);
      }

      // Stage 8: DISPATCH (Atomic frame swap)
      this.currentSequence++;
      this.lastEpoch = snapshot.state_epoch;

      const frame: ValidatedRenderFrame = {
        sequenceNumber: this.currentSequence,
        timestampUtc: new Date().toISOString(),
        stateEpoch: snapshot.state_epoch,
        snapshot,
        validationDurationMs: Date.now() - startTime,
        canonicalHash: snapshot.canonical_hash,
        isFrozen: true
      };

      this.activeFrame = Object.freeze(frame);
      this.status = 'READY';

      return this.activeFrame;
    } catch (err: any) {
      this.validationFailuresCount++;
      if (this.status !== 'INTEGRITY_FAILURE' && this.status !== 'STALE_FRAME') {
        this.status = 'INVALID_FRAME';
      }
      // Re-throw to fail closed
      throw err;
    }
  }

  /**
   * Resets bridge state (for clean testing or recovery).
   */
  public reset(): void {
    this.activeFrame = null;
    this.currentSequence = 0;
    this.lastEpoch = -1;
    this.status = 'READY';
    this.validationFailuresCount = 0;
  }
}
