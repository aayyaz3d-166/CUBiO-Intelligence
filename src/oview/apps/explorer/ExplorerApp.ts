/**
 * Oview OS — Sovereign File Explorer Application Controller (Phase 11: Explorer Pro)
 * ===================================================================================
 * ExplorerApp.ts: Visual folder tree browser, file management actions,
 * interactive "My Space" personal dashboard, starred/pinned favorites,
 * recent activity tracking, storage health metrics, and quick-look preview.
 */

import { VirtualFileSystem, VFSStat } from '../../vfs/VirtualFileSystem';
import { OltoDOMRenderer, OltoDOMElement } from '../../../olto/runtime/OltoDOMRenderer';

export interface MySpaceCategory {
  id: string;
  name: string;
  path: string;
  icon: string;
  itemCount: number;
  totalSize: number;
}

export interface PinnedItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  icon: string;
  pinnedAt: number;
}

export interface RecentItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  timeAgo: string;
  accessedAt: number;
}

export interface StorageMetrics {
  usedBytes: number;
  totalBytes: number;
  usagePercent: number;
  docsBytes: number;
  mediaBytes: number;
  packagesBytes: number;
  systemBytes: number;
  otherBytes: number;
}

export class ExplorerApp {
  private vfs: VirtualFileSystem;
  public currentPath: string = 'myspace'; // Default to My Space dashboard!
  public history: string[] = ['myspace'];
  public historyIndex: number = 0;
  public selectedItem: string | null = null;
  public previewPath: string | null = null;
  public activeCategoryFilter: string = 'all';
  public searchQuery: string = '';

  private pinnedPaths: Set<string> = new Set([
    '/user/documents/welcome.txt',
    '/user/documents/notes.one',
    '/user/packages/putty_ssh.onepkg',
  ]);

  private recentHistory: Array<{ path: string; accessedAt: number }> = [
    { path: '/user/documents/welcome.txt', accessedAt: Date.now() - 1000 * 60 * 5 }, // 5 mins ago
    { path: '/user/documents/notes.one', accessedAt: Date.now() - 1000 * 60 * 30 }, // 30 mins ago
    { path: '/user/media/sovereign_wave.mp3', accessedAt: Date.now() - 1000 * 60 * 60 * 2 }, // 2 hours ago
  ];

  constructor(initialPath: string = 'myspace', vfs?: VirtualFileSystem) {
    this.vfs = vfs || VirtualFileSystem.getInstance();
    this.ensureDefaultDirectories();
    if (initialPath === 'myspace' || this.vfs.exists(initialPath)) {
      this.currentPath = initialPath === 'myspace' ? 'myspace' : this.vfs.normalizePath(initialPath);
    }
    this.history = [this.currentPath];
    this.historyIndex = 0;
  }

  private ensureDefaultDirectories(): void {
    const dirs = ['/user/documents', '/user/media', '/user/packages', '/user/downloads', '/user/trash'];
    for (const dir of dirs) {
      if (!this.vfs.exists(dir)) {
        try {
          this.vfs.createDirectory(dir);
        } catch {
          // directory might exist in tree
        }
      }
    }
  }

  public isMySpace(): boolean {
    return this.currentPath === 'myspace';
  }

  public navigateToMySpace(): void {
    this.navigate('myspace');
  }

  public navigate(pathStr: string): boolean {
    if (pathStr === 'myspace') {
      this.currentPath = 'myspace';
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push('myspace');
      this.historyIndex = this.history.length - 1;
      this.selectedItem = null;
      this.previewPath = null;
      return true;
    }

    const norm = this.vfs.normalizePath(pathStr);
    if (!this.vfs.exists(norm)) return false;

    const stat = this.vfs.stat(norm);
    if (stat.type !== 'directory') return false;

    this.currentPath = norm;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(norm);
    this.historyIndex = this.history.length - 1;
    this.selectedItem = null;
    this.previewPath = null;
    return true;
  }

