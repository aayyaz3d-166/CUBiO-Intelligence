/**
 * Oview OS — Sovereign Process & Application Lifecycle Manager
 * =============================================================
 * ProcessManager.ts: Manages running application processes, Address369
 * spatial memory slot allocations, lifecycle hooks, and system telemetry.
 */

import { AppDescriptor, AppId, WindowId, SystemTelemetry } from './types';
import { WindowManager } from './WindowManager';
import { SystemBus } from './SystemBus';

export interface ProcessState {
  pid: number;
  appId: AppId;
  windowId: WindowId;
  name: string;
  memorySlot369: number; // Slot [0..368]
  allocatedMemoryMb: number;
  cpuPercent: number;
  status: 'running' | 'background' | 'terminated';
  startTime: number;
}

export class ProcessManager {
  private static instance: ProcessManager | null = null;

  private registry: Map<AppId, AppDescriptor> = new Map();
  private processes: Map<number, ProcessState> = new Map();
  private nextPid: number = 1000;
  private nextSlot369: number = 10; // Reserved slots 0-9 for OS kernel & ECHO-1

  private get wm(): WindowManager {
    return WindowManager.getInstance();
  }
  private get bus(): SystemBus {
    return SystemBus.getInstance();
  }
  private startTime: number = Date.now();

  private constructor() {
    this.registerDefaultApps();
  }

  public static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  public static resetInstance(): void {
    ProcessManager.instance = new ProcessManager();
  }

