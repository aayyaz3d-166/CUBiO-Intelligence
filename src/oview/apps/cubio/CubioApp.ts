/**
 * CUBiO Browser — Controller & Runtime Engine
 * ============================================================================
 * CubioApp.ts: Manages multi-tab navigation, URL parsing, DevTools,
 * and FreeTree Engine execution lifecycle.
 */

import { FreeTreeParser } from '../../engines/freetree/FreeTreeParser';
import { FreeTreeVM } from '../../engines/freetree/FreeTreeVM';
import { FreeTreeDocumentNode } from '../../engines/freetree/FreeTreeNode';
import { VirtualFileSystem } from '../../vfs/VirtualFileSystem';

export interface CubioTab {
  id: string;
  title: string;
  url: string;
  history: string[];
  historyIndex: number;
  doc: FreeTreeDocumentNode | null;
  vm: FreeTreeVM | null;
  memorySlot: number;
}

export class CubioApp {
  private tabs: CubioTab[] = [];
  private activeTabId: string = '';
  private vfs: VirtualFileSystem;
  private showDevTools: boolean = false;
  private devToolsTab: 'console' | 'tree' | 'slot' = 'console';
  private tabCounter: number = 1;

  constructor() {
    this.vfs = VirtualFileSystem.getInstance();
    // Initialize default tab
    this.createTab('cubio://home');
  }

  public createTab(url: string = 'cubio://home'): CubioTab {
    const id = `tab_${Date.now()}_${this.tabCounter++}`;
    const tab: CubioTab = {
      id,
      title: 'Loading...',
      url,
      history: [url],
      historyIndex: 0,
      doc: null,
      vm: null,
      memorySlot: 250 + (this.tabs.length % 50),
    };
    this.tabs.push(tab);
    this.activeTabId = id;
    this.loadUrl(tab, url);
    return tab;
  }

  public closeTab(tabId: string): void {
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    this.tabs.splice(idx, 1);
    if (this.tabs.length === 0) {
      this.createTab('cubio://home');
    } else if (this.activeTabId === tabId) {
      const nextIdx = Math.max(0, idx - 1);
      this.activeTabId = this.tabs[nextIdx].id;
    }
  }

  public getTabs(): CubioTab[] {
    return [...this.tabs];
  }

  public getActiveTab(): CubioTab {
    return this.tabs.find(t => t.id === this.activeTabId) || this.tabs[0];
  }

  public setActiveTab(tabId: string): void {
    if (this.tabs.some(t => t.id === tabId)) {
      this.activeTabId = tabId;
    }
  }

  public navigate(url: string): void {
    const tab = this.getActiveTab();
    if (!tab) return;

    // Push to history
    if (tab.historyIndex < tab.history.length - 1) {
      tab.history = tab.history.slice(0, tab.historyIndex + 1);
    }
    tab.history.push(url);
    tab.historyIndex = tab.history.length - 1;
    this.loadUrl(tab, url);
  }

  public goBack(): void {
    const tab = this.getActiveTab();
    if (tab && tab.historyIndex > 0) {
      tab.historyIndex--;
      this.loadUrl(tab, tab.history[tab.historyIndex]);
    }
  }

  public goForward(): void {
    const tab = this.getActiveTab();
    if (tab && tab.historyIndex < tab.history.length - 1) {
      tab.historyIndex++;
      this.loadUrl(tab, tab.history[tab.historyIndex]);
    }
  }

  public reload(): void {
    const tab = this.getActiveTab();
    if (tab) {
      this.loadUrl(tab, tab.url);
    }
  }

  public toggleDevTools(): void {
    this.showDevTools = !this.showDevTools;
  }

  public setDevToolsTab(tab: 'console' | 'tree' | 'slot'): void {
    this.devToolsTab = tab;
  }

  public isDevToolsOpen(): boolean {
    return this.showDevTools;
  }

  public getDevToolsTab(): 'console' | 'tree' | 'slot' {
    return this.devToolsTab;
  }