  public navigateUp(): boolean {
    if (this.currentPath === 'myspace') return false;
    if (this.currentPath === '/') {
      return this.navigate('myspace');
    }
    const parts = this.currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = parts.length === 0 ? '/' : '/' + parts.join('/');
    return this.navigate(parentPath);
  }

  public canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  public canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  public goBack(): boolean {
    if (!this.canGoBack()) return false;
    this.historyIndex--;
    this.currentPath = this.history[this.historyIndex];
    this.selectedItem = null;
    this.previewPath = null;
    return true;
  }

  public goForward(): boolean {
    if (!this.canGoForward()) return false;
    this.historyIndex++;
    this.currentPath = this.history[this.historyIndex];
    this.selectedItem = null;
    this.previewPath = null;
    return true;
  }

  public getItems(): VFSStat[] {
    if (this.isMySpace()) {
      return [];
    }
    try {
      const items = this.vfs.listDirectory(this.currentPath);
      if (!this.searchQuery) return items;
      const q = this.searchQuery.toLowerCase();
      return items.filter((i) => i.name.toLowerCase().includes(q));
    } catch {
      return [];
    }
  }

  public getMySpaceCategories(): MySpaceCategory[] {
    const categories: Array<{ id: string; name: string; path: string; icon: string }> = [
      { id: 'documents', name: 'Documents', path: '/user/documents', icon: '📄' },
      { id: 'media', name: 'Pictures & Media', path: '/user/media', icon: '🖼️' },
      { id: 'packages', name: 'My Apps (.onepkg)', path: '/user/packages', icon: '📦' },
      { id: 'downloads', name: 'Downloads', path: '/user/downloads', icon: '📥' },
      { id: 'trash', name: 'Recycle Bin', path: '/user/trash', icon: '🗑️' },
    ];

    return categories.map((cat) => {
      let count = 0;
      let size = 0;
      if (this.vfs.exists(cat.path)) {
        try {
          const stats = this.vfs.listDirectory(cat.path);
          count = stats.length;
          size = stats.reduce((acc, curr) => acc + curr.size, 0);
        } catch {
          // ignore error
        }
      }
      return {
        ...cat,
        itemCount: count,
        totalSize: size,
      };
    });
  }

  public togglePin(path: string): boolean {
    if (this.pinnedPaths.has(path)) {
      this.pinnedPaths.delete(path);
      return false;
    } else {
      this.pinnedPaths.add(path);
      return true;
    }
  }

  public isPinned(path: string): boolean {
    return this.pinnedPaths.has(path);
  }

  public getPinnedItems(): PinnedItem[] {
    const results: PinnedItem[] = [];
    for (const p of this.pinnedPaths) {
      if (this.vfs.exists(p)) {
        const stat = this.vfs.stat(p);
        results.push({
          path: p,
          name: stat.name,
          type: stat.type,
          size: stat.size,
          icon: stat.type === 'directory' ? '📁' : (stat.name.endsWith('.onepkg') ? '📦' : (stat.name.endsWith('.one') ? '⚡' : '📄')),
          pinnedAt: Date.now(),
        });
      }
    }
    return results;
  }

  public recordFileAccess(path: string): void {
    this.recentHistory = this.recentHistory.filter((r) => r.path !== path);
    this.recentHistory.unshift({ path, accessedAt: Date.now() });
    if (this.recentHistory.length > 8) {
      this.recentHistory.pop();
    }
  }

  public getRecentFiles(): RecentItem[] {
    const now = Date.now();
    const results: RecentItem[] = [];

    for (const item of this.recentHistory) {
      if (this.vfs.exists(item.path)) {
        const stat = this.vfs.stat(item.path);
        const diffMs = now - item.accessedAt;
        let timeAgo = 'Just now';
        if (diffMs > 1000 * 60 * 60) {
          timeAgo = `${Math.floor(diffMs / (1000 * 60 * 60))}h ago`;
        } else if (diffMs > 1000 * 60) {
          timeAgo = `${Math.floor(diffMs / (1000 * 60))}m ago`;
        }

        results.push({
          path: item.path,
          name: stat.name,
          type: stat.type,
          size: stat.size,
          timeAgo,
          accessedAt: item.accessedAt,
        });
      }
    }
    return results;
  }