  /**
   * Registers default pre-installed native applications.
   */
  private registerDefaultApps(): void {
    this.registerApp({
      id: 'oview.notepad',
      name: 'Oview Notepad',
      icon: '📝',
      category: 'productivity',
      description: 'Native Glassmorphic Text Editor & Notebook',
      defaultWidth: 780,
      defaultHeight: 520,
      memorySlot369: 12,
    });

    this.registerApp({
      id: 'oview.explorer',
      name: 'File Explorer',
      icon: '📁',
      category: 'system',
      description: 'Sovereign Virtual File System (VFS) Browser',
      defaultWidth: 840,
      defaultHeight: 560,
      memorySlot369: 15,
    });

    this.registerApp({
      id: 'oview.terminal',
      name: 'Oview Terminal',
      icon: '⚡',
      category: 'developer',
      description: 'Interactive ONE Language REPL & System Shell',
      defaultWidth: 720,
      defaultHeight: 460,
      memorySlot369: 20,
    });

    this.registerApp({
      id: 'oview.calculator',
      name: 'Calculator',
      icon: '🧮',
      category: 'utility',
      description: 'Sovereign Scientific & Spatial Calculator',
      defaultWidth: 380,
      defaultHeight: 500,
      minWidth: 340,
      minHeight: 460,
      memorySlot369: 25,
    });

    this.registerApp({
      id: 'oview.settings',
      name: 'Settings',
      icon: '⚙️',
      category: 'system',
      description: 'System Personalization, Themes & Telemetry',
      defaultWidth: 800,
      defaultHeight: 540,
      memorySlot369: 30,
      singleInstance: true,
    });

    this.registerApp({
      id: 'oview.spacemanager',
      name: 'Space Manager',
      icon: '🪐',
      category: 'system',
      description: 'Address369 Spatial Memory, Tasks & Virtual Spaces',
      defaultWidth: 840,
      defaultHeight: 560,
      memorySlot369: 35,
      singleInstance: true,
    });

    this.registerApp({
      id: 'oview.cubio',
      name: 'CUBiO Browser',
      icon: '🌐',
      category: 'system',
      description: 'Sovereign Web Browser Powered by FreeTree Engine',
      defaultWidth: 920,
      defaultHeight: 600,
      memorySlot369: 40,
    });

    this.registerApp({
      id: 'oview.artcanvas',
      name: 'Art Canvas',
      icon: '🖌️',
      category: 'productivity',
      description: 'Sovereign 2D Creative Studio & Vector Canvas',
      defaultWidth: 860,
      defaultHeight: 580,
      memorySlot369: 45,
    });

    this.registerApp({
      id: 'oview.rxp',
      name: 'Rebel X Play',
      icon: '🎮',
      category: 'media',
      description: 'Sovereign Spatial Audio, Synthesizer & 60FPS Arcade',
      defaultWidth: 720,
      defaultHeight: 520,
      memorySlot369: 50,
    });

    this.registerApp({
      id: 'oview.ogallery',
      name: 'Ogallery',
      icon: '🖼️',
      category: 'media',
      description: 'Sovereign Photo Viewer & Media Gallery',
      defaultWidth: 820,
      defaultHeight: 540,
      memorySlot369: 55,
    });

    this.registerApp({
      id: 'oview.clock',
      name: 'Clock',
      icon: '⏰',
      category: 'utility',
      description: 'World Clock, Millisecond Stopwatch & Countdown Timer',
      defaultWidth: 640,
      defaultHeight: 480,
      memorySlot369: 60,
    });

    this.registerApp({
      id: 'oview.weather',
      name: 'Weather',
      icon: '🌦️',
      category: 'utility',
      description: 'Atmospheric Matrix, 5-Day Forecast & City Telemetry',
      defaultWidth: 640,
      defaultHeight: 460,
      memorySlot369: 65,
    });

    this.registerApp({
      id: 'oview.recorder',
      name: 'Voice Recorder',
      icon: '🎙️',
      category: 'media',
      description: 'Sovereign Audio Capture & Oscilloscope Visualizer',
      defaultWidth: 620,
      defaultHeight: 420,
      memorySlot369: 70,
    });

    this.registerApp({
      id: 'oview.oarchive',
      name: 'Oarchive',
      icon: '📦',
      category: 'utility',
      description: 'Sovereign Multi-File Packager & Zip Extractor',
      defaultWidth: 700,
      defaultHeight: 480,
      memorySlot369: 75,
    });

    this.registerApp({
      id: 'oview.trash',
      name: 'Recycle Bin',
      icon: '🗑️',
      category: 'system',
      description: 'Sovereign File Recovery & Trash Can',
      defaultWidth: 700,
      defaultHeight: 480,
      memorySlot369: 80,
      singleInstance: true,
    });

    this.registerApp({
      id: 'oview.flow',
      name: 'Oview Flow',
      icon: '⚡',
      category: 'productivity',
      description: 'In-Built n8n Visual Automation & AI Agent Orchestrator',
      defaultWidth: 840,
      defaultHeight: 540,
      memorySlot369: 85,
      singleInstance: true,
    });

    this.registerApp({
      id: 'oview.taskmgr',
      name: 'Task Manager',
      icon: '📊',
      category: 'system',
      description: 'Sovereign Process Guard & Address369 Hardware Monitor',
      defaultWidth: 740,
      defaultHeight: 500,
      memorySlot369: 90,
      singleInstance: true,
    });

    this.registerApp({
      id: 'oview.player',
      name: 'Oplayer',
      icon: '🎬',
      category: 'media',
      description: 'Native Audio/Video Media Engine & FFT Visualizer',
      defaultWidth: 740,
      defaultHeight: 500,
      memorySlot369: 95,
      singleInstance: true,
    });

    this.registerApp({
      id: 'oview.opackager',
      name: 'OPackager',
      icon: '📦',
      category: 'utility',
      description: 'Universal .onepkg Converter, Backup Engine & Marketplace Studio',
      defaultWidth: 780,
      defaultHeight: 520,
      memorySlot369: 100,
      singleInstance: true,
    });

    this.registerApp({
      id: 'oview.osheets',
      name: 'Osheets',
      icon: '📊',
      category: 'productivity',
      description: 'Sovereign Tabular Spreadsheet & Formula Math Engine in ONE Language',
      defaultWidth: 780,
      defaultHeight: 520,
      memorySlot369: 110,
      singleInstance: false,
    });

    this.registerApp({
      id: 'oview.ocanvas',
      name: 'Ocanvas',
      icon: '🎨',
      category: 'creativity',
      description: 'Infinite 2D Spatial Whiteboard, Sticky Notes & Mind-Mapping Surface',
      defaultWidth: 800,
      defaultHeight: 540,
      memorySlot369: 115,
      singleInstance: false,
    });

    this.registerApp({
      id: 'oview.spotlight',
      name: 'ECHO-1 Assistant',
      icon: '🤖',
      category: 'ai',
      description: '100% Offline Sovereign AI Operating Assistant',
      defaultWidth: 640,
      defaultHeight: 440,
      memorySlot369: 1, // High-priority neural slot
      singleInstance: true,
    });
  }

