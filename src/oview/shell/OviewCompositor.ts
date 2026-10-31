/**
 * Oview OS — Sovereign Desktop Compositor & Runtime Engine
 * =========================================================
 * OviewCompositor.ts: High-performance graphical compositor that renders the
 * reactive desktop canvas, multi-window manager, taskbar dock, and start menu
 * into a zero-dependency, standalone GUI environment.
 */

import { WindowManager } from '../core/WindowManager';
import { ProcessManager } from '../core/ProcessManager';
import { SystemBus } from '../core/SystemBus';
import { WindowState, AppDescriptor } from '../core/types';
import { OltoDOMRenderer, OltoDOMElement } from '../../olto/runtime/OltoDOMRenderer';
import { NotepadApp } from '../apps/notepad/NotepadApp';
import { ExplorerApp } from '../apps/explorer/ExplorerApp';
import { TerminalApp } from '../apps/terminal/TerminalApp';
import { CalculatorApp } from '../apps/calculator/CalculatorApp';
import { SettingsApp } from '../apps/settings/SettingsApp';
import { OviewSpotlight } from '../ai/OviewSpotlight';

export class OviewCompositor {
  private wm: WindowManager;
  private pm: ProcessManager;
  private bus: SystemBus;

  public isStartMenuOpen: boolean = false;
  public isSpotlightOpen: boolean = false;
  public theme: 'cyber-glass' | 'emerald-sovereign' | 'neon-matrix' = 'cyber-glass';

  constructor(wm?: WindowManager, pm?: ProcessManager, bus?: SystemBus) {
    this.wm = wm || WindowManager.getInstance();
    this.pm = pm || ProcessManager.getInstance();
    this.bus = bus || SystemBus.getInstance();
  }

  /**
   * Toggles Start Menu visibility.
   */
  public toggleStartMenu(): boolean {
    this.isStartMenuOpen = !this.isStartMenuOpen;
    this.bus.emit('shell:start_menu_toggled', { isOpen: this.isStartMenuOpen }, 'OviewCompositor');
    return this.isStartMenuOpen;
  }

  /**
   * Toggles Spotlight search overlay.
   */
  public toggleSpotlight(): boolean {
    this.isSpotlightOpen = !this.isSpotlightOpen;
    this.bus.emit('shell:spotlight_toggled', { isOpen: this.isSpotlightOpen }, 'OviewCompositor');
    return this.isSpotlightOpen;
  }

  /**
   * Renders the complete Oview OS Desktop environment into an OltoDOMElement tree.
   * Universal: Can be converted to HTML string or directly mounted in any browser/WebView.
   */
  public renderToElement(): OltoDOMElement {
    const root = OltoDOMRenderer.createElement('div');
    root.setAttribute('class', 'oview-desktop-root');
    root.setAttribute('id', 'oview-root');
    root.setAttribute(
      'style',
      'position: relative; width: 100vw; height: 100vh; overflow: hidden; user-select: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: radial-gradient(circle at 15% 15%, rgba(16, 185, 129, 0.15) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(59, 130, 246, 0.12) 0%, transparent 45%), #090d16; color: #f8fafc;'
    );

    // 1. Wallpaper & Desktop Surface Canvas
    const canvas = this.renderDesktopCanvas();
    root.appendChild(canvas);

    // 2. Multi-Window Compositor Layer
    const windowLayer = this.renderWindowLayer();
    root.appendChild(windowLayer);

    // 3. Start Menu Pop-up (if open)
    if (this.isStartMenuOpen) {
      const startMenu = this.renderStartMenuElement();
      root.appendChild(startMenu);
    }

    // 4. Taskbar & System Dock (Always on Top)
    const taskbar = this.renderTaskbarElement();
    root.appendChild(taskbar);

    // 5. Global Spotlight & ECHO-1 Search Modal (if open)
    if (this.isSpotlightOpen) {
      const spotlightModal = OviewSpotlight.getInstance().renderToElement();
      root.appendChild(spotlightModal);
    }

    return root;
  }

