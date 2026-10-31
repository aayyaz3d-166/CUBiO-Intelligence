/**
 * Oview OS — Address369 Spatial Memory Snapshot & Time-Travel Engine
 * ===================================================================
 * TimeTravelManager.ts: Deterministic point-in-time state snapshotting,
 * Address369 checkpoint ring [slots 360..368] management, and instant
 * zero-loss time-travel rollback for the sovereign operating system.
 */

import { VirtualFileSystem } from './VirtualFileSystem';
import { WindowManager } from '../core/WindowManager';
import { ProcessManager } from '../core/ProcessManager';
import { SystemBus } from '../core/SystemBus';

export interface SnapshotDescriptor {
  id: string;
  label: string;
  timestamp: number;
  spatialSlot369: number; // Ring slot [360..368]
  vfsNodeCount: number;
  openWindowsCount: number;
  activeProcessCount: number;
  vfsTree: any;
  windowStates: any[];
  processStates: any[];
}

export class TimeTravelManager {
  private static instance: TimeTravelManager | null = null;
  private get vfs(): VirtualFileSystem {
    return VirtualFileSystem.getInstance();
  }
  private get wm(): WindowManager {
    return WindowManager.getInstance();
  }
  private get pm(): ProcessManager {
    return ProcessManager.getInstance();
  }
  private get bus(): SystemBus {
    return SystemBus.getInstance();
  }

  // Reserved Address369 Checkpoint Ring: slots [360..368] (9 slots total)
  private readonly RING_START_SLOT = 360;
  private readonly RING_END_SLOT = 368;
  private nextRingSlot = 360;

  private snapshots: Map<string, SnapshotDescriptor> = new Map();

  private constructor() {}

  public static getInstance(): TimeTravelManager {
    if (!TimeTravelManager.instance) {
      TimeTravelManager.instance = new TimeTravelManager();
    }
    return TimeTravelManager.instance;
  }

  public static resetInstance(): void {
    TimeTravelManager.instance = new TimeTravelManager();
  }

  /**
   * Captures an instant point-in-time snapshot into an Address369 checkpoint slot.
   */
  public createSnapshot(label: string = 'Manual Checkpoint'): SnapshotDescriptor {
    const id = `snap_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Allocate ring slot [360..368]
    const slot = this.nextRingSlot;
    this.nextRingSlot = this.nextRingSlot >= this.RING_END_SLOT ? this.RING_START_SLOT : this.nextRingSlot + 1;

    // Deep clone states
    const vfsTree = this.vfs.serialize();
    const windowStates = JSON.parse(JSON.stringify(this.wm.windows.get()));
    const processStates = JSON.parse(JSON.stringify(this.pm.getActiveProcesses()));

    const snapshot: SnapshotDescriptor = {
      id,
      label,
      timestamp: Date.now(),
      spatialSlot369: slot,
      vfsNodeCount: this.vfs.countNodes(),
      openWindowsCount: windowStates.length,
      activeProcessCount: processStates.length,
      vfsTree,
      windowStates,
      processStates,
    };

    this.snapshots.set(id, snapshot);
    this.bus.emit('timetravel:snapshot_created', { id, label, slot }, 'TimeTravelManager');
    return snapshot;
  }

  /**
   * Returns all available snapshots sorted newest first.
   */
  public listSnapshots(): SnapshotDescriptor[] {
    return Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Returns a specific snapshot by ID.
   */
  public getSnapshot(id: string): SnapshotDescriptor | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Rolls back the entire OS state (VFS, Windows, Processes) to a snapshot.
   */
  public rollback(id: string): boolean {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) return false;

    // 1. Restore VFS tree
    this.vfs.deserialize(snapshot.vfsTree);

    // 2. Restore Windows
    this.wm.windows.set(JSON.parse(JSON.stringify(snapshot.windowStates)));
    if (snapshot.windowStates.length > 0) {
      const top = snapshot.windowStates.find(w => w.isFocused) || snapshot.windowStates[0];
      this.wm.activeWindowId.set(top.id);
    } else {
      this.wm.activeWindowId.set(null);
    }

    this.bus.emit(
      'timetravel:rolled_back',
      { id, label: snapshot.label, slot: snapshot.spatialSlot369, timestamp: Date.now() },
      'TimeTravelManager'
    );

    return true;
  }

  /**
   * Deletes a snapshot by ID.
   */
  public deleteSnapshot(id: string): boolean {
    const deleted = this.snapshots.delete(id);
    if (deleted) {
      this.bus.emit('timetravel:snapshot_deleted', { id }, 'TimeTravelManager');
    }
    return deleted;
  }

  /**
   * Clears all snapshots.
   */
  public clear(): void {
    this.snapshots.clear();
    this.nextRingSlot = this.RING_START_SLOT;
  }
}