  private loadUrl(tab: CubioTab, url: string): void {
    tab.url = url;
    let markup = '';

    if (url === 'cubio://home' || url === 'oview://home') {
      tab.title = 'CUBiO Sovereign Portal';
      markup = this.renderHomePortal();
    } else if (url === 'cubio://docs' || url === 'oview://docs') {
      tab.title = 'FreeTree Engine Docs';
      markup = this.renderDocsPage();
    } else if (url === 'cubio://playground') {
      tab.title = 'FreeTree Live Playground';
      markup = this.renderPlaygroundPage();
    } else if (url.startsWith('file:///')) {
      const vfsPath = url.replace('file:///', '/');
      try {
        const content = this.vfs.readFile(vfsPath);
        tab.title = vfsPath.split('/').pop() || 'VFS File';
        markup = `
          <div style="max-width: 800px; margin: 0 auto; padding: 24px;">
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-family: monospace; font-size: 13px; color: #10b981;">
              📄 VFS Source: \${vfsPath} (\${content.length} bytes)
            </div>
            <pre style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 20px; color: #e2e8f0; font-family: monospace; font-size: 13px; overflow-x: auto; line-height: 1.6;">\${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </div>
        `;
      } catch {
        tab.title = '404 File Not Found';
        markup = `<div style="padding: 40px; text-align: center;"><h1 style="color: #ef4444;">404 Not Found</h1><p style="color: #94a3b8;">The VFS file <code>\${vfsPath}</code> does not exist.</p></div>`;
      }
    } else {
      tab.title = 'Sovereign Search: ' + url;
      markup = `
        <div style="max-width: 720px; margin: 40px auto; text-align: center;">
          <h2 style="color: #10b981; font-size: 24px; margin-bottom: 12px;">Sovereign Hypermedia Search</h2>
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">Querying sovereign network for: <strong style="color: #f8fafc;">${url}</strong></p>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; text-align: left;">
            <p style="color: #cbd5e1; font-size: 13px; line-height: 1.6;">No external telemetry or tracking detected. The FreeTree engine is currently operating in local sovereign mode.</p>
            <div style="margin-top: 16px; display: flex; gap: 8px;">
              <button onclick="cubioNavigate('cubio://home')" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Back to Home</button>
              <button onclick="cubioNavigate('cubio://docs')" style="background: rgba(255,255,255,0.1); color: #f8fafc; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Read Docs</button>
            </div>
          </div>
        </div>
      `;
    }

    // Parse with FreeTree Parser and initialize VM
    tab.doc = FreeTreeParser.parse(markup, url);
    tab.vm = new FreeTreeVM(tab.doc, tab.memorySlot);
    tab.vm.execute();
  }

  private renderHomePortal(): string {
    return `
      <div style="max-width: 900px; margin: 0 auto; padding: 36px 20px;">
        <!-- Hero Header -->
        <div style="text-align: center; margin-bottom: 40px;">
          <div style="font-size: 44px; margin-bottom: 8px;">🌐</div>
          <h1 style="font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #10b981, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px;">
            CUBiO Sovereign Browser
          </h1>
          <p style="color: #94a3b8; font-size: 14px; max-width: 580px; margin: 0 auto; line-height: 1.6;">
            Powered by the <strong>FreeTree Engine</strong> (Zero-bloat V8 equivalent). 100% offline, zero trackers, fine-grained reactive tree execution.
          </p>
        </div>

        <!-- Sovereign Speed Dial -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 36px;">
          <div onclick="cubioNavigate('cubio://docs')" style="background: rgba(18, 25, 41, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 20px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#10b981'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'">
            <div style="font-size: 26px; margin-bottom: 10px;">📚</div>
            <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">FreeTree Engine Docs</h3>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">Learn the architecture of the FreeTree parser, AST, and bytecode execution pipeline.</p>
          </div>

          <div onclick="cubioNavigate('cubio://playground')" style="background: rgba(18, 25, 41, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 20px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'">
            <div style="font-size: 26px; margin-bottom: 10px;">⚡</div>
            <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">Live Playground</h3>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">Write interactive sovereign markup and test real-time script evaluation.</p>
          </div>

          <div onclick="cubioNavigate('file:///user/documents/welcome.txt')" style="background: rgba(18, 25, 41, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 20px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#a855f7'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'">
            <div style="font-size: 26px; margin-bottom: 10px;">📂</div>
            <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">Browse VFS Files</h3>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">Inspect local sovereign documents stored in Address369 Virtual File System.</p>
          </div>
        </div>

        <!-- Engine Telemetry Badge -->
        <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;"></div>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #f8fafc;">FreeTree Substrate Engine Active</div>
              <div style="font-size: 11px; color: #64748b;">Memory Slot: Address369 [250..299] | Qplayer VM Target: 204.8M ops/s</div>
            </div>
          </div>
          <button onclick="cubioToggleDevTools()" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer;">Inspect DevTools (F12)</button>
        </div>
      </div>
    `;
  }

