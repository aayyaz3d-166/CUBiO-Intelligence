/**
 * Oview OS — Sovereign Process Guard & Self-Healing Health Monitor
 * ================================================================
 * ProcessGuard.ts: Monitors application health, verifies Address369
 * spatial memory bounds [0..368], audits Invariant E9001 (Zero Secret Leakage),
 * and automatically recovers crashed processes.
 */

import { ProcessManager, ProcessState } from '../core/ProcessManager';
import { SystemBus } from '../core/SystemBus';

export interface HealthAuditReport {
  timestamp: number;
  healthy: boolean;
  activeProcessCount: number;
  memorySlotsInUse: number;
  spatialMemoryOk: boolean;
  invariantE9001Ok: boolean;
  crashedRecoveredCount: number;
  diagnostics: string[];
}

export class ProcessGuard {
  private static instance: ProcessGuard | null = null;
  private get pm(): ProcessManager {
    return ProcessManager.getInstance();
  }
  private get bus(): SystemBus {
    return SystemBus.getInstance();
  }
  private recoveryCount: number = 0;
  private isDaemonRunning: boolean = false;

  private constructor() {}

  public static getInstance(): ProcessGuard {
    if (!ProcessGuard.instance) {
      ProcessGuard.instance = new ProcessGuard();
    }
    return ProcessGuard.instance;
  }

  public static resetInstance(): void {
    ProcessGuard.instance = new ProcessGuard();
  }

  /**
   * Performs an instant comprehensive system health audit.
   */
  public auditSystemHealth(): HealthAuditReport {
    const active = this.pm.getActiveProcesses();
    const diagnostics: string[] = [];
    let spatialMemoryOk = true;
    let invariantE9001Ok = true;

    // 1. Audit Address369 Spatial Memory Bounds [0..368]
    for (const p of active) {
      if (p.memorySlot369 < 0 || p.memorySlot369 > 368) {
        spatialMemoryOk = false;
        diagnostics.push(`[E8005 VIOLATION] Process PID ${p.pid} ('${p.name}') allocated out-of-bounds slot ${p.memorySlot369}.`);
      }
    }

    // 2. Audit Invariant E9001 (Zero Secret Leakage)
    // Verify no secret strings or private tokens exist in process states
    for (const p of active) {
      const serialized = JSON.stringify(p);
      if (
        serialized.includes('SECRET_KEY') ||
        serialized.includes('PRIVATE_KEY') ||
        serialized.includes('DATABASE_URL') ||
        serialized.includes('AWS_SECRET')
      ) {
        invariantE9001Ok = false;
        diagnostics.push(`[E9001 LEAK] Process PID ${p.pid} holds unredacted credentials.`);
      }
    }

    const healthy = spatialMemoryOk && invariantE9001Ok && diagnostics.length === 0;

    const report: HealthAuditReport = {
      timestamp: Date.now(),
      healthy,
      activeProcessCount: active.length,
      memorySlotsInUse: active.length + 1,
      spatialMemoryOk,
      invariantE9001Ok,
      crashedRecoveredCount: this.recoveryCount,
      diagnostics,
    };

    this.bus.emit('guard:health_audited', report, 'ProcessGuard');
    return report;
  }

  /**
   * Recovers a crashed process by restarting its window.
   */
  public recoverCrashedProcess(appId: string): ProcessState {
    this.recoveryCount++;
    const launched = this.pm.launchApp(appId);
    const proc = this.pm.getActiveProcesses().find(p => p.pid === launched.pid)!;

    this.bus.emit(
      'guard:process_recovered',
      { appId, pid: launched.pid, recoveryCount: this.recoveryCount },
      'ProcessGuard'
    );

    return proc;
  }

  public getRecoveryCount(): number {
    return this.recoveryCount;
  }
}