  /**
   * Renders the Desktop background and shortcut icons.
   */
  private renderDesktopCanvas(): OltoDOMElement {
    const canvas = OltoDOMRenderer.createElement('div');
    canvas.setAttribute('class', 'oview-canvas');
    canvas.setAttribute(
      'style',
      'position: absolute; top: 0; left: 0; width: 100%; height: calc(100% - 48px); padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; pointer-events: auto;'
    );

    // Watermark / Brand Header
    const brand = OltoDOMRenderer.createElement('div');
    brand.setAttribute('style', 'display: flex; align-items: center; gap: 12px; opacity: 0.85;');
    const logo = OltoDOMRenderer.createElement('span');
    logo.setAttribute('style', 'font-size: 28px; color: #10b981; font-weight: 800;');
    logo.appendChild(OltoDOMRenderer.createTextNode('◈'));
    const title = OltoDOMRenderer.createElement('div');
    title.setAttribute('style', 'display: flex; flex-direction: column;');
    const name = OltoDOMRenderer.createElement('span');
    name.setAttribute('style', 'font-size: 18px; font-weight: 700; letter-spacing: 1px;');
    name.appendChild(OltoDOMRenderer.createTextNode('Oview OS'));
    const sub = OltoDOMRenderer.createElement('span');
    sub.setAttribute('style', 'font-size: 11px; color: #10b981; letter-spacing: 0.5px;');
    sub.appendChild(OltoDOMRenderer.createTextNode('Sovereign Desktop Substrate • ECHO-1 Brain'));
    title.appendChild(name);
    title.appendChild(sub);
    brand.appendChild(logo);
    brand.appendChild(title);
    canvas.appendChild(brand);

    // Desktop Shortcut Icons Column
    const iconGrid = OltoDOMRenderer.createElement('div');
    iconGrid.setAttribute('style', 'display: flex; flex-direction: column; gap: 16px; margin-top: 24px; width: 90px;');

    const apps = this.pm.getRegisteredApps();
    for (const app of apps) {
      const item = OltoDOMRenderer.createElement('div');
      item.setAttribute('class', 'oview-desktop-icon');
      item.setAttribute(
        'style',
        'display: flex; flex-direction: column; align-items: center; justify-content: center; width: 84px; height: 80px; border-radius: 12px; cursor: pointer; transition: background 0.2s; padding: 6px; text-align: center;'
      );

      const ic = OltoDOMRenderer.createElement('div');
      ic.setAttribute('style', 'font-size: 32px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));');
      ic.appendChild(OltoDOMRenderer.createTextNode(app.icon));

      const lbl = OltoDOMRenderer.createElement('div');
      lbl.setAttribute(
        'style',
        'font-size: 11px; font-weight: 600; color: #f8fafc; margin-top: 4px; text-shadow: 0 1px 3px rgba(0,0,0,0.8); line-height: 1.2;'
      );
      lbl.appendChild(OltoDOMRenderer.createTextNode(app.name));

      item.appendChild(ic);
      item.appendChild(lbl);
      iconGrid.appendChild(item);
    }

    canvas.appendChild(iconGrid);
    return canvas;
  }

  /**
   * Renders all active windows according to WindowManager state.
   */
  private renderWindowLayer(): OltoDOMElement {
    const layer = OltoDOMRenderer.createElement('div');
    layer.setAttribute('class', 'oview-window-layer');
    layer.setAttribute('style', 'position: absolute; top: 0; left: 0; width: 100%; height: calc(100% - 48px); pointer-events: none;');

    const windows = this.wm.windows.get();
    for (const win of windows) {
      if (win.isMinimized) continue; // Skip minimized windows

      const frame = this.renderWindowFrame(win);
      layer.appendChild(frame);
    }

    return layer;
  }

