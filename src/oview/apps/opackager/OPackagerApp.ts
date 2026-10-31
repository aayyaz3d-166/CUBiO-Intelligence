/**
 * OPackager — Universal Software Repackager, Backup & Marketplace Studio
 * ============================================================================
 * OPackagerApp.ts: Converts external Windows/Mac software packages (.exe, .zip)
 * into sovereign .onepkg containers, saves offline backups in /user/packages/,
 * enables 1-click desktop installation, and publishes to the Oview Marketplace.
 * Address369 Spatial Memory Slot: 100
 */

import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';
import { ProcessManager } from '../../core/ProcessManager';
import { SystemBus } from '../../core/SystemBus';

export interface RawSoftwareFile {
  filename: string;
  size: number;
  type: 'exe' | 'msi' | 'dmg' | 'zip';
  suggestedName: string;
  suggestedCategory: 'utility' | 'developer' | 'media' | 'games';
  icon: string;
}

export interface OnePkgContainer {
  format: 'onepkg';
  version: string;
  appId: string;
  name: string;
  versionStr: string;
  icon: string;
  category: 'utility' | 'developer' | 'media' | 'games';
  author: string;
  originalFile: string;
  originalSize: number;
  compressedSize: number;
  checksum: string;
  createdAt: number;
  memorySlot369: number;
  isInstalled: boolean;
  isPublished: boolean;
  backupPath: string;
}

export class OPackagerApp {
  private vfs: VirtualFileSystem;
  private pm: ProcessManager;
  private bus: SystemBus;
  private rawFiles: RawSoftwareFile[] = [];
  private packages: OnePkgContainer[] = [];
  private activeTab: 'packager' | 'backups' | 'marketplace' = 'packager';

  constructor() {
    this.vfs = VirtualFileSystem.getInstance();
    this.pm = ProcessManager.getInstance();
    this.bus = SystemBus.getInstance();
    this.ensureDirs();
    this.initDefaultData();
  }

  private ensureDirs(): void {
    try { this.vfs.createDirectory('/user/packages'); } catch {}
    try { this.vfs.createDirectory('/system/marketplace'); } catch {}
  }

  private initDefaultData(): void {
    this.rawFiles = [
      {
        filename: 'putty_installer.exe',
        size: 1845012,
        type: 'exe',
        suggestedName: 'PuTTY SSH Client',
        suggestedCategory: 'developer',
        icon: '⚡'
      },
      {
        filename: '7zip_setup.exe',
        size: 1524890,
        type: 'exe',
        suggestedName: '7-Zip Archiver Pro',
        suggestedCategory: 'utility',
        icon: '📦'
      },
      {
        filename: 'retro_arcade_invaders.zip',
        size: 3412500,
        type: 'zip',
        suggestedName: 'Retro Space Invaders',
        suggestedCategory: 'games',
        icon: '👾'
      }
    ];

    // Pre-populate with converted PuTTY sample in backup
    const samplePkg: OnePkgContainer = {
      format: 'onepkg',
      version: '1.0.0',
      appId: 'onepkg.putty_ssh',
      name: 'PuTTY SSH Client',
      versionStr: '0.81.0',
      icon: '⚡',
      category: 'developer',
      author: 'Community Repacker',
      originalFile: 'putty_installer.exe',
      originalSize: 1845012,
      compressedSize: 612450,
      checksum: 'sha256:7d832a8910b89...',
      createdAt: Date.now() - 3600000,
      memorySlot369: 105,
      isInstalled: false,
      isPublished: true,
      backupPath: '/user/packages/putty_ssh.onepkg'
    };
    this.packages.push(samplePkg);
    this.saveBackup(samplePkg.appId);
  }

  public getRawFiles(): RawSoftwareFile[] {
    return [...this.rawFiles];
  }

  public convertFileToOnePkg(raw: RawSoftwareFile, customName?: string): OnePkgContainer {
    const slug = (customName || raw.suggestedName).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const appId = `onepkg.${slug}`;
    const name = customName || raw.suggestedName;

    // Check if already exists
    const existing = this.packages.find(p => p.appId === appId);
    if (existing) return existing;

    const compressedSize = Math.floor(raw.size * 0.42); // 58% sovereign compression
    const checksum = `sha256:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const backupPath = `/user/packages/${slug}.onepkg`;

    const pkg: OnePkgContainer = {
      format: 'onepkg',
      version: '1.0.0',
      appId,
      name,
      versionStr: '1.0.0',
      icon: raw.icon,
      category: raw.suggestedCategory,
      author: 'Oview Local Repacker',
      originalFile: raw.filename,
      originalSize: raw.size,
      compressedSize,
      checksum,
      createdAt: Date.now(),
      memorySlot369: Math.min(359, 105 + (this.packages.length * 5)),
      isInstalled: false,
      isPublished: false,
      backupPath
    };

    this.packages.unshift(pkg);
    this.saveBackup(appId);
    this.bus.emit('opackager:package_created', pkg, 'OPackagerApp');
    return pkg;
  }

  public saveBackup(appId: string): string | null {
    const pkg = this.packages.find(p => p.appId === appId);
    if (!pkg) return null;

    try {
      this.ensureDirs();
      const content = JSON.stringify(pkg, null, 2);
      this.vfs.writeFile(pkg.backupPath, content);
      this.bus.emit('opackager:backup_saved', { path: pkg.backupPath }, 'OPackagerApp');
      return pkg.backupPath;
    } catch {
      return null;
    }
  }

  public installPackage(appId: string): boolean {
    const pkg = this.packages.find(p => p.appId === appId);
    if (!pkg) return false;

    // Register into ProcessManager dynamically
    this.pm.registerApp({
      id: pkg.appId,
      name: pkg.name,
      icon: pkg.icon,
      category: pkg.category,
      description: `Converted from ${pkg.originalFile} into Sovereign .onepkg container`,
      defaultWidth: 700,
      defaultHeight: 460,
      memorySlot369: pkg.memorySlot369,
      singleInstance: true
    });

    pkg.isInstalled = true;
    this.bus.emit('opackager:installed', { appId, name: pkg.name }, 'OPackagerApp');
    return true;
  }

  public publishToMarketplace(appId: string): boolean {
    const pkg = this.packages.find(p => p.appId === appId);
    if (!pkg) return false;

    try {
      this.ensureDirs();
      const marketPath = `/system/marketplace/${pkg.appId}.json`;
      this.vfs.writeFile(marketPath, JSON.stringify(pkg, null, 2));
      pkg.isPublished = true;
      this.bus.emit('opackager:published', { appId, name: pkg.name }, 'OPackagerApp');
      return true;
    } catch {
      return false;
    }
  }

  public getBackups(): OnePkgContainer[] {
    return [...this.packages];
  }

  public getMarketplacePackages(): OnePkgContainer[] {
    return this.packages.filter(p => p.isPublished);
  }

  public setTab(tab: 'packager' | 'backups' | 'marketplace'): void {
    this.activeTab = tab;
  }

  public getTab(): string {
    return this.activeTab;
  }
}