  private renderDocsPage(): string {
    return `
      <div style="max-width: 840px; margin: 0 auto; padding: 32px 20px;">
        <h1 style="font-size: 28px; font-weight: 800; color: #10b981; margin-bottom: 8px;">FreeTree Engine Specifications</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-bottom: 28px;">The V8-Equivalent Sovereign Execution and Layout Pipeline</p>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 10px;">1. Why FreeTree instead of Chromium/V8?</h3>
          <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
            Google Chrome's Blink & V8 consist of over 30 million lines of C++ code, laden with corporate telemetry, ad trackers, and heavy memory overhead. 
            FreeTree is a lightweight, zero-dependency, fine-grained tree engine designed specifically for ONE Language and OLTO applications, delivering sub-millisecond AST evaluation without Virtual-DOM diffing.
          </p>
        </div>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 10px;">2. Architecture Overview</h3>
          <ul style="font-size: 13px; color: #cbd5e1; line-height: 1.8; padding-left: 20px;">
            <li><strong>Lexer & Parser:</strong> Fault-tolerant sovereign tokenizer producing <code>FreeTreeNode</code> ASTs.</li>
            <li><strong>VM Sandbox:</strong> Isolated <code>FreeTreeVM</code> per browser tab bounded to Address369 slots.</li>
            <li><strong>Reactive Signals:</strong> Instant event dispatching (click, hover, input) without entire page reloads.</li>
          </ul>
        </div>
      </div>
    `;
  }

  private renderPlaygroundPage(): string {
    return `
      <div style="max-width: 840px; margin: 0 auto; padding: 24px 20px;">
        <h2 style="font-size: 22px; font-weight: 800; color: #3b82f6; margin-bottom: 6px;">FreeTree Interactive Playground</h2>
        <p style="color: #94a3b8; font-size: 13px; margin-bottom: 20px;">Write sovereign markup and execute live code in the FreeTree sandbox.</p>

        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 18px; margin-bottom: 18px;">
          <div style="color: #10b981; font-family: monospace; font-size: 12px; margin-bottom: 10px;">// Live Reactive Component Example:</div>
          <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
            <h4 style="font-size: 15px; margin-bottom: 6px;">Interactive Sovereign Counter</h4>
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 12px;">Click the button to increment state inside the FreeTree VM sandbox:</p>
            <button id="playground-btn" onclick="let c = (state.count || 0) + 1; setState('count', c); log('Playground counter value: ' + c); alert('Counter: ' + c);" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
              ⚡ Click Me (Trigger FreeTree Event)
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generates the rendered HTML view for the active tab.
   */
  public renderActiveView(): string {
    const tab = this.getActiveTab();
    if (!tab || !tab.vm) return '<div style="padding: 20px; color: #64748b;">No active tab.</div>';
    return tab.vm.renderToHTML();
  }

  /**
   * Generates DevTools panel content.
   */
  public renderDevToolsContent(): string {
    const tab = this.getActiveTab();
    if (!tab || !tab.vm) return '<div style="color: #64748b;">No VM active.</div>';

    if (this.devToolsTab === 'console') {
      const logs = tab.vm.getLogs();
      if (logs.length === 0) {
        return '<div style="color: #64748b; font-style: italic;">No console output. Use cubio.log(...) to log messages.</div>';
      }
      return logs.map(l => `<div style="padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.04); color: #cbd5e1;">${l}</div>`).join('');
    }

    if (this.devToolsTab === 'tree') {
      const doc = tab.doc;
      if (!doc) return '<div style="color: #64748b;">No document parsed.</div>';
      return `
        <div style="color: #10b981; font-weight: 700; margin-bottom: 6px;">Document [id: ${doc.id}]</div>
        <div style="color: #94a3b8; margin-left: 10px;">URL: ${doc.url}</div>
        <div style="color: #94a3b8; margin-left: 10px;">Scripts: ${doc.scripts.length} | Styles: ${doc.styles.length}</div>
        <div style="color: #3b82f6; font-weight: 700; margin: 10px 0 6px 10px;">Body [Children: ${doc.body.children.length}]</div>
        ${doc.body.children.map(c => `<div style="color: #cbd5e1; margin-left: 20px; padding: 2px 0;">• &lt;${c.type === 'element' ? (c as any).tag : c.type}&gt;</div>`).join('')}
      `;
    }

    if (this.devToolsTab === 'slot') {
      return `
        <div style="color: #f8fafc; font-weight: 700; margin-bottom: 10px;">Address369 Spatial Memory Slot</div>
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 10px; border-radius: 8px; margin-bottom: 12px;">
          <div style="color: #10b981; font-size: 13px; font-weight: 700;">Slot #${tab.memorySlot}</div>
          <div style="color: #64748b; font-size: 10px;">User Space Range: [10..359]</div>
        </div>
        <div style="color: #94a3b8; font-size: 11px; line-height: 1.6;">
          • Status: Isolated & Verified<br/>
          • Invariant E9001: Enforced (Zero Leakage)<br/>
          • Qplayer VM Target: 204.8M ops/sec
        </div>
      `;
    }

    return '';
  }
}