  /**
   * Registers a new application descriptor.
   */
  public registerApp(descriptor: AppDescriptor): void {
    this.registry.set(descriptor.id, descriptor);
  }

  /**
   * Returns all registered applications.
   */
  public getRegisteredApps(): AppDescriptor[] {
    return Array.from(this.registry.values());
  }

  /**
   * Returns a specific application descriptor.
   */
  public getApp(appId: AppId): AppDescriptor | undefined {
    return this.registry.get(appId);
  }

  /**
   * Launches an application.
   */
  public launchApp(appId: AppId, customState?: Record<string, any>): { pid: number; windowId: WindowId } {
    const desc = this.registry.get(appId);
    if (!desc) {
      throw new Error(`[ProcessManager Error] Unknown application ID '${appId}'`);
    }

    // Check single instance rule
    if (desc.singleInstance) {
      const existing = Array.from(this.processes.values()).find(
        p => p.appId === appId && p.status !== 'terminated'
      );
      if (existing) {
        this.wm.restoreWindow(existing.windowId);
        return { pid: existing.pid, windowId: existing.windowId };
      }
    }

    // Allocate Address369 slot [0..368]
    const slot = desc.memorySlot369 || (this.nextSlot369++ % 360) + 10;
    const pid = this.nextPid++;

    // Open window in WindowManager
    const win = this.wm.openWindow(appId, {
      title: desc.name,
      icon: desc.icon,
      width: desc.defaultWidth,
      height: desc.defaultHeight,
      minWidth: desc.minWidth,
      minHeight: desc.minHeight,
      state: customState,
    });

    const proc: ProcessState = {
      pid,
      appId,
      windowId: win.id,
      name: desc.name,
      memorySlot369: slot,
      allocatedMemoryMb: Math.floor(12 + Math.random() * 8),
      cpuPercent: 0.1,
      status: 'running',
      startTime: Date.now(),
    };

    this.processes.set(pid, proc);

    // Listen for window close to terminate process
    const unsub = this.bus.on('window:closed', (event) => {
      if (event.payload.id === win.id) {
        this.terminateProcess(pid);
        unsub();
      }
    });

    this.bus.emit('process:started', { pid, appId, windowId: win.id }, 'ProcessManager');

    return { pid, windowId: win.id };
  }

  /**
   * Terminates a process by PID.
   */
  public terminateProcess(pid: number): boolean {
    const proc = this.processes.get(pid);
    if (!proc || proc.status === 'terminated') return false;

    proc.status = 'terminated';

    // If window still exists, close it
    if (this.wm.getWindow(proc.windowId)) {
      this.wm.closeWindow(proc.windowId);
    }

    this.processes.delete(pid);
    this.bus.emit('process:terminated', { pid, appId: proc.appId }, 'ProcessManager');
    return true;
  }

  /**
   * Returns all active processes.
   */
  public getActiveProcesses(): ProcessState[] {
    return Array.from(this.processes.values()).filter(p => p.status !== 'terminated');
  }

  /**
   * Generates real-time system telemetry.
   */
  public getTelemetry(): SystemTelemetry {
    const active = this.getActiveProcesses();
    const memMb = active.reduce((acc, p) => acc + p.allocatedMemoryMb, 24.56); // Include ECHO-1 base 24.56MB
    const openWins = this.wm.windows.get().length;

    return {
      cpuUsage: Math.min(100, Number((0.8 + active.length * 0.4).toFixed(1))),
      memoryUsedMb: Number(memMb.toFixed(1)),
      memoryTotalMb: 1024,
      activeProcesses: active.length,
      openWindows: openWins,
      spatialSlotUsage: active.length + 1,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
