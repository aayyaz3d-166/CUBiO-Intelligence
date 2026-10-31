/**
 * Oview OS — Sovereign AI Natural Language Intent Dispatcher
 * ============================================================
 * IntentDispatcher.ts: Translates natural language user intents into
 * native OS actions, window management commands, VFS operations,
 * and ECHO-1 offline AI assistant reasoning.
 */

import { WindowManager } from '../core/WindowManager';
import { ProcessManager } from '../core/ProcessManager';
import { SystemBus } from '../core/SystemBus';
import { VirtualFileSystem } from '../vfs/VirtualFileSystem';
import { TimeTravelManager } from '../vfs/TimeTravelManager';
import { Echo1Assistant } from '../../one/intelligence/echo/Echo1Assistant';

export type IntentActionType =
  | 'launch_app'
  | 'close_app'
  | 'close_all'
  | 'cascade_windows'
  | 'change_theme'
  | 'vfs_create_file'
  | 'vfs_read_file'
  | 'create_snapshot'
  | 'list_snapshots'
  | 'rollback_snapshot'
  | 'system_telemetry'
  | 'ai_answer';

export interface DispatchedIntent {
  rawPrompt: string;
  action: IntentActionType;
  target?: string;
  payload?: any;
  resultMessage: string;
  success: boolean;
  latencyMs: number;
}

export class IntentDispatcher {
  private static instance: IntentDispatcher | null = null;
  private get wm(): WindowManager {
    return WindowManager.getInstance();
  }
  private get pm(): ProcessManager {
    return ProcessManager.getInstance();
  }
  private get vfs(): VirtualFileSystem {
    return VirtualFileSystem.getInstance();
  }
  private get bus(): SystemBus {
    return SystemBus.getInstance();
  }
  private echo: Echo1Assistant;

  private constructor() {
    this.echo = Echo1Assistant.getInstance();
  }

  public static getInstance(): IntentDispatcher {
    if (!IntentDispatcher.instance) {
      IntentDispatcher.instance = new IntentDispatcher();
    }
    return IntentDispatcher.instance;
  }

  public static resetInstance(): void {
    IntentDispatcher.instance = new IntentDispatcher();
  }

