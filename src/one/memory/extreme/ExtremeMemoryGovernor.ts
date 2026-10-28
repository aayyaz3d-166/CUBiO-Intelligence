/**
 * ONE Language — Extreme Memory Governor
 * =======================================
 * Module: @one/memory/extreme/ExtremeMemoryGovernor
 *
 * Implements Section 23 of Extreme-Scale 3D Memory Toolchain.
 * Sovereign Multi-Tier Memory Governor:
 *   THROTTLE -> EVICT -> PAGE -> DEFER -> FAIL-CLOSED
 *
 * Enforces hard physical memory ceiling (RSS <= 512 MB) and working-set constraints.
 */

import { BoundedWorkingSetManager } from './BoundedWorkingSetManager';
import { VirtualMemoryPagingEngine } from './VirtualMemoryPagingEngine';
import { OnDemandMaterializer } from './OnDemandMaterializer';

export type GovernorAction = 'NORMAL' | 'THROTTLE' | 'EVICT' | 'PAGE_OUT' | 'DEFER' | 'FAIL_CLOSED';

export interface GovernorStatus {
  action: GovernorAction;
  heapUsedMb: number;
  rssMb: number;
  maxRssCeilingMb: number;
  residentPages: number;
  materializedObjects: number;
  isCompliant: boolean;
}

export class ExtremeMemoryGovernor {
  public static readonly MAX_RSS_CEILING_MB = 512;

  private readonly workingSetManager: BoundedWorkingSetManager;
  private readonly pagingEngine?: VirtualMemoryPagingEngine;
  private readonly materializer?: OnDemandMaterializer;

  constructor(
    workingSetManager?: BoundedWorkingSetManager,
    pagingEngine?: VirtualMemoryPagingEngine,
    materializer?: OnDemandMaterializer
  ) {
    this.workingSetManager = workingSetManager ?? new BoundedWorkingSetManager();
    this.pagingEngine = pagingEngine;
    this.materializer = materializer;
  }

  /**
   * Enforces sovereign memory constraints.
   * Multi-stage escalation protocol: THROTTLE -> EVICT -> PAGE_OUT -> DEFER -> FAIL_CLOSED.
   */
  public govern(): GovernorStatus {
    const mem = process.memoryUsage();
    const heapMb = mem.heapUsed / (1024 * 1024);
    const rssMb = mem.rss / (1024 * 1024);

    let action: GovernorAction = 'NORMAL';

    if (rssMb >= ExtremeMemoryGovernor.MAX_RSS_CEILING_MB * 0.95 || heapMb >= 240) {
      // Emergency: attempt multi-subsystem eviction
      let freed = false;
      if (this.materializer) {
        freed = this.materializer.evictOldest() || freed;
      }
      if (this.pagingEngine) {
        freed = this.pagingEngine.evictOldest() || freed;
      }

      const postMem = process.memoryUsage();
      const postRssMb = postMem.rss / (1024 * 1024);

      if (postRssMb >= ExtremeMemoryGovernor.MAX_RSS_CEILING_MB) {
        action = 'FAIL_CLOSED';
        throw new Error(
          `[ExtremeMemoryGovernor Fail-Closed] Critical memory violation: RSS ${postRssMb.toFixed(2)} MB breached hard ceiling ${ExtremeMemoryGovernor.MAX_RSS_CEILING_MB} MB.`
        );
      } else {
        action = 'EVICT';
      }
    } else if (rssMb >= ExtremeMemoryGovernor.MAX_RSS_CEILING_MB * 0.80 || heapMb >= 200) {
      // Escalation: Page out and evict
      if (this.pagingEngine) this.pagingEngine.evictOldest();
      action = 'PAGE_OUT';
    } else if (rssMb >= ExtremeMemoryGovernor.MAX_RSS_CEILING_MB * 0.70 || heapMb >= 170) {
      action = 'THROTTLE';
    }

    return {
      action,
      heapUsedMb: heapMb,
      rssMb,
      maxRssCeilingMb: ExtremeMemoryGovernor.MAX_RSS_CEILING_MB,
      residentPages: this.pagingEngine?.getMetrics().residentPhysicalPages ?? 0,
      materializedObjects: this.materializer?.getStats().activeMaterializedObjects ?? 0,
      isCompliant: rssMb < ExtremeMemoryGovernor.MAX_RSS_CEILING_MB,
    };
  }
}
