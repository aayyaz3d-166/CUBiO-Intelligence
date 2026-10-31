/**
 * Oview OS — Native Notepad Application Controller
 * =================================================
 * NotepadApp.ts: Multi-tab GUI text editor integrated with the Sovereign VFS,
 * live word/line statistics, and file persistence.
 */

import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';
import { OltoDOMRenderer, OltoDOMElement } from '../../../olto/runtime/OltoDOMRenderer';

export interface NotepadTab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isDirty: boolean;
}

export class NotepadApp {
  private vfs: VirtualFileSystem;
  public tabs: NotepadTab[] = [];
  public activeTabId: string = '';

  constructor(initialFilePath?: string, vfs?: VirtualFileSystem) {
    this.vfs = vfs || VirtualFileSystem.getInstance();

    if (initialFilePath && this.vfs.exists(initialFilePath)) {
      this.openFile(initialFilePath);
    } else {
      // Default to opening welcome.txt or creating untitled.txt
      if (this.vfs.exists('/user/documents/welcome.txt')) {
        this.openFile('/user/documents/welcome.txt');
      } else {
        this.createTab('untitled.txt', '');
      }
    }
  }

  public createTab(fileName: string = 'untitled.txt', content: string = ''): NotepadTab {
    const id = `tab_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tab: NotepadTab = {
      id,
      filePath: `/user/documents/${fileName}`,
      fileName,
      content,
      isDirty: false,
    };
    this.tabs.push(tab);
    this.activeTabId = id;
    return tab;
  }

  public openFile(pathStr: string): NotepadTab {
    const content = this.vfs.readFile(pathStr);
    const fileName = pathStr.split('/').pop() || 'untitled.txt';

    const existing = this.tabs.find(t => t.filePath === pathStr);
    if (existing) {
      existing.content = content;
      existing.isDirty = false;
      this.activeTabId = existing.id;
      return existing;
    }

    const id = `tab_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tab: NotepadTab = {
      id,
      filePath: pathStr,
      fileName,
      content,
      isDirty: false,
    };
    this.tabs.push(tab);
    this.activeTabId = id;
    return tab;
  }

  public saveActiveTab(): boolean {
    const tab = this.getActiveTab();
    if (!tab) return false;

    this.vfs.writeFile(tab.filePath, tab.content);
    tab.isDirty = false;
    return true;
  }

  public updateContent(newContent: string): void {
    const tab = this.getActiveTab();
    if (!tab) return;
    if (tab.content !== newContent) {
      tab.content = newContent;
      tab.isDirty = true;
    }
  }

  public getActiveTab(): NotepadTab | undefined {
    return this.tabs.find(t => t.id === this.activeTabId) || this.tabs[0];
  }

  public closeTab(id: string): void {
    this.tabs = this.tabs.filter(t => t.id !== id);
    if (this.tabs.length === 0) {
      this.createTab('untitled.txt', '');
    } else if (this.activeTabId === id) {
      this.activeTabId = this.tabs[0].id;
    }
  }

  public getMetrics(): { lines: number; words: number; chars: number } {
    const tab = this.getActiveTab();
    if (!tab) return { lines: 0, words: 0, chars: 0 };

    const text = tab.content;
    const lines = text.length === 0 ? 0 : text.split('\n').length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const chars = text.length;

    return { lines, words, chars };
  }