  public getStorageMetrics(): StorageMetrics {
    const totalBytes = 500 * 1024 * 1024; // 500 MB Sovereign Quota
    let usedBytes = 0;
    let docsBytes = 0;
    let mediaBytes = 0;
    let packagesBytes = 0;
    let systemBytes = 0;
    let otherBytes = 0;

    const traverse = (p: string) => {
      try {
        const items = this.vfs.listDirectory(p);
        for (const it of items) {
          usedBytes += it.size;
          if (p.startsWith('/user/documents')) docsBytes += it.size;
          else if (p.startsWith('/user/media')) mediaBytes += it.size;
          else if (p.startsWith('/user/packages')) packagesBytes += it.size;
          else if (p.startsWith('/system')) systemBytes += it.size;
          else otherBytes += it.size;

          if (it.type === 'directory') {
            traverse(it.path);
          }
        }
      } catch {
        // leaf or inaccessible
      }
    };

    traverse('/user');
    traverse('/system');

    const usagePercent = Math.min(100, Math.round((usedBytes / totalBytes) * 100) || 1);

    return {
      usedBytes,
      totalBytes,
      usagePercent,
      docsBytes,
      mediaBytes,
      packagesBytes,
      systemBytes,
      otherBytes,
    };
  }

  public getQuickLook(path: string): { name: string; type: string; size: number; preview: string; meta: Record<string, any> } | null {
    if (!this.vfs.exists(path)) return null;
    const stat = this.vfs.stat(path);
    let preview = '';
    const meta: Record<string, any> = { path, type: stat.type, size: stat.size };

    if (stat.type === 'file') {
      try {
        const content = this.vfs.readFile(path);
        preview = content.slice(0, 500);
        if (path.endsWith('.onepkg')) {
          try {
            const parsed = JSON.parse(content);
            meta.packageName = parsed.name || stat.name;
            meta.version = parsed.version || '1.0.0';
            meta.format = 'onepkg';
          } catch {
            meta.format = 'raw-onepkg';
          }
        }
      } catch {
        preview = '(Binary or media content)';
      }
    } else {
      try {
        const items = this.vfs.listDirectory(path);
        preview = `Folder containing ${items.length} items:\n` + items.slice(0, 6).map((i) => `• ${i.name}`).join('\n');
      } catch {
        preview = 'Folder';
      }
    }

    return {
      name: stat.name,
      type: stat.type,
      size: stat.size,
      preview,
      meta,
    };
  }

  public createFile(name: string, content: string = ''): boolean {
    const dir = this.isMySpace() ? '/user/documents' : this.currentPath;
    const fullPath = `${dir === '/' ? '' : dir}/${name}`;
    this.vfs.writeFile(fullPath, content);
    this.recordFileAccess(fullPath);
    return true;
  }

  public createFolder(name: string): boolean {
    const dir = this.isMySpace() ? '/user/documents' : this.currentPath;
    const fullPath = `${dir === '/' ? '' : dir}/${name}`;
    return this.vfs.createDirectory(fullPath);
  }

  public deleteItem(name: string): boolean {
    const dir = this.isMySpace() ? '/user/documents' : this.currentPath;
    const fullPath = `${dir === '/' ? '' : dir}/${name}`;
    return this.vfs.deleteNode(fullPath);
  }

