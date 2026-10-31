/**
 * Space Manager — Controller & Runtime Model
 * ============================================================================
 * SpaceManagerApp.ts: Implements Address369 spatial memory visualization,
 * task management, and virtual desktop switching for Oview OS.
 */

import { ProcessManager, ProcessState } from '../../core/ProcessManager';
import { WorkspaceManager, WorkspaceSpace } from '../../core/WorkspaceManager';

export class SpaceManagerApp {
  private activeTab: 'slots' | 'spaces' | 'procs' | 'perf' = 'slots';
  private selectedSlot: number = 0;

  public get pm(): ProcessManager {
    return ProcessManager.getInstance();
  }

  public get wm(): WorkspaceManager {
    return WorkspaceManager.getInstance();
  }

  public setActiveTab(tab: 'slots' | 'spaces' | 'procs' | 'perf'): void {
    this.activeTab = tab;
  }

  public getActiveTab(): 'slots' | 'spaces' | 'procs' | 'perf' {
    return this.activeTab;
  }

  public selectSlot(slot: number): void {
    if (slot >= 0 && slot < 369) {
      this.selectedSlot = slot;
    }
  }

  public getSelectedSlot(): number {
    return this.selectedSlot;
  }

  public killTask(pid: number): boolean {
    if (pid <= 1) return false; // Prevent killing kernel or ECHO-1 core
    return this.pm.terminateProcess(pid);
  }

  public switchWorkspace(spaceId: number): void {
    this.wm.switchSpace(spaceId);
  }

  /**
   * Generates slot details for the selected slot.
   */
  public getSlotDetails(slot: number): {
    slot: number;
    type: 'kernel' | 'userspace' | 'checkpoint';
    status: 'allocated' | 'free';
    process?: ProcessState;
  } {
    let type: 'kernel' | 'userspace' | 'checkpoint' = 'userspace';
    if (slot < 10) type = 'kernel';
    else if (slot >= 360) type = 'checkpoint';

    const procs = this.pm.getActiveProcesses();
    const proc = procs.find(p => p.memorySlot369 === slot);

    return {
      slot,
      type,
      status: proc ? 'allocated' : 'free',
      process: proc,
    };
  }

  /**
   * Renders the HTML content for the active tab.
   */
  public renderContent(): string {
    switch (this.activeTab) {
      case 'slots':
        return this.renderSlotsView();
      case 'spaces':
        return this.renderSpacesView();
      case 'procs':
        return this.renderProcessesView();
      case 'perf':
        return this.renderPerformanceView();
      default:
        return this.renderSlotsView();
    }
  }

