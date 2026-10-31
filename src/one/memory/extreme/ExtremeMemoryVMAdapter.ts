/**
 * ONE Language — Extreme Memory VM Adapter
 * =========================================
 * Module: @one/memory/extreme/ExtremeMemoryVMAdapter
 * Specification: Task 17 — Extreme Memory, Virtual Paging & Context Reconstruction
 *
 * Bridges the UnifiedVM runtime with the 24-capability UnifiedExtremeMemoryToolchain:
 *   - Virtual Memory Paging (64 KB pages, demand-paging, LRU working set)
 *   - Lossless Context Reconstruction with SHA-256 verification
 *   - Dormant Call Frame Virtualization for deep recursion memory pressure relief
 *   - Fail-closed corruption firewall (VirtualMemoryIntegrityEngine)
 *   - Hard memory ceilings (BoundedWorkingSetManager RSS <= 512 MB)
 *   - Permanent Actuation Lockout (isActuationBlocked === true)
 */

import * as crypto from 'crypto';
import { UnifiedVM, VMValue } from '../../vm/UnifiedVM';
import { UnifiedExtremeMemoryToolchain } from './UnifiedExtremeMemoryToolchain';
import { VirtualMemoryPagingEngine, PagingEngineMetrics } from './VirtualMemoryPagingEngine';
import { LosslessReconstructionEngine, LosslessPipelineResult } from './LosslessReconstructionEngine';
import { VirtualMemoryIntegrityEngine, IntegrityViolationError } from './VirtualMemoryIntegrityEngine';
import { BoundedWorkingSetManager, WorkingSetPressureReport } from './BoundedWorkingSetManager';

export interface VMSnapshotRecord {
  readonly snapshotId: string;
  readonly virtualAddressHex: string;
  readonly byteLength: number;
  readonly sha256Checksum: string;
  readonly createdAtMs: number;
  readonly globalsCount: number;
  readonly callDepth: number;
}

export interface VMRestoreResult {
  readonly snapshotId: string;
  readonly restoredGlobals: Record<string, VMValue>;
  readonly restoredCallDepth: number;
  readonly isLosslessVerified: boolean;
  readonly latencyMs: number;
}

export interface VirtualizedStackResult {
  readonly virtualAddressHex: string;
  readonly pagedFramesCount: number;
  readonly activeFramesCount: number;
  readonly byteLength: number;
  readonly sha256Checksum: string;
}

export interface ExtremeVMMemoryMetrics {
  readonly pagingMetrics: PagingEngineMetrics;
  readonly workingSetReport: WorkingSetPressureReport;
  readonly isActuationBlocked: boolean;
  readonly snapshotsStored: number;
}

export class ExtremeMemoryVMAdapter {
  public static readonly SNAPSHOT_MAGIC = 'VMCP'; // VM Checkpoint
  public static readonly SNAPSHOT_VERSION = '1.0.0';
  public static readonly BASE_VIRTUAL_ADDR = 0x100000000000n; // 16 TB base virtual offset

  public readonly isActuationBlocked: boolean = true;
  private readonly toolchain: UnifiedExtremeMemoryToolchain;
  private readonly snapshotIndex: Map<string, { vAddr: bigint; length: number; sha256: string }> = new Map();
  private nextSnapshotOffset: bigint = 0n;

  constructor(toolchain?: UnifiedExtremeMemoryToolchain) {
    this.toolchain = toolchain ?? new UnifiedExtremeMemoryToolchain();
  }