  /**
   * Universal DOM Renderer for File Explorer Pro GUI.
   */
  public renderToElement(): OltoDOMElement {
    const container = OltoDOMRenderer.createElement('div');
    container.setAttribute('class', 'oview-app-explorer-pro');
    container.setAttribute(
      'style',
      'display: flex; flex-direction: column; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f8fafc; background: #0f172a;'
    );

    // 1. Navigation / Address Bar
    const navBar = OltoDOMRenderer.createElement('div');
    navBar.setAttribute(
      'style',
      'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(0,0,0,0.25);'
    );

    const leftControls = OltoDOMRenderer.createElement('div');
    leftControls.setAttribute('style', 'display: flex; align-items: center; gap: 8px;');

    const mySpaceBtn = OltoDOMRenderer.createElement('button');
    mySpaceBtn.setAttribute(
      'style',
      `padding: 4px 10px; border-radius: 6px; border: 1px solid ${this.isMySpace() ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}; background: ${this.isMySpace() ? 'rgba(16,185,129,0.2)' : 'transparent'}; color: ${this.isMySpace() ? '#10b981' : '#fff'}; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;`
    );
    mySpaceBtn.appendChild(OltoDOMRenderer.createTextNode('🏠 My Space'));
    leftControls.appendChild(mySpaceBtn);

    const backBtn = OltoDOMRenderer.createElement('button');
    backBtn.setAttribute(
      'style',
      `padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: ${this.canGoBack() ? '#fff' : '#64748b'}; cursor: ${this.canGoBack() ? 'pointer' : 'default'}; font-size: 11px;`
    );
    backBtn.appendChild(OltoDOMRenderer.createTextNode('◀'));
    leftControls.appendChild(backBtn);

    const fwdBtn = OltoDOMRenderer.createElement('button');
    fwdBtn.setAttribute(
      'style',
      `padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: ${this.canGoForward() ? '#fff' : '#64748b'}; cursor: ${this.canGoForward() ? 'pointer' : 'default'}; font-size: 11px;`
    );
    fwdBtn.appendChild(OltoDOMRenderer.createTextNode('▶'));
    leftControls.appendChild(fwdBtn);

    const upBtn = OltoDOMRenderer.createElement('button');
    upBtn.setAttribute('style', 'padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #fff; cursor: pointer; font-size: 11px;');
    upBtn.appendChild(OltoDOMRenderer.createTextNode('▲ Up'));
    leftControls.appendChild(upBtn);

    // Address Bar Pill
    const addr = OltoDOMRenderer.createElement('div');
    addr.setAttribute(
      'style',
      'padding: 4px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 12px; font-weight: 600; color: #10b981; font-family: monospace;'
    );
    addr.appendChild(OltoDOMRenderer.createTextNode(this.isMySpace() ? '🏠 My Space' : this.currentPath));
    leftControls.appendChild(addr);

    navBar.appendChild(leftControls);

    // Actions
    const actionGroup = OltoDOMRenderer.createElement('div');
    actionGroup.setAttribute('style', 'display: flex; gap: 6px;');

    const newFileBtn = OltoDOMRenderer.createElement('button');
    newFileBtn.setAttribute('style', 'padding: 4px 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #10b981; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;');
    newFileBtn.appendChild(OltoDOMRenderer.createTextNode('+ New File'));
    actionGroup.appendChild(newFileBtn);

    const newDirBtn = OltoDOMRenderer.createElement('button');
    newDirBtn.setAttribute('style', 'padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px; font-size: 11px; cursor: pointer;');
    newDirBtn.appendChild(OltoDOMRenderer.createTextNode('+ Folder'));
    actionGroup.appendChild(newDirBtn);

    navBar.appendChild(actionGroup);
    container.appendChild(navBar);

    // 2. Main Body (Sidebar + Content View)
    const body = OltoDOMRenderer.createElement('div');
    body.setAttribute('style', 'display: flex; flex: 1; overflow: hidden;');

    // Sidebar
    const sidebar = OltoDOMRenderer.createElement('div');
    sidebar.setAttribute(
      'style',
      'width: 170px; border-right: 1px solid rgba(255, 255, 255, 0.08); padding: 12px 8px; display: flex; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.15); font-size: 12px;'
    );

    const sideLabel1 = OltoDOMRenderer.createElement('span');
    sideLabel1.setAttribute('style', 'font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; padding: 4px 8px;');
    sideLabel1.appendChild(OltoDOMRenderer.createTextNode('MY SPACE'));
    sidebar.appendChild(sideLabel1);

    const locations = [
      { name: 'My Space', path: 'myspace', icon: '🏠' },
      { name: 'Documents', path: '/user/documents', icon: '📄' },
      { name: 'Pictures', path: '/user/media', icon: '🖼️' },
      { name: 'My Apps', path: '/user/packages', icon: '📦' },
      { name: 'Downloads', path: '/user/downloads', icon: '📥' },
      { name: 'Recycle Bin', path: '/user/trash', icon: '🗑️' },
    ];

    for (const loc of locations) {
      const isSelected = this.currentPath === loc.path;
      const item = OltoDOMRenderer.createElement('div');
      item.setAttribute(
        'style',
        `display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; background: ${isSelected ? 'rgba(16,185,129,0.18)' : 'transparent'}; color: ${isSelected ? '#10b981' : '#f8fafc'}; font-weight: ${isSelected ? '600' : 'normal'};`
      );

      const ic = OltoDOMRenderer.createElement('span');
      ic.appendChild(OltoDOMRenderer.createTextNode(loc.icon));
      const lbl = OltoDOMRenderer.createElement('span');
      lbl.appendChild(OltoDOMRenderer.createTextNode(loc.name));

      item.appendChild(ic);
      item.appendChild(lbl);
      sidebar.appendChild(item);
    }

    // Storage Meter in Sidebar
    const metrics = this.getStorageMetrics();
    const storageBox = OltoDOMRenderer.createElement('div');
    storageBox.setAttribute(
      'style',
      'margin-top: auto; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); font-size: 11px;'
    );
    const storTitle = OltoDOMRenderer.createElement('div');
    storTitle.setAttribute('style', 'color: #94a3b8; font-size: 10px; font-weight: 700; margin-bottom: 6px;');
    storTitle.appendChild(OltoDOMRenderer.createTextNode('STORAGE HEALTH'));
    storageBox.appendChild(storTitle);

    const progBar = OltoDOMRenderer.createElement('div');
    progBar.setAttribute('style', 'height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 6px;');
    const progFill = OltoDOMRenderer.createElement('div');
    progFill.setAttribute('style', `height: 100%; width: ${metrics.usagePercent}%; background: linear-gradient(90deg, #10b981, #06b6d4);`);
    progBar.appendChild(progFill);
    storageBox.appendChild(progBar);

    const storInfo = OltoDOMRenderer.createElement('div');
    storInfo.setAttribute('style', 'color: #64748b; font-size: 10px;');
    storInfo.appendChild(OltoDOMRenderer.createTextNode(`${metrics.usagePercent}% used (${Math.round(metrics.usedBytes / 1024)} KB / 500 MB)`));
    storageBox.appendChild(storInfo);

    sidebar.appendChild(storageBox);
    body.appendChild(sidebar);

    // Main Content Area
    const mainArea = OltoDOMRenderer.createElement('div');
    mainArea.setAttribute('style', 'flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;');

    if (this.isMySpace()) {
      // ──────────────── MY SPACE DASHBOARD ────────────────
      const hero = OltoDOMRenderer.createElement('div');
      hero.setAttribute('style', 'display: flex; justify-content: space-between; align-items: center;');
      const heroLeft = OltoDOMRenderer.createElement('div');
      const heroTitle = OltoDOMRenderer.createElement('h2');
      heroTitle.setAttribute('style', 'margin: 0; font-size: 18px; font-weight: 700; color: #fff;');
      heroTitle.appendChild(OltoDOMRenderer.createTextNode('🏠 My Space'));
      const heroSub = OltoDOMRenderer.createElement('p');
      heroSub.setAttribute('style', 'margin: 2px 0 0; font-size: 11px; color: #94a3b8;');
      heroSub.appendChild(OltoDOMRenderer.createTextNode('Your sovereign personal file hub and daily folders'));
      heroLeft.appendChild(heroTitle);
      heroLeft.appendChild(heroSub);
      hero.appendChild(heroLeft);
      mainArea.appendChild(hero);

      // Category Cards Grid
      const catsGrid = OltoDOMRenderer.createElement('div');
      catsGrid.setAttribute('style', 'display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px;');
      const categories = this.getMySpaceCategories();
      for (const cat of categories) {
        const card = OltoDOMRenderer.createElement('div');
        card.setAttribute(
          'style',
          'padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s;'
        );
        const iconSpan = OltoDOMRenderer.createElement('span');
        iconSpan.setAttribute('style', 'font-size: 24px;');
        iconSpan.appendChild(OltoDOMRenderer.createTextNode(cat.icon));
        const nameSpan = OltoDOMRenderer.createElement('div');
        nameSpan.setAttribute('style', 'font-weight: 600; font-size: 12px; color: #fff; margin-top: 6px;');
        nameSpan.appendChild(OltoDOMRenderer.createTextNode(cat.name));
        const countSpan = OltoDOMRenderer.createElement('div');
        countSpan.setAttribute('style', 'font-size: 10px; color: #94a3b8; margin-top: 2px;');
        countSpan.appendChild(OltoDOMRenderer.createTextNode(`${cat.itemCount} items`));

        card.appendChild(iconSpan);
        card.appendChild(nameSpan);
        card.appendChild(countSpan);
        catsGrid.appendChild(card);
      }
      mainArea.appendChild(catsGrid);

      // Pinned Section
      const pinSec = OltoDOMRenderer.createElement('div');
      const pinHeader = OltoDOMRenderer.createElement('div');
      pinHeader.setAttribute('style', 'font-size: 12px; font-weight: 700; color: #e2e8f0; margin-bottom: 8px;');
      pinHeader.appendChild(OltoDOMRenderer.createTextNode('⭐ Pinned & Favorites'));
      pinSec.appendChild(pinHeader);

      const pinGrid = OltoDOMRenderer.createElement('div');
      pinGrid.setAttribute('style', 'display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;');
      const pinned = this.getPinnedItems();
      for (const p of pinned) {
        const pCard = OltoDOMRenderer.createElement('div');
        pCard.setAttribute(
          'style',
          'display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer;'
        );
        const ic = OltoDOMRenderer.createElement('span');
        ic.setAttribute('style', 'font-size: 18px;');
        ic.appendChild(OltoDOMRenderer.createTextNode(p.icon));
        const txt = OltoDOMRenderer.createElement('div');
        txt.setAttribute('style', 'overflow: hidden;');
        const pName = OltoDOMRenderer.createElement('div');
        pName.setAttribute('style', 'font-size: 11px; font-weight: 600; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;');
        pName.appendChild(OltoDOMRenderer.createTextNode(p.name));
        const pSz = OltoDOMRenderer.createElement('div');
        pSz.setAttribute('style', 'font-size: 9px; color: #94a3b8;');
        pSz.appendChild(OltoDOMRenderer.createTextNode(`${p.size} B`));
        txt.appendChild(pName);
        txt.appendChild(pSz);
        pCard.appendChild(ic);
        pCard.appendChild(txt);
        pinGrid.appendChild(pCard);
      }
      pinSec.appendChild(pinGrid);
      mainArea.appendChild(pinSec);

      // Recent Activity Section
      const recSec = OltoDOMRenderer.createElement('div');
      const recHeader = OltoDOMRenderer.createElement('div');
      recHeader.setAttribute('style', 'font-size: 12px; font-weight: 700; color: #e2e8f0; margin-bottom: 8px;');
      recHeader.appendChild(OltoDOMRenderer.createTextNode('🕒 Recent Files'));
      recSec.appendChild(recHeader);

      const recList = OltoDOMRenderer.createElement('div');
      recList.setAttribute('style', 'display: flex; flex-direction: column; gap: 4px;');
      const recents = this.getRecentFiles();
      for (const r of recents) {
        const row = OltoDOMRenderer.createElement('div');
        row.setAttribute(
          'style',
          'display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; border-radius: 6px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); cursor: pointer;'
        );
        const rLeft = OltoDOMRenderer.createElement('div');
        rLeft.setAttribute('style', 'display: flex; align-items: center; gap: 8px;');
        const ic = OltoDOMRenderer.createElement('span');
        ic.appendChild(OltoDOMRenderer.createTextNode(r.name.endsWith('.onepkg') ? '📦' : (r.name.endsWith('.one') ? '⚡' : '📄')));
        const nm = OltoDOMRenderer.createElement('span');
        nm.setAttribute('style', 'font-size: 11px; font-weight: 500; color: #fff;');
        nm.appendChild(OltoDOMRenderer.createTextNode(r.name));
        rLeft.appendChild(ic);
        rLeft.appendChild(nm);

        const rRight = OltoDOMRenderer.createElement('span');
        rRight.setAttribute('style', 'font-size: 10px; color: #64748b;');
        rRight.appendChild(OltoDOMRenderer.createTextNode(r.timeAgo));

        row.appendChild(rLeft);
        row.appendChild(rRight);
        recList.appendChild(row);
      }
      recSec.appendChild(recList);
      mainArea.appendChild(recSec);
    } else {
      // ──────────────── STANDARD DIRECTORY GRID ────────────────
      const fileGrid = OltoDOMRenderer.createElement('div');
      fileGrid.setAttribute(
        'style',
        'display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; align-content: start;'
      );

      const items = this.getItems();
      for (const item of items) {
        const card = OltoDOMRenderer.createElement('div');
        card.setAttribute(
          'style',
          'display: flex; flex-direction: column; align-items: center; padding: 12px 8px; border-radius: 8px; cursor: pointer; text-align: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); transition: background 0.15s;'
        );

        const itemIcon = OltoDOMRenderer.createElement('span');
        itemIcon.setAttribute('style', 'font-size: 32px;');
        itemIcon.appendChild(OltoDOMRenderer.createTextNode(item.type === 'directory' ? '📁' : (item.name.endsWith('.onepkg') ? '📦' : (item.name.endsWith('.one') ? '⚡' : '📄'))));

        const itemName = OltoDOMRenderer.createElement('span');
        itemName.setAttribute('style', 'font-size: 11px; font-weight: 600; color: #f8fafc; margin-top: 6px; word-break: break-all;');
        itemName.appendChild(OltoDOMRenderer.createTextNode(item.name));

        const itemSize = OltoDOMRenderer.createElement('span');
        itemSize.setAttribute('style', 'font-size: 10px; color: #94a3b8; margin-top: 2px;');
        itemSize.appendChild(OltoDOMRenderer.createTextNode(item.type === 'directory' ? 'Folder' : `${item.size} B`));

        card.appendChild(itemIcon);
        card.appendChild(itemName);
        card.appendChild(itemSize);
        fileGrid.appendChild(card);
      }
      mainArea.appendChild(fileGrid);
    }

    body.appendChild(mainArea);
    container.appendChild(body);

    // 3. Status Bar
    const statusBar = OltoDOMRenderer.createElement('div');
    statusBar.setAttribute(
      'style',
      'display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px; color: #94a3b8; background: rgba(0,0,0,0.2);'
    );
    const countLabel = OltoDOMRenderer.createElement('span');
    countLabel.appendChild(OltoDOMRenderer.createTextNode(this.isMySpace() ? '🏠 My Space Hub' : `${this.getItems().length} items`));
    const vfsLabel = OltoDOMRenderer.createElement('span');
    vfsLabel.appendChild(OltoDOMRenderer.createTextNode('Sovereign In-Memory VFS (100% Offline)'));
    statusBar.appendChild(countLabel);
    statusBar.appendChild(vfsLabel);
    container.appendChild(statusBar);

    return container;
  }
}