  /**
   * Universal DOM Renderer for Notepad GUI.
   */
  public renderToElement(): OltoDOMElement {
    const container = OltoDOMRenderer.createElement('div');
    container.setAttribute('class', 'oview-app-notepad');
    container.setAttribute(
      'style',
      'display: flex; flex-direction: column; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f8fafc;'
    );

    // 1. Tab Bar
    const tabBar = OltoDOMRenderer.createElement('div');
    tabBar.setAttribute(
      'style',
      'display: flex; align-items: center; gap: 4px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding: 0 4px; background: rgba(0,0,0,0.2);'
    );

    for (const tab of this.tabs) {
      const isActive = tab.id === this.activeTabId;
      const tabEl = OltoDOMRenderer.createElement('div');
      tabEl.setAttribute(
        'style',
        `display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; border-bottom: 2px solid ${isActive ? '#10b981' : 'transparent'}; background: ${isActive ? 'rgba(255,255,255,0.06)' : 'transparent'}; color: ${isActive ? '#f8fafc' : '#94a3b8'};`
      );

      const tabTitle = OltoDOMRenderer.createElement('span');
      tabTitle.appendChild(OltoDOMRenderer.createTextNode(`${tab.fileName}${tab.isDirty ? ' •' : ''}`));
      tabEl.appendChild(tabTitle);
      tabBar.appendChild(tabEl);
    }
    container.appendChild(tabBar);

    // 2. Toolbar
    const toolbar = OltoDOMRenderer.createElement('div');
    toolbar.setAttribute(
      'style',
      'display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: rgba(255,255,255,0.02);'
    );

    const btnGroup = OltoDOMRenderer.createElement('div');
    btnGroup.setAttribute('style', 'display: flex; gap: 6px;');

    const newBtn = OltoDOMRenderer.createElement('button');
    newBtn.setAttribute('style', 'padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px; font-size: 11px; cursor: pointer;');
    newBtn.appendChild(OltoDOMRenderer.createTextNode('📄 New'));
    btnGroup.appendChild(newBtn);

    const saveBtn = OltoDOMRenderer.createElement('button');
    saveBtn.setAttribute('style', 'padding: 4px 10px; background: #10b981; border: none; color: #fff; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;');
    saveBtn.appendChild(OltoDOMRenderer.createTextNode('💾 Save'));
    btnGroup.appendChild(saveBtn);

    toolbar.appendChild(btnGroup);

    const pathBadge = OltoDOMRenderer.createElement('span');
    pathBadge.setAttribute('style', 'font-size: 11px; color: #10b981;');
    pathBadge.appendChild(OltoDOMRenderer.createTextNode(this.getActiveTab()?.filePath || ''));
    toolbar.appendChild(pathBadge);

    container.appendChild(toolbar);

    // 3. Editor Body (Textarea)
    const editor = OltoDOMRenderer.createElement('textarea');
    editor.setAttribute(
      'style',
      'flex: 1; width: 100%; box-sizing: border-box; background: transparent; border: none; outline: none; padding: 12px; color: #f8fafc; font-family: "JetBrains Mono", Consolas, monospace; font-size: 13px; line-height: 1.6; resize: none;'
    );
    editor.appendChild(OltoDOMRenderer.createTextNode(this.getActiveTab()?.content || ''));
    container.appendChild(editor);

    // 4. Status Bar
    const metrics = this.getMetrics();
    const statusBar = OltoDOMRenderer.createElement('div');
    statusBar.setAttribute(
      'style',
      'display: flex; justify-content: space-between; align-items: center; padding: 4px 10px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px; color: #94a3b8; background: rgba(0,0,0,0.2);'
    );

    const stats = OltoDOMRenderer.createElement('div');
    stats.setAttribute('style', 'display: flex; gap: 12px;');
    const linesEl = OltoDOMRenderer.createElement('span');
    linesEl.appendChild(OltoDOMRenderer.createTextNode(`Lines: ${metrics.lines}`));
    const wordsEl = OltoDOMRenderer.createElement('span');
    wordsEl.appendChild(OltoDOMRenderer.createTextNode(`Words: ${metrics.words}`));
    const charsEl = OltoDOMRenderer.createElement('span');
    charsEl.appendChild(OltoDOMRenderer.createTextNode(`Chars: ${metrics.chars}`));
    stats.appendChild(linesEl);
    stats.appendChild(wordsEl);
    stats.appendChild(charsEl);
    statusBar.appendChild(stats);

    const enc = OltoDOMRenderer.createElement('span');
    enc.appendChild(OltoDOMRenderer.createTextNode('UTF-8 • Address369 Verified'));
    statusBar.appendChild(enc);

    container.appendChild(statusBar);
    return container;
  }
}