  /**
   * Captures the state of a UnifiedVM into a deterministic virtual memory snapshot.
   */
  public captureVMSnapshot(vm: UnifiedVM, snapshotId?: string, timestamp?: number): VMSnapshotRecord {
    const id = snapshotId ?? `snap_vm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ts = timestamp ?? Date.now();
    const globals = vm.getGlobals();
    const callDepth = vm.getCallDepth();
    const stackTrace = vm.getStackTrace();

    // 1. Serialize VM state into structured JSON string
    const snapshotPayload = {
      magic: ExtremeMemoryVMAdapter.SNAPSHOT_MAGIC,
      version: ExtremeMemoryVMAdapter.SNAPSHOT_VERSION,
      snapshotId: id,
      timestamp: ts,
      callDepth,
      stackTrace,
      globals: Object.fromEntries(globals),
    };

    const jsonText = JSON.stringify(snapshotPayload);
    const byteBuffer = Buffer.from(jsonText, 'utf-8');
    const sha256Checksum = crypto.createHash('sha256').update(byteBuffer).digest('hex');

    // 2. Allocate virtual address and page into VirtualMemoryPagingEngine
    const vAddr = ExtremeMemoryVMAdapter.BASE_VIRTUAL_ADDR + this.nextSnapshotOffset;
    // Align next offset to 64 KB page boundary
    const pageSize = BigInt(this.toolchain.pagingEngine.getMetrics().pageSizeBytes);
    const pagesNeeded = (BigInt(byteBuffer.length) + pageSize - 1n) / pageSize;
    this.nextSnapshotOffset += pagesNeeded * pageSize;

    this.toolchain.pagingEngine.writeVirtual(vAddr, byteBuffer);

    // 3. Register in index
    this.snapshotIndex.set(id, {
      vAddr,
      length: byteBuffer.length,
      sha256: sha256Checksum,
    });

    return {
      snapshotId: id,
      virtualAddressHex: `0x${vAddr.toString(16)}`,
      byteLength: byteBuffer.length,
      sha256Checksum,
      createdAtMs: snapshotPayload.timestamp,
      globalsCount: globals.size,
      callDepth,
    };
  }

  /**
   * Restores a VM state from a virtual memory snapshot with bit-exact SHA-256 verification.
   */
  public restoreVMSnapshot(snapshotId: string): VMRestoreResult {
    const t0 = performance.now();
    const meta = this.snapshotIndex.get(snapshotId);
    if (!meta) {
      throw new Error(`[ExtremeMemoryVMAdapter] Snapshot not found: ${snapshotId}`);
    }

    // 1. Read payload from virtual pages
    const rawBytes = this.toolchain.pagingEngine.readVirtual(meta.vAddr, meta.length);

    // 2. Fail-closed Checksum Validation
    VirtualMemoryIntegrityEngine.validateChecksum(rawBytes, meta.sha256);

    // 3. Parse JSON & Validate Header
    const jsonText = Buffer.from(rawBytes).toString('utf-8');
    const payload = JSON.parse(jsonText);

    if (payload.magic !== ExtremeMemoryVMAdapter.SNAPSHOT_MAGIC) {
      throw new IntegrityViolationError('INVALID_MAGIC', `Invalid snapshot magic: ${payload.magic}`);
    }

    const reconstructedSha = crypto.createHash('sha256').update(rawBytes).digest('hex');
    const isLossless = reconstructedSha === meta.sha256;

    return {
      snapshotId,
      restoredGlobals: payload.globals ?? {},
      restoredCallDepth: payload.callDepth ?? 0,
      isLosslessVerified: isLossless,
      latencyMs: performance.now() - t0,
    };
  }

  /**
   * Verifies the complete lossless reconstruction pipeline for a snapshot.
   */
  public verifyLosslessPipeline(snapshotId: string): LosslessPipelineResult {
    const meta = this.snapshotIndex.get(snapshotId);
    if (!meta) {
      throw new Error(`[ExtremeMemoryVMAdapter] Snapshot not found: ${snapshotId}`);
    }
    const rawBytes = this.toolchain.pagingEngine.readVirtual(meta.vAddr, meta.length);
    return this.toolchain.losslessReconstruction.verifyLosslessPipeline(rawBytes, snapshotId);
  }

  /**
   * Virtualizes dormant call frames into virtual memory when recursion exceeds active threshold.
   * Dormant frames below activeWindowSize are serialized to 64 KB pages and purged from the hot array.
   */
  public virtualizeDormantFrames(callStack: any[], activeWindowSize: number = 10): VirtualizedStackResult {
    if (callStack.length <= activeWindowSize) {
      return {
        virtualAddressHex: '0x0',
        pagedFramesCount: 0,
        activeFramesCount: callStack.length,
        byteLength: 0,
        sha256Checksum: '',
      };
    }

    const dormantCount = callStack.length - activeWindowSize;
    const dormantFrames = callStack.splice(0, dormantCount);

    const serialized = JSON.stringify(dormantFrames);
    const bytes = Buffer.from(serialized, 'utf-8');
    const sha256Checksum = crypto.createHash('sha256').update(bytes).digest('hex');

    const vAddr = ExtremeMemoryVMAdapter.BASE_VIRTUAL_ADDR + this.nextSnapshotOffset;
    const pageSize = BigInt(this.toolchain.pagingEngine.getMetrics().pageSizeBytes);
    const pagesNeeded = (BigInt(bytes.length) + pageSize - 1n) / pageSize;
    this.nextSnapshotOffset += pagesNeeded * pageSize;

    this.toolchain.pagingEngine.writeVirtual(vAddr, bytes);

    return {
      virtualAddressHex: `0x${vAddr.toString(16)}`,
      pagedFramesCount: dormantCount,
      activeFramesCount: callStack.length,
      byteLength: bytes.length,
      sha256Checksum,
    };
  }

  /**
   * Reconstructs paged dormant call frames back into the call stack.
   */
  public reconstructDormantFrames(virtualAddressHex: string, byteLength: number, expectedChecksum: string): any[] {
    const vAddr = BigInt(virtualAddressHex);
    const rawBytes = this.toolchain.pagingEngine.readVirtual(vAddr, byteLength);

    VirtualMemoryIntegrityEngine.validateChecksum(rawBytes, expectedChecksum);

    const json = Buffer.from(rawBytes).toString('utf-8');
    return JSON.parse(json);
  }

  /**
   * Collects complete memory and working-set telemetry.
   */
  public getMemoryTelemetry(): ExtremeVMMemoryMetrics {
    return {
      pagingMetrics: this.toolchain.pagingEngine.getMetrics(),
      workingSetReport: this.toolchain.workingSetManager.checkAndEnforcePressure(),
      isActuationBlocked: this.isActuationBlocked,
      snapshotsStored: this.snapshotIndex.size,
    };
  }
}
