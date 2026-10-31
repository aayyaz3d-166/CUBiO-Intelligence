/**
 * Desktop Context Menu — Shell Subsystem
 * ============================================================================
 * ContextMenu.ts: Coordinates right-click desktop events, positioning,
 * and context actions (New Note, New Folder, Wallpaper, Settings).
 */

import { VirtualFileSystem } from '../vfs/VirtualFileSystem';
import { SystemBus } from '../core/SystemBus';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export class ContextMenuManager {
  private static instance: ContextMenuManager | null = null;

  public static getInstance(): ContextMenuManager {
    if (!ContextMenuManager.instance) {
      ContextMenuManager.instance = new ContextMenuManager();
    }
    return ContextMenuManager.instance;
  }

  public static resetInstance(): void {
    ContextMenuManager.instance = null;
  }

  private isVisible: boolean = false;
  private position: ContextMenuPosition = { x: 0, y: 0 };
  private vfs: VirtualFileSystem;
  private bus: SystemBus;

  private constructor() {
    this.vfs = VirtualFileSystem.getInstance();
    this.bus = SystemBus.getInstance();
  }

  public open(x: number, y: number): void {
    this.position = { x, y };
    this.isVisible = true;
  }

  public close(): void {
    this.isVisible = false;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public getPosition(): ContextMenuPosition {
    return { ...this.position };
  }

  public createNewNote(): string {
    const fileName = `note_${Date.now()}.txt`;
    const fullPath = `/user/desktop/${fileName}`;
    this.vfs.writeFile(fullPath, '// New Sovereign Desktop Note\nWrite your thoughts here...');
    this.close();
    this.bus.emit('vfs:changed', { action: 'create', path: fullPath }, 'ContextMenu');
    return fullPath;
  }

  public createNewFolder(): string {
    const folderName = `Folder_${Date.now()}`;
    const fullPath = `/user/desktop/${folderName}`;
    this.vfs.createDirectory(fullPath);
    this.close();
    this.bus.emit('vfs:changed', { action: 'create_dir', path: fullPath }, 'ContextMenu');
    return fullPath;
  }

  public refresh(): void {
    this.close();
    this.bus.emit('desktop:refresh', {}, 'ContextMenu');
  }
}
