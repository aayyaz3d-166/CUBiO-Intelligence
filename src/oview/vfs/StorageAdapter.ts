/**
 * Oview OS — Sovereign VFS Storage Adapter & Host Sync Bridge
 * ============================================================
 * StorageAdapter.ts: Local disk persistence driver, auto-save engine,
 * and bi-directional host filesystem import/export bridge (Windows/Mac).
 */

import * as fs from 'fs';
import * as path from 'path';
import { VirtualFileSystem } from './VirtualFileSystem';
import { SystemBus } from '../core/SystemBus';

export interface HostSyncResult {
  importedFiles: number;
  importedDirs: number;
  totalBytes: number;
}

export class StorageAdapter {
  private static instance: StorageAdapter | null = null;
  private get vfs(): VirtualFileSystem {
    return VirtualFileSystem.getInstance();
  }
  private get bus(): SystemBus {
    return SystemBus.getInstance();
  }
  private defaultStatePath: string;
  private autoSaveTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.defaultStatePath = path.resolve(process.cwd(), 'data/oview_vfs_state.json');
  }

  public static getInstance(): StorageAdapter {
    if (!StorageAdapter.instance) {
      StorageAdapter.instance = new StorageAdapter();
    }
    return StorageAdapter.instance;
  }

  public static resetInstance(): void {
    if (StorageAdapter.instance) {
      StorageAdapter.instance.disableAutoSave();
    }
    StorageAdapter.instance = new StorageAdapter();
  }

  /**
   * Persists the entire VFS state to a JSON file on host disk.
   */
  public saveToDisk(filePath?: string): string {
    const targetPath = filePath || this.defaultStatePath;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    const serialized = this.vfs.serialize();
    const payload = JSON.stringify(
      {
        version: '1.0.0',
        savedAt: Date.now(),
        nodeCount: this.vfs.countNodes(),
        root: serialized,
      },
      null,
      2
    );

    fs.writeFileSync(targetPath, payload, 'utf-8');
    this.bus.emit('storage:saved', { path: targetPath, size: Buffer.byteLength(payload) }, 'StorageAdapter');
    return targetPath;
  }

  /**
   * Loads and restores the VFS state from a persistent JSON file.
   */
  public loadFromDisk(filePath?: string): boolean {
    const targetPath = filePath || this.defaultStatePath;
    if (!fs.existsSync(targetPath)) {
      return false;
    }

    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.root) {
        this.vfs.deserialize(parsed.root);
        this.bus.emit('storage:loaded', { path: targetPath, nodeCount: parsed.nodeCount }, 'StorageAdapter');
        return true;
      }
    } catch (err) {
      console.error(`[StorageAdapter Error] Failed to load VFS state from '${targetPath}':`, err);
    }
    return false;
  }

  /**
   * Enables auto-save whenever files change or periodically.
   */
  public enableAutoSave(intervalMs: number = 5000): void {
    this.disableAutoSave();
    this.autoSaveTimer = setInterval(() => {
      try {
        this.saveToDisk();
      } catch {
        // ignore
      }
    }, intervalMs);
  }

  /**
   * Disables periodic auto-save.
   */
  public disableAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Imports a single file from the host filesystem into VFS.
   */
  public importFromHost(hostPath: string, vfsPath: string): boolean {
    const absHost = path.resolve(hostPath);
    if (!fs.existsSync(absHost) || fs.statSync(absHost).isDirectory()) {
      return false;
    }

    const content = fs.readFileSync(absHost, 'utf-8');
    this.vfs.writeFile(vfsPath, content);
    this.bus.emit('storage:imported', { hostPath: absHost, vfsPath }, 'StorageAdapter');
    return true;
  }

  /**
   * Exports a VFS file out to the host filesystem.
   */
  public exportToHost(vfsPath: string, hostPath: string): boolean {
    if (!this.vfs.exists(vfsPath)) {
      return false;
    }

    const content = this.vfs.readFile(vfsPath);
    const absHost = path.resolve(hostPath);
    fs.mkdirSync(path.dirname(absHost), { recursive: true });
    fs.writeFileSync(absHost, content, 'utf-8');
    this.bus.emit('storage:exported', { vfsPath, hostPath: absHost }, 'StorageAdapter');
    return true;
  }

  /**
   * Recursively imports a complete directory from host into VFS.
   */
  public syncHostDirectory(hostDir: string, vfsTargetDir: string): HostSyncResult {
    const absHost = path.resolve(hostDir);
    if (!fs.existsSync(absHost) || !fs.statSync(absHost).isDirectory()) {
      throw new Error(`[StorageAdapter Error] Host directory '${hostDir}' does not exist.`);
    }

    let importedFiles = 0;
    let importedDirs = 0;
    let totalBytes = 0;

    const walk = (currentHostDir: string, currentVfsDir: string) => {
      this.vfs.createDirectory(currentVfsDir);
      importedDirs++;

      const entries = fs.readdirSync(currentHostDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullHost = path.join(currentHostDir, entry.name);
        const fullVfs = `${currentVfsDir === '/' ? '' : currentVfsDir}/${entry.name}`;

        if (entry.isDirectory()) {
          walk(fullHost, fullVfs);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullHost, 'utf-8');
          this.vfs.writeFile(fullVfs, content);
          importedFiles++;
          totalBytes += Buffer.byteLength(content, 'utf-8');
        }
      }
    };

    walk(absHost, vfsTargetDir);

    const result: HostSyncResult = { importedFiles, importedDirs, totalBytes };
    this.bus.emit('storage:synced', { hostDir: absHost, vfsTargetDir, result }, 'StorageAdapter');
    return result;
  }
}