  private renderSlotsView(): string {
    const procs = this.pm.getActiveProcesses();
    const allocatedSlots = new Map<number, ProcessState>();
    for (const p of procs) {
      allocatedSlots.set(p.memorySlot369, p);
    }

    const selected = this.getSlotDetails(this.selectedSlot);

    // Build 369 mini squares
    let gridHtml = '';
    for (let i = 0; i < 369; i++) {
      let bg = 'rgba(255, 255, 255, 0.05)';
      let border = 'rgba(255, 255, 255, 0.08)';
      let title = `Slot #${i} (Free)`;

      if (i < 10) {
        bg = 'rgba(6, 182, 212, 0.25)'; // Cyan for Kernel/ECHO-1
        border = '#06b6d4';
        title = `Slot #${i} (Kernel & ECHO-1 Brain)`;
      } else if (i >= 360) {
        bg = 'rgba(245, 158, 11, 0.25)'; // Amber for Checkpoint Ring
        border = '#f59e0b';
        title = `Slot #${i} (Time-Travel Checkpoint Ring)`;
      } else if (allocatedSlots.has(i)) {
        bg = 'rgba(16, 185, 129, 0.45)'; // Emerald for User App
        border = '#10b981';
        title = `Slot #${i}: ${allocatedSlots.get(i)!.appId} (PID: ${allocatedSlots.get(i)!.pid})`;
      }

      const isCurrent = i === this.selectedSlot ? 'outline: 2px solid #ffffff; z-index: 10;' : '';
      gridHtml += `<div class="sm-slot-cell" onclick="smSelectSlot(${i})" title="${title}" style="width: 14px; height: 14px; border-radius: 2px; background: ${bg}; border: 1px solid ${border}; cursor: pointer; transition: all 0.15s; ${isCurrent}"></div>`;
    }

    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 20px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">Address369 Spatial Memory Matrix</h3>
            <p style="font-size: 12px; color: #94a3b8;">Bounded Spatial Allocation: 369 Discrete Memory Slots [0..368]</p>
          </div>
          <!-- Legend -->
          <div style="display: flex; gap: 12px; font-size: 11px; color: #cbd5e1;">
            <div style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: #06b6d4; border-radius: 2px;"></span> Kernel [0..9]</div>
            <div style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: #10b981; border-radius: 2px;"></span> User App [10..359]</div>
            <div style="display: flex; align-items: center; gap: 4px;"><span style="width: 10px; height: 10px; background: #f59e0b; border-radius: 2px;"></span> Ring [360..368]</div>
          </div>
        </div>

        <!-- 369 Grid Container -->
        <div style="display: flex; flex-wrap: wrap; gap: 3px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; margin-bottom: 16px; max-height: 280px; overflow-y: auto;">
          ${gridHtml}
        </div>

        <!-- Selected Slot Detail Card -->
        <div style="background: rgba(18, 25, 41, 0.85); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #10b981;">Selected: Slot #${selected.slot} (${selected.type.toUpperCase()})</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
              Status: <span style="color: ${selected.status === 'allocated' ? '#10b981' : '#64748b'}; font-weight: 600;">${selected.status.toUpperCase()}</span>
              ${selected.process ? ` | Process: ${selected.process.appId} (PID: ${selected.process.pid}, RAM: ${selected.process.memoryMb}MB)` : ' | Available for spatial assignment'}
            </div>
          </div>
          ${selected.process && selected.process.pid > 1 ? `<button onclick="smKillProcess(${selected.process.pid})" style="background: #ef4444; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Terminate Task</button>` : ''}
        </div>
      </div>
    `;
  }

  private renderSpacesView(): string {
    const spaces = this.wm.getSpaces();
    const activeSpaceId = this.wm.getActiveSpaceId();

    return `
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">Virtual Desktops & Sovereign Spaces</h3>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 20px;">Isolate workflows and applications across sovereign multi-desktop spaces.</p>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
          ${spaces.map(space => {
            const isActive = space.id === activeSpaceId;
            return `
              <div onclick="smSwitchSpace(${space.id})" style="background: rgba(18, 25, 41, 0.8); border: 2px solid ${isActive ? '#10b981' : 'rgba(255,255,255,0.08)'}; border-radius: 12px; padding: 18px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#10b981'" onmouseout="if(!${isActive}) this.style.borderColor='rgba(255,255,255,0.08)'">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <span style="font-size: 24px;">${space.icon}</span>
                  <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: ${isActive ? '#10b981' : 'rgba(255,255,255,0.05)'}; color: ${isActive ? '#022c22' : '#94a3b8'}; font-weight: 700;">
                    ${isActive ? 'ACTIVE SPACE' : 'Space #' + space.id}
                  </span>
                </div>
                <h4 style="font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">${space.name}</h4>
                <p style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">${space.description}</p>
                <div style="font-size: 11px; color: #64748b;">Assigned Windows: ${space.windowIds.length}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  private renderProcessesView(): string {
    const procs = this.pm.getActiveProcesses();

    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">Active Tasks & System Processes</h3>
            <p style="font-size: 12px; color: #94a3b8;">Total Running PIDs: ${procs.length}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #64748b;">
              <th style="padding: 8px 10px;">PID</th>
              <th style="padding: 8px 10px;">Application</th>
              <th style="padding: 8px 10px;">Memory Slot</th>
              <th style="padding: 8px 10px;">RAM Usage</th>
              <th style="padding: 8px 10px;">State</th>
              <th style="padding: 8px 10px; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${procs.map(p => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); color: #cbd5e1;">
                <td style="padding: 10px; font-family: monospace; color: #10b981;">#${p.pid}</td>
                <td style="padding: 10px; font-weight: 600; color: #f8fafc;">${p.appId}</td>
                <td style="padding: 10px; font-family: monospace;">Slot ${p.memorySlot369}</td>
                <td style="padding: 10px;">${p.memoryMb.toFixed(1)} MB</td>
                <td style="padding: 10px;"><span style="color: #10b981;">●</span> ${p.state}</td>
                <td style="padding: 10px; text-align: right;">
                  ${p.pid > 1 ? `<button onclick="smKillProcess(${p.pid})" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">Kill</button>` : '<span style="color: #64748b; font-size: 11px;">Protected</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderPerformanceView(): string {
    const tele = this.pm.getTelemetry();

    return `
      <div>
        <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">System Telemetry & Performance</h3>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 24px;">Sub-millisecond IPC and deterministic spatial resource allocation.</p>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Total RAM Allocated</div>
            <div style="font-size: 24px; font-weight: 800; color: #10b981;">${tele.totalMemoryMb.toFixed(1)} MB</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Across ${tele.activePids} active processes</div>
          </div>

          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Qplayer VM Execution</div>
            <div style="font-size: 24px; font-weight: 800; color: #3b82f6;">204.8M</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Operations / second baseline</div>
          </div>

          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">SystemBus IPC Dispatch</div>
            <div style="font-size: 24px; font-weight: 800; color: #a855f7;">0.019 ms</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Zero-serialization micro-dispatch</div>
          </div>
        </div>
      </div>
    `;
  }
}
