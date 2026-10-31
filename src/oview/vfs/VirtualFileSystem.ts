/**
 * Oview OS — Sovereign Virtual File System (VFS)
 * ===============================================
 * VirtualFileSystem.ts: In-memory & disk-persisted hierarchical VFS providing
 * instant read/write/delete/rename operations for native applications like
 * Oview Notepad and File Explorer.
 */

import { SystemBus } from '../core/SystemBus';

export type NodeType = 'file' | 'directory';

export interface VFSNode {
  name: string;
  path: string;
  type: NodeType;
  content?: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  children?: Map<string, VFSNode>;
}

export interface VFSStat {
  name: string;
  path: string;
  type: NodeType;
  size: number;
  updatedAt: number;
}

export class VirtualFileSystem {
  private static instance: VirtualFileSystem | null = null;
  private root: VFSNode;
  private bus: SystemBus;

  private constructor() {
    this.bus = SystemBus.getInstance();
    this.root = {
      name: '/',
      path: '/',
      type: 'directory',
      size: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      children: new Map(),
    };
    this.initializeDefaultFileSystem();
  }

  public static getInstance(): VirtualFileSystem {
    if (!VirtualFileSystem.instance) {
      VirtualFileSystem.instance = new VirtualFileSystem();
    }
    return VirtualFileSystem.instance;
  }

  public static resetInstance(): void {
    VirtualFileSystem.instance = new VirtualFileSystem();
  }

  /**
   * Seeds the default Oview OS directory tree and files.
   */
  private initializeDefaultFileSystem(): void {
    // Directories
    this.createDirectory('/system');
    this.createDirectory('/apps');
    this.createDirectory('/user');
    this.createDirectory('/user/documents');
    this.createDirectory('/user/desktop');
    this.createDirectory('/user/media');
    this.createDirectory('/user/packages');
    this.createDirectory('/user/downloads');
    this.createDirectory('/user/trash');

    // System Files
    this.writeFile(
      '/system/kernel.one',
      `// Oview OS Sovereign Microkernel Descriptor (v1.0.0)\nexport const KERNEL_CONFIG = {\n  version: "1.0.0",\n  substrate: "ONE Language Core",\n  spatialSlots: 369,\n  offlineAI: "ECHO-1"\n};\n`
    );

    this.writeFile(
      '/system/oview.config',
      JSON.stringify(
        {
          theme: 'cyber-glass',
          accent: '#10b981',
          autoSave: true,
          font: 'JetBrains Mono',
          qplayerOpsPerSec: 204800000,
        },
        null,
        2
      )
    );

    // User Files
    this.writeFile(
      '/user/documents/welcome.txt',
      `Welcome to Oview OS!\n\nThe sovereign, zero-dependency, AI-native desktop operating system.\nBuilt on ONE Language, fine-grained OLTO Signals, and ECHO-1 offline brain.\n\nEnjoy pure computing freedom!`
    );

    this.writeFile(
      '/user/documents/notes.one',
      `// Sovereign Notes App Scratchpad\nfunction calculateMetrics(): String {\n    return "Status: Operational | Address369 Verified";\n}\nprint calculateMetrics();\n`
    );

    this.writeFile(
      '/user/desktop/readme.txt',
      `OVIEW OS DESKTOP SHORTCUTS:\n• Ctrl + Space: Launch ECHO-1 Offline AI Search\n• Click Start to explore System Applications\n• Draggable windows with snap, maximize, and minimize`
    );

    this.writeFile(
      '/user/packages/putty_ssh.onepkg',
      JSON.stringify({ name: 'PuTTY SSH Client', version: '0.81.0', format: 'onepkg', slot: 105 })
    );

    this.writeFile(
      '/user/media/sovereign_wave.mp3',
      '// Audio Bitstream (Synthwave 128kbps)'
    );
  }

  /**
   * Normalizes a virtual path.
   */
  public normalizePath(rawPath: string): string {
    const parts = rawPath.replace(/\\/g, '/').split('/').filter(p => p.length > 0 && p !== '.');
    const resolved: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }

    return '/' + resolved.join('/');
  }

  /**
   * Resolves a node at the given path.
   */
  private resolveNode(pathStr: string): VFSNode | null {
    const norm = this.normalizePath(pathStr);
    if (norm === '/') return this.root;

    const parts = norm.split('/').filter(Boolean);
    let current = this.root;

    for (const part of parts) {
      if (!current.children || current.type !== 'directory') {
        return null;
      }
      const next = current.children.get(part);
      if (!next) return null;
      current = next;
    }

    return current;
  }

  /**
   * Checks if a path exists.
   */
  public exists(pathStr: string): boolean {
    return this.resolveNode(pathStr) !== null;
  }

  /**
   * Creates a directory at path.
   */
  public createDirectory(pathStr: string): boolean {
    const norm = this.normalizePath(pathStr);
    if (norm === '/') return true;

    const parts = norm.split('/').filter(Boolean);
    let current = this.root;

    let currPath = '';
    for (const part of parts) {
      currPath += '/' + part;
      if (!current.children) {
        current.children = new Map();
      }

      let child = current.children.get(part);
      if (!child) {
        child = {
          name: part,
          path: currPath,
          type: 'directory',
          size: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          children: new Map(),
        };
        current.children.set(part, child);
      } else if (child.type !== 'directory') {
        return false;
      }
      current = child;
    }

    this.bus.emit('vfs:changed', { action: 'create_dir', path: norm }, 'VFS');
    return true;
  }

  /**
   * Reads file content.
   */
  public readFile(pathStr: string): string {
    const node = this.resolveNode(pathStr);
    if (!node) {
      throw new Error(`[VFS Error] File not found: '${pathStr}'`);
    }
    if (node.type !== 'file') {
      throw new Error(`[VFS Error] Path is a directory: '${pathStr}'`);
    }
    return node.content || '';
  }

  /**
   * Writes content to a file, creating it and parent directories if necessary.
   */
  public writeFile(pathStr: string, content: string): void {
    const norm = this.normalizePath(pathStr);
    const parts = norm.split('/').filter(Boolean);
    if (parts.length === 0) {
      throw new Error(`[VFS Error] Cannot write to root directory`);
    }

    const fileName = parts[parts.length - 1];
    const dirPath = '/' + parts.slice(0, parts.length - 1).join('/');

    this.createDirectory(dirPath);
    const parentNode = this.resolveNode(dirPath);
    if (!parentNode || !parentNode.children) {
      throw new Error(`[VFS Error] Failed to resolve parent directory: '${dirPath}'`);
    }

    const existing = parentNode.children.get(fileName);
    const size = Buffer.byteLength(content, 'utf-8');
    const now = Date.now();

    if (existing) {
      if (existing.type !== 'file') {
        throw new Error(`[VFS Error] Path '${norm}' exists and is a directory`);
      }
      existing.content = content;
      existing.size = size;
      existing.updatedAt = now;
    } else {
      const newNode: VFSNode = {
        name: fileName,
        path: norm,
        type: 'file',
        content,
        size,
        createdAt: now,
        updatedAt: now,
      };
      parentNode.children.set(fileName, newNode);
    }

    this.bus.emit('vfs:changed', { action: 'write_file', path: norm }, 'VFS');
  }

  /**
   * Lists items in a directory.
   */
  public listDirectory(pathStr: string): VFSStat[] {
    const node = this.resolveNode(pathStr);
    if (!node) {
      throw new Error(`[VFS Error] Directory not found: '${pathStr}'`);
    }
    if (node.type !== 'directory' || !node.children) {
      throw new Error(`[VFS Error] Path is not a directory: '${pathStr}'`);
    }

    const results: VFSStat[] = [];
    for (const child of node.children.values()) {
      results.push({
        name: child.name,
        path: child.path,
        type: child.type,
        size: child.size,
        updatedAt: child.updatedAt,
      });
    }

    // Sort: directories first, then alphabetically
    return results.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Deletes a file or directory.
   */
  public deleteNode(pathStr: string): boolean {
    const norm = this.normalizePath(pathStr);
    if (norm === '/') return false;

    const parts = norm.split('/').filter(Boolean);
    const targetName = parts[parts.length - 1];
    const parentPath = '/' + parts.slice(0, parts.length - 1).join('/');

    const parentNode = this.resolveNode(parentPath);
    if (!parentNode || !parentNode.children) return false;

    const deleted = parentNode.children.delete(targetName);
    if (deleted) {
      this.bus.emit('vfs:changed', { action: 'delete', path: norm }, 'VFS');
    }
    return deleted;
  }

  /**
   * Renames a node.
   */
  public renameNode(oldPath: string, newPath: string): boolean {
    const normOld = this.normalizePath(oldPath);
    const normNew = this.normalizePath(newPath);
    if (normOld === '/' || normNew === '/') return false;

    const node = this.resolveNode(normOld);
    if (!node) return false;

    const oldParts = normOld.split('/').filter(Boolean);
    const oldParentPath = '/' + oldParts.slice(0, oldParts.length - 1).join('/');
    const oldParent = this.resolveNode(oldParentPath);
    if (!oldParent || !oldParent.children) return false;

    const newParts = normNew.split('/').filter(Boolean);
    const newName = newParts[newParts.length - 1];
    const newParentPath = '/' + newParts.slice(0, newParts.length - 1).join('/');
    const newParent = this.resolveNode(newParentPath);
    if (!newParent || !newParent.children) return false;

    // Remove from old parent
    oldParent.children.delete(node.name);

    // Update node
    node.name = newName;
    node.path = normNew;
    node.updatedAt = Date.now();

    // Add to new parent
    newParent.children.set(newName, node);

    this.bus.emit('vfs:changed', { action: 'rename', oldPath: normOld, newPath: normNew }, 'VFS');
    return true;
  }

  /**
   * Returns stat information for a path.
   */
  public stat(pathStr: string): VFSStat {
    const node = this.resolveNode(pathStr);
    if (!node) {
      throw new Error(`[VFS Error] Path not found: '${pathStr}'`);
    }
    return {
      name: node.name,
      path: node.path,
      type: node.type,
      size: node.size,
      updatedAt: node.updatedAt,
    };
  }

  /**
   * Recursively serializes the VFS tree into a JSON-safe object.
   */
  public serialize(): any {
    const serializeNode = (node: VFSNode): any => {
      const out: any = {
        name: node.name,
        path: node.path,
        type: node.type,
        size: node.size,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      };
      if (node.content !== undefined) {
        out.content = node.content;
      }
      if (node.children) {
        out.children = {};
        for (const [k, v] of node.children.entries()) {
          out.children[k] = serializeNode(v);
        }
      }
      return out;
    };
    return serializeNode(this.root);
  }

  /**
   * Deserializes and restores the VFS tree from a JSON-safe object.
   */
  public deserialize(data: any): void {
    const deserializeNode = (obj: any): VFSNode => {
      const node: VFSNode = {
        name: obj.name,
        path: obj.path,
        type: obj.type,
        size: obj.size,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        content: obj.content,
      };
      if (obj.children) {
        node.children = new Map();
        for (const [k, v] of Object.entries(obj.children)) {
          node.children.set(k, deserializeNode(v));
        }
      }
      return node;
    };

    this.root = deserializeNode(data);
    this.bus.emit('vfs:restored', { timestamp: Date.now() }, 'VFS');
  }

  /**
   * Counts total nodes (files + directories) in the VFS tree.
   */
  public countNodes(): number {
    let count = 0;
    const walk = (node: VFSNode) => {
      count++;
      if (node.children) {
        for (const child of node.children.values()) {
          walk(child);
        }
      }
    };
    walk(this.root);
    return count;
  }
}