  /**
   * Renders a single draggable, resizable window frame.
   */
  public renderWindowFrame(win: WindowState): OltoDOMElement {
    const frame = OltoDOMRenderer.createElement('div');
    frame.setAttribute('class', `oview-window ${win.isFocused ? 'focused' : ''}`);
    frame.setAttribute('id', `window-${win.id}`);

    const borderGlow = win.isFocused
      ? 'border: 1px solid rgba(16, 185, 129, 0.45); box-shadow: 0 16px 40px -8px rgba(0,0,0,0.7), 0 0 20px rgba(16, 185, 129, 0.2);'
      : 'border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 12px 30px -8px rgba(0,0,0,0.6);';

    frame.setAttribute(
      'style',
      `position: absolute; left: ${win.x}px; top: ${win.y}px; width: ${win.width}px; height: ${win.height}px; z-index: ${win.zIndex}; background: rgba(18, 25, 41, 0.88); backdrop-filter: blur(24px); border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; pointer-events: auto; transition: box-shadow 0.2s; ${borderGlow}`
    );

    // Title Bar
    const titleBar = OltoDOMRenderer.createElement('div');
    titleBar.setAttribute('class', 'oview-window-titlebar');
    titleBar.setAttribute(
      'style',
      'height: 38px; min-height: 38px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; background: rgba(255, 255, 255, 0.04); border-bottom: 1px solid rgba(255, 255, 255, 0.08); cursor: grab;'
    );

    // Left: Icon + Title
    const titleGroup = OltoDOMRenderer.createElement('div');
    titleGroup.setAttribute('style', 'display: flex; align-items: center; gap: 8px;');
    const icon = OltoDOMRenderer.createElement('span');
    icon.setAttribute('style', 'font-size: 15px;');
    icon.appendChild(OltoDOMRenderer.createTextNode(win.icon));
    const titleText = OltoDOMRenderer.createElement('span');
    titleText.setAttribute('style', `font-size: 13px; font-weight: 600; color: ${win.isFocused ? '#f8fafc' : '#94a3b8'};`);
    titleText.appendChild(OltoDOMRenderer.createTextNode(win.title));
    titleGroup.appendChild(icon);
    titleGroup.appendChild(titleText);
    titleBar.appendChild(titleGroup);

    // Right: Controls (─, □/❐, ✕)
    const controls = OltoDOMRenderer.createElement('div');
    controls.setAttribute('style', 'display: flex; align-items: center; gap: 6px;');

    // Minimize Button
    const minBtn = OltoDOMRenderer.createElement('button');
    minBtn.setAttribute('class', 'oview-btn-min');
    minBtn.setAttribute(
      'style',
      'width: 26px; height: 24px; border: none; background: transparent; color: #94a3b8; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;'
    );
    minBtn.appendChild(OltoDOMRenderer.createTextNode('─'));
    controls.appendChild(minBtn);

    // Maximize Button
    const maxBtn = OltoDOMRenderer.createElement('button');
    maxBtn.setAttribute('class', 'oview-btn-max');
    maxBtn.setAttribute(
      'style',
      'width: 26px; height: 24px; border: none; background: transparent; color: #94a3b8; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px;'
    );
    maxBtn.appendChild(OltoDOMRenderer.createTextNode(win.isMaximized ? '❐' : '□'));
    controls.appendChild(maxBtn);

    // Close Button
    const closeBtn = OltoDOMRenderer.createElement('button');
    closeBtn.setAttribute('class', 'oview-btn-close');
    closeBtn.setAttribute(
      'style',
      'width: 26px; height: 24px; border: none; background: transparent; color: #94a3b8; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px;'
    );
    closeBtn.appendChild(OltoDOMRenderer.createTextNode('✕'));
    controls.appendChild(closeBtn);

    titleBar.appendChild(controls);
    frame.appendChild(titleBar);

    // Window Content Body
    const content = OltoDOMRenderer.createElement('div');
    content.setAttribute('class', 'oview-window-body');
    content.setAttribute(
      'style',
      'flex: 1; overflow: hidden; display: flex; flex-direction: column; background: rgba(10, 15, 26, 0.7);'
    );

    // Dynamic Native App GUI Resolution
    let appEl: OltoDOMElement | null = null;
    try {
      if (win.appId === 'oview.notepad') {
        const initialPath = win.state?.filePath || '/user/documents/welcome.txt';
        appEl = new NotepadApp(initialPath).renderToElement();
      } else if (win.appId === 'oview.explorer') {
        const initialPath = win.state?.path || '/user/documents';
        appEl = new ExplorerApp(initialPath).renderToElement();
      } else if (win.appId === 'oview.terminal') {
        appEl = new TerminalApp().renderToElement();
      } else if (win.appId === 'oview.calculator') {
        appEl = new CalculatorApp().renderToElement();
      } else if (win.appId === 'oview.settings') {
        appEl = new SettingsApp(this.bus, this.pm).renderToElement();
      }
    } catch {
      appEl = null;
    }

    if (appEl) {
      content.appendChild(appEl);
    } else {
      // Default Fallback App View
      const fallback = OltoDOMRenderer.createElement('div');
      fallback.setAttribute('style', 'padding: 16px;');
      const appLabel = OltoDOMRenderer.createElement('span');
      appLabel.setAttribute('style', 'font-size: 14px; font-weight: 700; color: #10b981;');
      appLabel.appendChild(OltoDOMRenderer.createTextNode(`${win.title} — Native Substrate`));
      fallback.appendChild(appLabel);
      content.appendChild(fallback);
    }

    frame.appendChild(content);

    return frame;
  }

