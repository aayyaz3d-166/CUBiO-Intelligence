/**
 * Oview OS — Sovereign Desktop Window Manager & Compositor
 * =========================================================
 * WindowManager.ts: Fine-grained reactive window state manager,
 * z-index layering, multi-tasking compositor, drag/resize boundary bounds,
 * and snap mechanics powered by OLTO Signals.
 */

import { Signal } from '../../olto/runtime/Signal';
import { WindowState, WindowId, AppId, WindowBounds } from './types';
import { SystemBus } from './SystemBus';

export interface OpenWindowOptions {
  title?: string;
  icon?: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  x?: number;
  y?: number;
  state?: Record<string, any>;
}

export class WindowManager {
  private static instance: WindowManager | null = null;

  // Fine-grained OLTO Signals
  public windows: Signal<WindowState[]> = new Signal<WindowState[]>([]);
  public activeWindowId: Signal<WindowId | null> = new Signal<WindowId | null>(null);

  // Desktop viewport dimensions
  public screenWidth: number = 1920;
  public screenHeight: number = 1080;
  public taskbarHeight: number = 48;

  private nextZIndex: number = 100;
  private cascadeCount: number = 0;
  private bus: SystemBus;

  private constructor() {
    this.bus = SystemBus.getInstance();
  }

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  public static resetInstance(): void {
    WindowManager.instance = new WindowManager();
  }

  /**
   * Sets the host display boundaries for layout calculation.
   */
  public setViewport(width: number, height: number, taskbarHeight: number = 48): void {
    this.screenWidth = Math.max(640, width);
    this.screenHeight = Math.max(480, height);
    this.taskbarHeight = taskbarHeight;
  }