  /**
   * Parses natural language intent and dispatches corresponding OS action.
   */
  public dispatch(prompt: string): DispatchedIntent {
    const t0 = performance.now();
    const raw = prompt.trim();
    const p = raw.toLowerCase();

    // 1. Theme Changes
    if (p.includes('neon') || (p.includes('theme') && (p.includes('red') || p.includes('crimson')))) {
      this.bus.emit('system:theme_changed', { theme: 'neon-matrix', accent: '#f43f5e' }, 'IntentDispatcher');
      return {
        rawPrompt: raw,
        action: 'change_theme',
        target: 'neon-matrix',
        resultMessage: "Switched desktop theme to 'Neon Matrix' (Cyberpunk Red).",
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    if (p.includes('deep space') || (p.includes('blue') && p.includes('theme'))) {
      this.bus.emit('system:theme_changed', { theme: 'deep-space', accent: '#38bdf8' }, 'IntentDispatcher');
      return {
        rawPrompt: raw,
        action: 'change_theme',
        target: 'deep-space',
        resultMessage: "Switched desktop theme to 'Deep Space' (Electric Blue).",
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    if (p.includes('cyber') || p.includes('emerald') || (p.includes('default') && p.includes('theme'))) {
      this.bus.emit('system:theme_changed', { theme: 'cyber-glass', accent: '#10b981' }, 'IntentDispatcher');
      return {
        rawPrompt: raw,
        action: 'change_theme',
        target: 'cyber-glass',
        resultMessage: "Switched desktop theme to 'Cyber Glass' (Emerald Glow).",
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    // 2. Window Management (Close All, Cascade)
    if (p.includes('close all') || p.includes('close windows')) {
      this.wm.closeAll();
      return {
        rawPrompt: raw,
        action: 'close_all',
        resultMessage: 'Closed all active desktop windows.',
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    if (p.includes('cascade') || p.includes('arrange windows')) {
      this.wm.arrangeCascade();
      return {
        rawPrompt: raw,
        action: 'cascade_windows',
        resultMessage: 'Arranged all visible windows in cascade format.',
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    // 3. System Telemetry & Memory (Ensure questions like "explain memory" don't trigger telemetry)
    if (!p.startsWith('explain') && !p.startsWith('what') && !p.startsWith('how') && !p.startsWith('tell')) {
      if (
        (p.includes('memory') || p.includes('ram') || p.includes('telemetry') || p.includes('cpu')) &&
        (p.includes('usage') || p.includes('show') || p.includes('check') || p.includes('stats') || p.includes('status') || p === 'ram' || p === 'memory' || p === 'telemetry')
      ) {
        const t = this.pm.getTelemetry();
        return {
          rawPrompt: raw,
          action: 'system_telemetry',
          payload: t,
          resultMessage: `System Telemetry: CPU ${t.cpuUsage}% | Memory ${t.memoryUsedMb}MB / ${t.memoryTotalMb}MB | Spatial Slots: ${t.spatialSlotUsage}/369 | Processes: ${t.activeProcesses}`,
          success: true,
          latencyMs: Number((performance.now() - t0).toFixed(2)),
        };
      }
    }

    // 4. File Operations
    if (p.startsWith('create file') || p.startsWith('make file') || p.startsWith('write file')) {
      // Regex match: create file <name> with content <content>
      const match = raw.match(/create file\s+([^\s]+)(?:\s+with content\s+(.+))?/i);
      if (match) {
        const fileName = match[1];
        const content = match[2] || '';
        const targetPath = fileName.startsWith('/') ? fileName : `/user/documents/${fileName}`;
        this.vfs.writeFile(targetPath, content);
        return {
          rawPrompt: raw,
          action: 'vfs_create_file',
          target: targetPath,
          resultMessage: `Created VFS file at '${targetPath}' (${Buffer.byteLength(content, 'utf-8')} bytes).`,
          success: true,
          latencyMs: Number((performance.now() - t0).toFixed(2)),
        };
      }
    }

    if (p.startsWith('read file') || p.startsWith('cat ') || p.startsWith('open file')) {
      const fileName = raw.split(/\s+/).slice(2).join(' ') || raw.split(/\s+/)[1];
      if (fileName) {
        const targetPath = fileName.startsWith('/') ? fileName : `/user/documents/${fileName}`;
        if (this.vfs.exists(targetPath)) {
          const content = this.vfs.readFile(targetPath);
          return {
            rawPrompt: raw,
            action: 'vfs_read_file',
            target: targetPath,
            payload: content,
            resultMessage: `Read ${targetPath}:\n${content.slice(0, 300)}${content.length > 300 ? '...' : ''}`,
            success: true,
            latencyMs: Number((performance.now() - t0).toFixed(2)),
          };
        }
      }
    }

    // 4.5 Time-Travel & Snapshot Operations
    if (p.includes('create snapshot') || p.includes('make snapshot') || p.includes('take snapshot') || p.includes('save snapshot')) {
      const label = raw.replace(/(?:create|make|take|save)\s+snapshot\s*(?:called|named)?/i, '').trim() || 'AI Checkpoint';
      const snap = TimeTravelManager.getInstance().createSnapshot(label);
      return {
        rawPrompt: raw,
        action: 'create_snapshot',
        target: snap.id,
        payload: snap,
        resultMessage: `Created state snapshot '${snap.id}' (Slot ${snap.spatialSlot369}) with label: "${snap.label}".`,
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    if (p.includes('list snapshots') || p.includes('show snapshots')) {
      const snaps = TimeTravelManager.getInstance().listSnapshots();
      return {
        rawPrompt: raw,
        action: 'list_snapshots',
        payload: snaps,
        resultMessage: snaps.length === 0
          ? 'No active snapshots.'
          : snaps.map(s => `[Slot ${s.spatialSlot369}] ${s.id} — "${s.label}"`).join('\n'),
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    if (p.startsWith('rollback') || p.startsWith('restore snapshot')) {
      const parts = raw.split(/\s+/);
      const snapId = parts.find(pt => pt.startsWith('snap_')) || parts[parts.length - 1];
      const ok = TimeTravelManager.getInstance().rollback(snapId);
      return {
        rawPrompt: raw,
        action: 'rollback_snapshot',
        target: snapId,
        resultMessage: ok
          ? `Successfully rolled back OS state to snapshot '${snapId}'.`
          : `Failed to rollback: Snapshot '${snapId}' not found.`,
        success: ok,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    // 5. App Launching Intent
    if (p.includes('notepad') || p.includes('note') || p.includes('text editor')) {
      this.pm.launchApp('oview.notepad');
      return {
        rawPrompt: raw,
        action: 'launch_app',
        target: 'oview.notepad',
        resultMessage: 'Launched Oview Notepad.',
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    if (p.includes('explorer') || p.includes('files') || p.includes('file manager') || p.includes('browse')) {
      this.pm.launchApp('oview.explorer');
      return {
        rawPrompt: raw,
        action: 'launch_app',
        target: 'oview.explorer',
        resultMessage: 'Launched File Explorer.',
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    if (p.includes('terminal') || p.includes('cli') || p.includes('repl') || p.includes('shell') || p.includes('bash')) {
      this.pm.launchApp('oview.terminal');
      return {
        rawPrompt: raw,
        action: 'launch_app',
        target: 'oview.terminal',
        resultMessage: 'Launched Oview Terminal (204M ops/sec).',
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    if (p.includes('calculator') || p.includes('calc') || p.includes('math')) {
      this.pm.launchApp('oview.calculator');
      return {
        rawPrompt: raw,
        action: 'launch_app',
        target: 'oview.calculator',
        resultMessage: 'Launched Calculator.',
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    if (p.includes('settings') || p.includes('config') || p.includes('preferences')) {
      this.pm.launchApp('oview.settings');
      return {
        rawPrompt: raw,
        action: 'launch_app',
        target: 'oview.settings',
        resultMessage: 'Opened System Settings.',
        success: true,
        latencyMs: Number((performance.now() - t0).toFixed(2)),
      };
    }

    // 6. Natural Language Question answering via ECHO-1 Core
    const echoRes = this.echo.ask(raw);
    return {
      rawPrompt: raw,
      action: 'ai_answer',
      payload: echoRes,
      resultMessage: echoRes.answer + (echoRes.codeSnippet ? `\n\n${echoRes.codeSnippet}` : ''),
      success: true,
      latencyMs: Number((performance.now() - t0).toFixed(2)),
    };
  }
}