  /**
   * Renders the Bottom Taskbar and System Tray.
   */
  private renderTaskbarElement(): OltoDOMElement {
    const taskbar = OltoDOMRenderer.createElement('div');
    taskbar.setAttribute('class', 'oview-taskbar');
    taskbar.setAttribute('id', 'oview-taskbar');
    taskbar.setAttribute(
      'style',
      'position: absolute; bottom: 0; left: 0; width: 100%; height: 48px; background: rgba(13, 18, 30, 0.92); backdrop-filter: blur(20px); border-top: 1px solid rgba(255, 255, 255, 0.12); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; box-sizing: border-box; z-index: 9999;'
    );

    // Left: Start Button + Pinned App Launchers
    const leftSection = OltoDOMRenderer.createElement('div');
    leftSection.setAttribute('style', 'display: flex; align-items: center; gap: 8px;');

    // Start Button
    const startBtn = OltoDOMRenderer.createElement('button');
    startBtn.setAttribute('id', 'oview-start-btn');
    startBtn.setAttribute(
      'style',
      'display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3); transition: transform 0.1s;'
    );
    const startIcon = OltoDOMRenderer.createElement('span');
    startIcon.setAttribute('style', 'font-size: 16px;');
    startIcon.appendChild(OltoDOMRenderer.createTextNode('◈'));
    const startLabel = OltoDOMRenderer.createElement('span');
    startLabel.appendChild(OltoDOMRenderer.createTextNode('OVIEW'));
    startBtn.appendChild(startIcon);
    startBtn.appendChild(startLabel);
    leftSection.appendChild(startBtn);

    // Running Tasks Dock Tabs
    const taskTabs = OltoDOMRenderer.createElement('div');
    taskTabs.setAttribute('style', 'display: flex; align-items: center; gap: 6px; margin-left: 10px;');

    const windows = this.wm.windows.get();
    for (const win of windows) {
      const tab = OltoDOMRenderer.createElement('div');
      tab.setAttribute('class', `oview-taskbar-tab ${win.isFocused && !win.isMinimized ? 'active' : ''}`);

      const tabBg = win.isFocused && !win.isMinimized
        ? 'background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #f8fafc;'
        : 'background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); color: #94a3b8;';

      tab.setAttribute(
        'style',
        `display: flex; align-items: center; gap: 8px; padding: 4px 12px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.15s; ${tabBg}`
      );

      const tabIcon = OltoDOMRenderer.createElement('span');
      tabIcon.appendChild(OltoDOMRenderer.createTextNode(win.icon));
      const tabText = OltoDOMRenderer.createElement('span');
      tabText.setAttribute('style', 'max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;');
      tabText.appendChild(OltoDOMRenderer.createTextNode(win.title));

      tab.appendChild(tabIcon);
      tab.appendChild(tabText);
      taskTabs.appendChild(tab);
    }

    leftSection.appendChild(taskTabs);
    taskbar.appendChild(leftSection);

    // Right: System Tray & Clock
    const telemetry = this.pm.getTelemetry();
    const rightSection = OltoDOMRenderer.createElement('div');
    rightSection.setAttribute('style', 'display: flex; align-items: center; gap: 12px;');

    // CPU Badge
    const cpuBadge = OltoDOMRenderer.createElement('span');
    cpuBadge.setAttribute(
      'style',
      'font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);'
    );
    cpuBadge.appendChild(OltoDOMRenderer.createTextNode(`CPU: ${telemetry.cpuUsage}%`));
    rightSection.appendChild(cpuBadge);

    // RAM Badge
    const ramBadge = OltoDOMRenderer.createElement('span');
    ramBadge.setAttribute(
      'style',
      'font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3);'
    );
    ramBadge.appendChild(OltoDOMRenderer.createTextNode(`RAM: ${telemetry.memoryUsedMb}MB`));
    rightSection.appendChild(ramBadge);

    // Offline AI Core Status
    const aiBadge = OltoDOMRenderer.createElement('span');
    aiBadge.setAttribute(
      'style',
      'font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); cursor: pointer;'
    );
    aiBadge.appendChild(OltoDOMRenderer.createTextNode('⚡ ECHO-1 OFFLINE'));
    rightSection.appendChild(aiBadge);

    // Digital Clock
    const clock = OltoDOMRenderer.createElement('span');
    clock.setAttribute('id', 'oview-clock');
    clock.setAttribute('style', 'font-size: 13px; font-weight: 700; color: #f8fafc; margin-left: 4px;');
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    clock.appendChild(OltoDOMRenderer.createTextNode(timeStr));
    rightSection.appendChild(clock);

    taskbar.appendChild(rightSection);
    return taskbar;
  }