  /**
   * Opens a new window for a given application ID.
   */
  public openWindow(appId: AppId, options: OpenWindowOptions = {}): WindowState {
    const list = this.windows.get();

    // Generate unique ID
    const id: WindowId = `win_${appId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const width = options.width || 720;
    const height = options.height || 480;
    const minWidth = options.minWidth || 360;
    const minHeight = options.minHeight || 240;

    // Automatic cascade calculation
    const offset = (this.cascadeCount % 8) * 32;
    this.cascadeCount++;

    const defaultX = Math.max(40, Math.min(80 + offset, this.screenWidth - width - 40));
    const defaultY = Math.max(40, Math.min(60 + offset, this.screenHeight - height - this.taskbarHeight - 40));

    const x = options.x !== undefined ? options.x : defaultX;
    const y = options.y !== undefined ? options.y : defaultY;

    this.nextZIndex++;

    const newWindow: WindowState = {
      id,
      appId,
      title: options.title || appId.toUpperCase(),
      icon: options.icon || '🪟',
      x,
      y,
      width,
      height,
      minWidth,
      minHeight,
      isMinimized: false,
      isMaximized: false,
      isFocused: true,
      zIndex: this.nextZIndex,
      state: options.state || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Defocus existing windows
    const updated = list.map(w => ({ ...w, isFocused: false }));
    updated.push(newWindow);

    this.windows.set(updated);
    this.activeWindowId.set(id);

    this.bus.emit('window:opened', { window: newWindow }, 'WindowManager');
    this.bus.emit('window:focused', { id }, 'WindowManager');

    return newWindow;
  }

  /**
   * Closes a window by its ID.
   */
  public closeWindow(id: WindowId): boolean {
    const list = this.windows.get();
    const target = list.find(w => w.id === id);
    if (!target) return false;

    const remaining = list.filter(w => w.id !== id);

    // If closed window was active, focus the highest remaining visible window
    if (this.activeWindowId.get() === id) {
      const visible = remaining.filter(w => !w.isMinimized);
      if (visible.length > 0) {
        visible.sort((a, b) => b.zIndex - a.zIndex);
        const top = visible[0];
        top.isFocused = true;
        this.activeWindowId.set(top.id);
      } else {
        this.activeWindowId.set(null);
      }
    }

    this.windows.set(remaining);
    this.bus.emit('window:closed', { id, appId: target.appId }, 'WindowManager');
    return true;
  }

  /**
   * Brings a window to the foreground and assigns it top zIndex.
   */
  public focusWindow(id: WindowId): boolean {
    const list = this.windows.get();
    const target = list.find(w => w.id === id);
    if (!target) return false;

    // Already focused and top
    if (target.isFocused && !target.isMinimized && this.activeWindowId.get() === id) {
      return true;
    }

    this.nextZIndex++;

    const updated = list.map(w => {
      if (w.id === id) {
        return {
          ...w,
          isFocused: true,
          isMinimized: false, // un-minimize if minimized
          zIndex: this.nextZIndex,
          updatedAt: Date.now(),
        };
      }
      return {
        ...w,
        isFocused: false,
      };
    });

    this.windows.set(updated);
    this.activeWindowId.set(id);

    this.bus.emit('window:focused', { id }, 'WindowManager');
    return true;
  }

  /**
   * Minimizes a window, removing it from active display to the taskbar.
   */
  public minimizeWindow(id: WindowId): boolean {
    const list = this.windows.get();
    const target = list.find(w => w.id === id);
    if (!target) return false;

    const updated = list.map(w => {
      if (w.id === id) {
        return {
          ...w,
          isMinimized: true,
          isFocused: false,
          updatedAt: Date.now(),
        };
      }
      return w;
    });

    // If was active, promote next highest visible window
    if (this.activeWindowId.get() === id) {
      const visible = updated.filter(w => !w.isMinimized && w.id !== id);
      if (visible.length > 0) {
        visible.sort((a, b) => b.zIndex - a.zIndex);
        visible[0].isFocused = true;
        this.activeWindowId.set(visible[0].id);
      } else {
        this.activeWindowId.set(null);
      }
    }

    this.windows.set(updated);
    this.bus.emit('window:minimized', { id }, 'WindowManager');
    return true;
  }

  /**
   * Restores a minimized window to the desktop and focuses it.
   */
  public restoreWindow(id: WindowId): boolean {
    return this.focusWindow(id);
  }

  /**
   * Toggles minimize / restore for taskbar click handling.
   */
  public toggleMinimize(id: WindowId): void {
    const target = this.getWindow(id);
    if (!target) return;

    if (target.isMinimized) {
      this.restoreWindow(id);
    } else if (target.isFocused) {
      this.minimizeWindow(id);
    } else {
      this.focusWindow(id);
    }
  }

  /**
   * Toggles maximization between fullscreen desktop bounds and saved bounds.
   */
  public toggleMaximize(id: WindowId): boolean {
    const list = this.windows.get();
    const target = list.find(w => w.id === id);
    if (!target) return false;

    this.nextZIndex++;

    const updated = list.map(w => {
      if (w.id === id) {
        if (w.isMaximized) {
          // Restore to previous bounds
          const prev = w.prevBounds || { x: 80, y: 60, width: 720, height: 480 };
          return {
            ...w,
            x: prev.x,
            y: prev.y,
            width: prev.width,
            height: prev.height,
            isMaximized: false,
            isFocused: true,
            zIndex: this.nextZIndex,
            updatedAt: Date.now(),
          };
        } else {
          // Maximize to full canvas minus taskbar
          const prevBounds: WindowBounds = {
            x: w.x,
            y: w.y,
            width: w.width,
            height: w.height,
          };
          return {
            ...w,
            x: 0,
            y: 0,
            width: this.screenWidth,
            height: this.screenHeight - this.taskbarHeight,
            isMaximized: true,
            isFocused: true,
            zIndex: this.nextZIndex,
            prevBounds,
            updatedAt: Date.now(),
          };
        }
      }
      return { ...w, isFocused: w.id === id };
    });

    this.windows.set(updated);
    this.activeWindowId.set(id);

    this.bus.emit('window:maximized', { id, isMaximized: !target.isMaximized }, 'WindowManager');
    return true;
  }

  /**
   * Moves a window by delta (dx, dy) with strict screen boundary clamping.
   */
  public moveWindow(id: WindowId, dx: number, dy: number): boolean {
    const list = this.windows.get();
    const target = list.find(w => w.id === id);
    if (!target || target.isMaximized) return false;

    const newX = Math.max(-target.width + 100, Math.min(target.x + dx, this.screenWidth - 100));
    const newY = Math.max(0, Math.min(target.y + dy, this.screenHeight - this.taskbarHeight - 40));

    const updated = list.map(w => {
      if (w.id === id) {
        return {
          ...w,
          x: newX,
          y: newY,
          updatedAt: Date.now(),
        };
      }
      return w;
    });

    this.windows.set(updated);
    return true;
  }

  /**
   * Sets exact window position.
   */
  public setWindowPosition(id: WindowId, x: number, y: number): boolean {
    const list = this.windows.get();
    const target = list.find(w => w.id === id);
    if (!target || target.isMaximized) return false;

    const clampedX = Math.max(-target.width + 100, Math.min(x, this.screenWidth - 100));
    const clampedY = Math.max(0, Math.min(y, this.screenHeight - this.taskbarHeight - 40));

    const updated = list.map(w => {
      if (w.id === id) {
        return {
          ...w,
          x: clampedX,
          y: clampedY,
          updatedAt: Date.now(),
        };
      }
      return w;
    });

    this.windows.set(updated);
    return true;
  }

  /**
   * Resizes a window while respecting minWidth and minHeight invariants.
   */
  public resizeWindow(id: WindowId, newWidth: number, newHeight: number): boolean {
    const list = this.windows.get();
    const target = list.find(w => w.id === id);
    if (!target || target.isMaximized) return false;

    const width = Math.max(target.minWidth, Math.min(newWidth, this.screenWidth));
    const height = Math.max(target.minHeight, Math.min(newHeight, this.screenHeight - this.taskbarHeight));

    const updated = list.map(w => {
      if (w.id === id) {
        return {
          ...w,
          width,
          height,
          updatedAt: Date.now(),
        };
      }
      return w;
    });

    this.windows.set(updated);
    this.bus.emit('window:resized', { id, width, height }, 'WindowManager');
    return true;
  }

  /**
   * Snaps a window to desktop edges ('left', 'right', 'top').
   */
  public snapWindow(id: WindowId, snap: 'left' | 'right' | 'top'): boolean {
    const target = this.getWindow(id);
    if (!target) return false;

    if (snap === 'top') {
      return this.toggleMaximize(id);
    }

    const halfWidth = Math.floor(this.screenWidth / 2);
    const fullHeight = this.screenHeight - this.taskbarHeight;
    const x = snap === 'left' ? 0 : halfWidth;

    const list = this.windows.get();
    this.nextZIndex++;

    const updated = list.map(w => {
      if (w.id === id) {
        return {
          ...w,
          x,
          y: 0,
          width: halfWidth,
          height: fullHeight,
          isMaximized: false,
          isFocused: true,
          zIndex: this.nextZIndex,
          prevBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
          updatedAt: Date.now(),
        };
      }
      return { ...w, isFocused: w.id === id };
    });

    this.windows.set(updated);
    this.activeWindowId.set(id);
    return true;
  }

  /**
   * Returns a window by ID.
   */
  public getWindow(id: WindowId): WindowState | undefined {
    return this.windows.get().find(w => w.id === id);
  }

  /**
   * Returns all windows belonging to a specific app.
   */
  public getWindowsByApp(appId: AppId): WindowState[] {
    return this.windows.get().filter(w => w.appId === appId);
  }

  /**
   * Arranges all open visible windows in cascade format.
   */
  public arrangeCascade(): void {
    const list = this.windows.get();
    const visible = list.filter(w => !w.isMinimized);

    const updated = list.map(w => {
      const idx = visible.indexOf(w);
      if (idx !== -1) {
        return {
          ...w,
          x: 40 + (idx * 30),
          y: 40 + (idx * 30),
          isMaximized: false,
          updatedAt: Date.now(),
        };
      }
      return w;
    });

    this.windows.set(updated);
  }

  /**
   * Closes all open windows.
   */
  public closeAll(): void {
    this.windows.set([]);
    this.activeWindowId.set(null);
    this.bus.emit('window:closed_all', {}, 'WindowManager');
  }
}
