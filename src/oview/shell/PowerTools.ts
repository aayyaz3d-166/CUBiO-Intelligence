/**
 * Windows Power-Tools — Shell Subsystem
 * ============================================================================
 * PowerTools.ts: Provides Alt+Tab Visual Window Switcher, Aero Snap 2.0
 * Quadrant/Edge Snapping, and Universal Clipboard History (Win+V).
 */

import { SystemBus } from '../core/SystemBus';

export type SnapZone =
  | 'none'
  | 'maximize'
  | 'left-half'
  | 'right-half'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface SnapGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AltTabWindowItem {
  id: string;
  appId: string;
  title: string;
  icon: string;
}

export interface ClipboardItem {
  id: string;
  text: string;
  sourceApp: string;
  timestamp: number;
  isPinned: boolean;
}

export class AltTabManager {
  private static instance: AltTabManager | null = null;

  public static getInstance(): AltTabManager {
    if (!AltTabManager.instance) {
      AltTabManager.instance = new AltTabManager();
    }
    return AltTabManager.instance;
  }

  public static resetInstance(): void {
    AltTabManager.instance = null;
  }

  private isVisible: boolean = false;
  private selectedIndex: number = 0;
  private windowItems: AltTabWindowItem[] = [];
  private bus: SystemBus;

  private constructor() {
    this.bus = SystemBus.getInstance();
  }

  public open(windows: AltTabWindowItem[]): void {
    if (windows.length === 0) return;
    this.windowItems = [...windows];
    this.selectedIndex = windows.length > 1 ? 1 : 0;
    this.isVisible = true;
    this.bus.emit('shell:alttab_opened', { count: windows.length }, 'AltTabManager');
  }

  public close(): AltTabWindowItem | null {
    if (!this.isVisible) return null;
    this.isVisible = false;
    const selected = this.windowItems[this.selectedIndex] || null;
    if (selected) {
      this.bus.emit('shell:alttab_selected', { windowId: selected.id }, 'AltTabManager');
    }
    return selected;
  }

  public cycleNext(): number {
    if (this.windowItems.length === 0) return 0;
    this.selectedIndex = (this.selectedIndex + 1) % this.windowItems.length;
    return this.selectedIndex;
  }

  public cyclePrev(): number {
    if (this.windowItems.length === 0) return 0;
    this.selectedIndex = (this.selectedIndex - 1 + this.windowItems.length) % this.windowItems.length;
    return this.selectedIndex;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  public getItems(): AltTabWindowItem[] {
    return [...this.windowItems];
  }
}

export class SnapManager {
  private static instance: SnapManager | null = null;

  public static getInstance(): SnapManager {
    if (!SnapManager.instance) {
      SnapManager.instance = new SnapManager();
    }
    return SnapManager.instance;
  }

  public static resetInstance(): void {
    SnapManager.instance = null;
  }

  private thresholdEdge: number = 24;
  private thresholdCorner: number = 36;

  public detectSnapZone(x: number, y: number, screenWidth: number, screenHeight: number): SnapZone {
    const isLeft = x <= this.thresholdEdge;
    const isRight = x >= screenWidth - this.thresholdEdge;
    const isTop = y <= this.thresholdEdge;
    const isBottom = y >= screenHeight - this.thresholdEdge;

    // Corner Checks (25% quadrant quarter snap)
    if (x <= this.thresholdCorner && y <= this.thresholdCorner) return 'top-left';
    if (x >= screenWidth - this.thresholdCorner && y <= this.thresholdCorner) return 'top-right';
    if (x <= this.thresholdCorner && y >= screenHeight - this.thresholdCorner) return 'bottom-left';
    if (x >= screenWidth - this.thresholdCorner && y >= screenHeight - this.thresholdCorner) return 'bottom-right';

    // Edge Checks
    if (isTop) return 'maximize';
    if (isLeft) return 'left-half';
    if (isRight) return 'right-half';

    return 'none';
  }

  public getSnapGeometry(zone: SnapZone, screenWidth: number, screenHeight: number, taskbarHeight: number = 48): SnapGeometry | null {
    const usableHeight = screenHeight - taskbarHeight;
    const halfWidth = Math.floor(screenWidth / 2);
    const halfHeight = Math.floor(usableHeight / 2);

    switch (zone) {
      case 'maximize':
        return { x: 0, y: 0, width: screenWidth, height: usableHeight };
      case 'left-half':
        return { x: 0, y: 0, width: halfWidth, height: usableHeight };
      case 'right-half':
        return { x: halfWidth, y: 0, width: halfWidth, height: usableHeight };
      case 'top-left':
        return { x: 0, y: 0, width: halfWidth, height: halfHeight };
      case 'top-right':
        return { x: halfWidth, y: 0, width: halfWidth, height: halfHeight };
      case 'bottom-left':
        return { x: 0, y: halfHeight, width: halfWidth, height: halfHeight };
      case 'bottom-right':
        return { x: halfWidth, y: halfHeight, width: halfWidth, height: halfHeight };
      default:
        return null;
    }
  }
}

export class ClipboardHistoryManager {
  private static instance: ClipboardHistoryManager | null = null;

  public static getInstance(): ClipboardHistoryManager {
    if (!ClipboardHistoryManager.instance) {
      ClipboardHistoryManager.instance = new ClipboardHistoryManager();
    }
    return ClipboardHistoryManager.instance;
  }

  public static resetInstance(): void {
    ClipboardHistoryManager.instance = null;
  }

  private items: ClipboardItem[] = [];
  private isVisible: boolean = false;
  private maxItems: number = 10;
  private bus: SystemBus;

  private constructor() {
    this.bus = SystemBus.getInstance();
    // Default sample snippets
    this.items = [
      {
        id: 'clip_1',
        text: 'Address369 Spatial Memory Slot Invariant E9001',
        sourceApp: 'oview.notepad',
        timestamp: Date.now() - 60000,
        isPinned: true
      },
      {
        id: 'clip_2',
        text: 'print "Hello Sovereign Computing!";',
        sourceApp: 'oview.terminal',
        timestamp: Date.now() - 30000,
        isPinned: false
      },
      {
        id: 'clip_3',
        text: '204.8M ops/sec Qplayer VM Target',
        sourceApp: 'oview.calculator',
        timestamp: Date.now() - 10000,
        isPinned: false
      }
    ];
  }

  public push(text: string, sourceApp: string = 'system'): ClipboardItem | null {
    if (!text || text.trim().length === 0) return null;

    // Avoid consecutive duplicates
    if (this.items.length > 0 && this.items[0].text === text) {
      return this.items[0];
    }

    const item: ClipboardItem = {
      id: `clip_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      text,
      sourceApp,
      timestamp: Date.now(),
      isPinned: false
    };

    this.items.unshift(item);

    // Enforce maxItems while preserving pinned items
    if (this.items.length > this.maxItems) {
      // Find last unpinned item to drop
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (!this.items[i].isPinned) {
          this.items.splice(i, 1);
          break;
        }
      }
    }

    this.bus.emit('clipboard:item_added', item, 'ClipboardHistory');
    return item;
  }

  public getItems(): ClipboardItem[] {
    return [...this.items];
  }

  public togglePin(id: string): boolean {
    const item = this.items.find(i => i.id === id);
    if (!item) return false;
    item.isPinned = !item.isPinned;
    return item.isPinned;
  }

  public deleteItem(id: string): boolean {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }

  public clearAll(): void {
    // Only keep pinned items
    this.items = this.items.filter(i => i.isPinned);
  }

  public toggleVisibility(): boolean {
    this.isVisible = !this.isVisible;
    return this.isVisible;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }
}