  /**
   * Renders the Start Menu Flyout.
   */
  private renderStartMenuElement(): OltoDOMElement {
    const menu = OltoDOMRenderer.createElement('div');
    menu.setAttribute('class', 'oview-start-menu');
    menu.setAttribute('id', 'oview-start-menu');
    menu.setAttribute(
      'style',
      'position: absolute; bottom: 56px; left: 12px; width: 440px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(28px); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(16, 185, 129, 0.15); padding: 20px; box-sizing: border-box; z-index: 10000;'
    );

    // User Profile Header
    const userRow = OltoDOMRenderer.createElement('div');
    userRow.setAttribute('style', 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;');
    const userInfo = OltoDOMRenderer.createElement('div');
    userInfo.setAttribute('style', 'display: flex; align-items: center; gap: 12px;');
    const avatar = OltoDOMRenderer.createElement('span');
    avatar.setAttribute('style', 'font-size: 28px;');
    avatar.appendChild(OltoDOMRenderer.createTextNode('👤'));
    const details = OltoDOMRenderer.createElement('div');
    details.setAttribute('style', 'display: flex; flex-direction: column;');
    const uName = OltoDOMRenderer.createElement('span');
    uName.setAttribute('style', 'font-size: 14px; font-weight: 700; color: #f8fafc;');
    uName.appendChild(OltoDOMRenderer.createTextNode('Sovereign Operator'));
    const osVer = OltoDOMRenderer.createElement('span');
    osVer.setAttribute('style', 'font-size: 11px; color: #10b981;');
    osVer.appendChild(OltoDOMRenderer.createTextNode('Oview OS v1.0.0 (Production Blueprint)'));
    details.appendChild(uName);
    details.appendChild(osVer);
    userInfo.appendChild(avatar);
    userInfo.appendChild(details);
    userRow.appendChild(userInfo);
    menu.appendChild(userRow);

    // Search Bar
    const searchBox = OltoDOMRenderer.createElement('div');
    searchBox.setAttribute('style', 'margin-bottom: 16px;');
    const searchInput = OltoDOMRenderer.createElement('input');
    searchInput.setAttribute('type', 'text');
    searchInput.setAttribute('placeholder', 'Search apps, files, or ask ECHO-1 (Ctrl+Space)...');
    searchInput.setAttribute(
      'style',
      'width: 100%; padding: 10px 14px; background: rgba(30, 41, 59, 0.8); border: 1.5px solid rgba(255, 255, 255, 0.12); border-radius: 10px; color: #f8fafc; font-size: 13px; outline: none; box-sizing: border-box;'
    );
    searchBox.appendChild(searchInput);
    menu.appendChild(searchBox);

    // Apps Section Label
    const appLabel = OltoDOMRenderer.createElement('div');
    appLabel.setAttribute('style', 'font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 10px;');
    appLabel.appendChild(OltoDOMRenderer.createTextNode('SYSTEM APPLICATIONS'));
    menu.appendChild(appLabel);

    // Apps Grid
    const appGrid = OltoDOMRenderer.createElement('div');
    appGrid.setAttribute('style', 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;');

    const registered = this.pm.getRegisteredApps();
    for (const app of registered) {
      const card = OltoDOMRenderer.createElement('div');
      card.setAttribute('class', 'oview-start-app-item');
      card.setAttribute(
        'style',
        'display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; cursor: pointer; transition: background 0.15s;'
      );

      const aIcon = OltoDOMRenderer.createElement('span');
      aIcon.setAttribute('style', 'font-size: 20px;');
      aIcon.appendChild(OltoDOMRenderer.createTextNode(app.icon));

      const aMeta = OltoDOMRenderer.createElement('div');
      aMeta.setAttribute('style', 'display: flex; flex-direction: column;');
      const aTitle = OltoDOMRenderer.createElement('span');
      aTitle.setAttribute('style', 'font-size: 12px; font-weight: 600; color: #f8fafc;');
      aTitle.appendChild(OltoDOMRenderer.createTextNode(app.name));
      const aDesc = OltoDOMRenderer.createElement('span');
      aDesc.setAttribute('style', 'font-size: 10px; color: #94a3b8;');
      aDesc.appendChild(OltoDOMRenderer.createTextNode(app.description));
      aMeta.appendChild(aTitle);
      aMeta.appendChild(aDesc);

      card.appendChild(aIcon);
      card.appendChild(aMeta);
      appGrid.appendChild(card);
    }
    menu.appendChild(appGrid);

    // Power Footer
    const footer = OltoDOMRenderer.createElement('div');
    footer.setAttribute(
      'style',
      'display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08);'
    );
    const memLabel = OltoDOMRenderer.createElement('span');
    memLabel.setAttribute('style', 'font-size: 11px; color: #94a3b8;');
    memLabel.appendChild(OltoDOMRenderer.createTextNode('Address369: Slots 0..368 Normal'));
    footer.appendChild(memLabel);

    const powerActions = OltoDOMRenderer.createElement('div');
    powerActions.setAttribute('style', 'display: flex; gap: 8px;');
    const restartBtn = OltoDOMRenderer.createElement('button');
    restartBtn.setAttribute(
      'style',
      'padding: 5px 12px; background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #f8fafc; border-radius: 6px; font-size: 11px; cursor: pointer;'
    );
    restartBtn.appendChild(OltoDOMRenderer.createTextNode('Restart'));
    const shutBtn = OltoDOMRenderer.createElement('button');
    shutBtn.setAttribute(
      'style',
      'padding: 5px 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; border-radius: 6px; font-size: 11px; cursor: pointer;'
    );
    shutBtn.appendChild(OltoDOMRenderer.createTextNode('Shutdown'));
    powerActions.appendChild(restartBtn);
    powerActions.appendChild(shutBtn);
    footer.appendChild(powerActions);

    menu.appendChild(footer);
    return menu;
  }

  /**
   * Generates complete standalone HTML string for headless testing or export.
   */
  public renderToHTML(): string {
    const rootEl = this.renderToElement();
    return rootEl.renderToHTML();
  }
}
