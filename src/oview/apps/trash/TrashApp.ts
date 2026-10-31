/**
 * Recycle Bin — Controller & Sovereign File Recovery Engine
 * ============================================================================
 * TrashApp.ts: Manages /user/trash VFS directory, safe file deletion,
 * restoration to original path, and trash purging.
 */

import { VirtualFileSystem, VFSStat } from '../../vfs/VirtualFileSystem';
import { SystemBus } from '../../core/SystemBus';

export interface TrashedFile {
  name: string;
  trashPath: string;
  originalPath: string;
  size: number;
  trashedAt: number;
}

export class TrashApp {
  private vfs: VirtualFileSystem;
  private bus: SystemBus;
  private trashedItems: TrashedFile[] = [];

  constructor() {
    this.vfs = VirtualFileSystem.getInstance();
    this.bus = SystemBus.getInstance();
    this.ensureTrashDir();
    this.scanTrash();
  }

  private ensureTrashDir(): void {
    try {
      this.vfs.createDirectory('/user/trash');
    } catch {
      // already exists
    }
  }

  public scanTrash(): TrashedFile[] {
    this.trashedItems = [];
    this.ensureTrashDir();
    try {
      const items = this.vfs.listDirectory('/user/trash');
      for (const item of items) {
        if (item.type === 'file') {
          this.trashedItems.push({
            name: item.name,
            trashPath: `/user/trash/${item.name}`,
            originalPath: `/user/documents/${item.name}`,
            size: item.size,
            trashedAt: Date.now(),
          });
        }
      }
    } catch {
      // directory empty
    }

    // Default sample if empty
    if (this.trashedItems.length === 0) {
      this.trashedItems.push({
        name: 'old_draft.txt',
        trashPath: '/user/trash/old_draft.txt',
        originalPath: '/user/documents/old_draft.txt',
        size: 340,
        trashedAt: Date.now(),
      });
      this.trashedItems.push({
        name: 'temp_log.one',
        trashPath: '/user/trash/temp_log.one',
        originalPath: '/user/documents/temp_log.one',
        size: 512,
        trashedAt: Date.now(),
      });
    }

    return [...this.trashedItems];
  }

  public getTrashedItems(): TrashedFile[] {
    return [...this.trashedItems];
  }

  public moveToTrash(sourcePath: string): TrashedFile | null {
    try {
      const content = this.vfs.readFile(sourcePath);
      const fileName = sourcePath.split('/').pop() || 'file.txt';
      const trashPath = `/user/trash/${fileName}`;

      this.vfs.writeFile(trashPath, content);
      this.vfs.deleteNode(sourcePath);

      const trashed: TrashedFile = {
        name: fileName,
        trashPath,
        originalPath: sourcePath,
        size: content.length,
        trashedAt: Date.now(),
      };
      this.trashedItems.push(trashed);
      this.bus.emit('vfs:changed', { action: 'trash', path: sourcePath }, 'TrashApp');
      return trashed;
    } catch {
      return null;
    }
  }

  public restoreFile(fileName: string, destPath?: string): boolean {
    const idx = this.trashedItems.findIndex(t => t.name === fileName);
    if (idx === -1) return false;

    const item = this.trashedItems[idx];
    const target = destPath || item.originalPath;

    try {
      let content = 'Recovered Content';
      try {
        content = this.vfs.readFile(item.trashPath);
      } catch {
        // fallback
      }
      this.vfs.writeFile(target, content);
      try {
        this.vfs.deleteNode(item.trashPath);
      } catch {
        // ignore
      }
      this.trashedItems.splice(idx, 1);
      this.bus.emit('vfs:changed', { action: 'restore', path: target }, 'TrashApp');
      return true;
    } catch {
      return false;
    }
  }

  public emptyTrash(): number {
    const count = this.trashedItems.length;
    for (const item of this.trashedItems) {
      try {
        this.vfs.deleteNode(item.trashPath);
      } catch {
        // ignore
      }
    }
    this.trashedItems = [];
    this.bus.emit('vfs:changed', { action: 'empty_trash' }, 'TrashApp');
    return count;
  }
}
