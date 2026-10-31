/**
 * Sovereign Task Manager & Hardware Monitor
 * ============================================================================
 * TaskManagerApp.ts: Manages system processes, live telemetry, process
 * termination (End Task), and Address369 spatial memory allocation map [0..368].
 * Address369 Spatial Memory Slot: 90
 */

import { ProcessManager, ProcessState, SystemTelemetry } from '../../core/ProcessManager';
import { SystemBus } from '../../core/SystemBus';

export interface ProcessRow {
  pid: number;
  appId: string;
  name: string;
  icon: string;
  slot: number;
  memoryMb: number;
  cpuPercent: number;
  status: 'running' | 'suspended' | 'terminating';
}

export interface MemorySlotInfo {
  slot: number;
  category: 'kernel' | 'user' | 'reserved';
  isAllocated: boolean;
  ownerApp?: string;
}

export class TaskManagerApp {
  private pm: ProcessManager;
  private bus: SystemBus;
  private cpuHistory: number[] = [8, 12, 10, 15, 14, 18, 11, 13, 16, 12];
  private currentTab: 'processes' | 'performance' | 'memory' = 'processes';

  constructor() {
    this.pm = ProcessManager.getInstance();
    this.bus = SystemBus.getInstance();
  }

  public getProcessList(): ProcessRow[] {
    const active = this.pm.getActiveProcesses();
    const rows: ProcessRow[] = [];

    // Map active processes
    for (const proc of active) {
      const desc = this.pm.getApp(proc.appId);
      rows.push({
        pid: proc.pid,
        appId: proc.appId,
        name: desc ? desc.name : proc.appId,
        icon: desc ? desc.icon : '⚙️',
        slot: desc && desc.defaultWidth ? Math.min(359, 10 + (proc.pid % 340)) : 12,
        memoryMb: proc.memoryUsageMb,
        cpuPercent: Math.max(1, Math.min(25, (proc.pid * 3) % 20)),
        status: proc.status === 'active' ? 'running' : 'suspended'
      });
    }

    // Default system processes if empty
    if (rows.length === 0) {
      rows.push({
        pid: 1,
        appId: 'kernel.microkernel',
        name: 'Oview OS Microkernel',
        icon: '◈',
        slot: 0,
        memoryMb: 8.5,
        cpuPercent: 0.5,
        status: 'running'
      });
      rows.push({
        pid: 2,
        appId: 'kernel.echo1',
        name: 'ECHO-1 Local Brain Engine',
        icon: '🤖',
        slot: 1,
        memoryMb: 16.0,
        cpuPercent: 1.2,
        status: 'running'
      });
    }

    return rows;
  }

  public killProcess(pid: number): boolean {
    const success = this.pm.terminateProcess(pid);
    this.bus.emit('taskmgr:process_killed', { pid, success }, 'TaskManagerApp');
    return success;
  }

  public getTelemetry(): SystemTelemetry & { cpuHistory: number[] } {
    const base = this.pm.getTelemetry();
    return {
      ...base,
      cpuHistory: [...this.cpuHistory]
    };
  }

  public sampleTelemetry(cpuVal?: number): void {
    const nextCpu = cpuVal !== undefined ? cpuVal : Math.floor(Math.random() * 15) + 5;
    this.cpuHistory.push(nextCpu);
    if (this.cpuHistory.length > 20) {
      this.cpuHistory.shift();
    }
  }

  public getAddress369MemoryMap(): MemorySlotInfo[] {
    const slots: MemorySlotInfo[] = [];

    // Slots 0..368
    for (let i = 0; i < 369; i++) {
      let category: 'kernel' | 'user' | 'reserved' = 'user';
      if (i < 10) category = 'kernel';
      else if (i >= 360) category = 'reserved';

      // Known app slot assignments
      let ownerApp: string | undefined = undefined;
      let isAllocated = false;

      if (i === 0) { ownerApp = 'Kernel Core'; isAllocated = true; }
      else if (i === 1) { ownerApp = 'ECHO-1 Neural Brain'; isAllocated = true; }
      else if (i === 12) { ownerApp = 'oview.notepad'; isAllocated = true; }
      else if (i === 15) { ownerApp = 'oview.explorer'; isAllocated = true; }
      else if (i === 20) { ownerApp = 'oview.terminal'; isAllocated = true; }
      else if (i === 25) { ownerApp = 'oview.calculator'; isAllocated = true; }
      else if (i === 30) { ownerApp = 'oview.settings'; isAllocated = true; }
      else if (i === 35) { ownerApp = 'oview.spacemanager'; isAllocated = true; }
      else if (i === 40) { ownerApp = 'oview.cubio'; isAllocated = true; }
      else if (i === 45) { ownerApp = 'oview.artcanvas'; isAllocated = true; }
      else if (i === 50) { ownerApp = 'oview.rxp'; isAllocated = true; }
      else if (i === 55) { ownerApp = 'oview.ogallery'; isAllocated = true; }
      else if (i === 60) { ownerApp = 'oview.clock'; isAllocated = true; }
      else if (i === 65) { ownerApp = 'oview.weather'; isAllocated = true; }
      else if (i === 70) { ownerApp = 'oview.recorder'; isAllocated = true; }
      else if (i === 75) { ownerApp = 'oview.oarchive'; isAllocated = true; }
      else if (i === 80) { ownerApp = 'oview.trash'; isAllocated = true; }
      else if (i === 85) { ownerApp = 'oview.flow'; isAllocated = true; }
      else if (i === 90) { ownerApp = 'oview.taskmgr'; isAllocated = true; }
      else if (i === 95) { ownerApp = 'oview.player'; isAllocated = true; }

      slots.push({
        slot: i,
        category,
        isAllocated,
        ownerApp
      });
    }

    return slots;
  }

  public setTab(tab: 'processes' | 'performance' | 'memory'): void {
    this.currentTab = tab;
  }

  public getTab(): string {
    return this.currentTab;
  }
}
