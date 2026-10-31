/**
 * Oview OS — Sovereign Desktop Standalone Bundler & HTML Generator
 * =================================================================
 * OviewBundler.ts: Compiles the full Oview OS desktop shell, window compositor,
 * and the complete Phase 2 pre-installed native application suite into a
 * zero-dependency, self-contained desktop application runnable directly in any browser.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProcessManager } from '../core/ProcessManager';

export interface OviewBundleOptions {
  title?: string;
  outputPath?: string;
  theme?: 'cyber-glass' | 'deep-space' | 'emerald-sovereign';
}

export class OviewBundler {
  /**
   * Bundles the full interactive Oview OS Desktop environment into standalone HTML.
   */
  public static bundle(options: OviewBundleOptions = {}): string {
    const pm = ProcessManager.getInstance();
    const apps = pm.getRegisteredApps();

    const title = options.title || 'Oview OS — Sovereign Desktop Environment';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #090d16;
      color: #f8fafc;
    }
    #oview-root {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: radial-gradient(circle at 15% 15%, rgba(16, 185, 129, 0.16) 0%, transparent 45%),
                  radial-gradient(circle at 85% 85%, rgba(59, 130, 246, 0.14) 0%, transparent 45%),
                  #090d16;
      transition: background 0.4s ease;
    }
    .oview-window {
      position: absolute;
      background: rgba(18, 25, 41, 0.92);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 16px 40px -8px rgba(0,0,0,0.7);
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .oview-window.focused {
      border: 1px solid rgba(16, 185, 129, 0.45);
      box-shadow: 0 20px 48px -8px rgba(0,0,0,0.8), 0 0 24px rgba(16, 185, 129, 0.25);
    }
    .oview-window-titlebar {
      height: 38px;
      min-height: 38px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      background: rgba(255, 255, 255, 0.04);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: grab;
    }
    .oview-window-titlebar:active { cursor: grabbing; }
    .oview-window-ctrl {
      width: 26px;
      height: 24px;
      border: none;
      background: transparent;
      color: #94a3b8;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      transition: background 0.15s, color 0.15s;
    }
    .oview-window-ctrl:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
    .oview-window-ctrl.close:hover { background: #ef4444; color: #fff; }
    .oview-desktop-icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 86px;
      height: 84px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 6px;
      text-align: center;
      user-select: none;
    }
    .oview-desktop-icon:hover {
      background: rgba(255, 255, 255, 0.12);
      transform: translateY(-2px);
    }
    .oview-desktop-icon:active {
      transform: scale(0.94);
      background: rgba(16, 185, 129, 0.2);
    }
    .oview-taskbar-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.15s;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #94a3b8;
    }
    .oview-taskbar-tab:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
    .oview-taskbar-tab.active {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #f8fafc;
    }
    .oview-start-app-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .oview-start-app-item:hover {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.3);
      transform: translateX(4px);
    }
    /* Toast Animation */
    @keyframes toastSlideIn {
      from { transform: translateX(110%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    /* Scrollbars */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.4); }
  </style>
</head>
<body>
  <div id="oview-root">
    <!-- Desktop Surface -->
    <div id="oview-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: calc(100% - 48px); padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <!-- Branding Watermark -->
      <div style="display: flex; align-items: center; gap: 12px; opacity: 0.85;">
        <span style="font-size: 32px; color: #10b981; font-weight: 800; text-shadow: 0 0 16px rgba(16, 185, 129, 0.4);">◈</span>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 20px; font-weight: 800; letter-spacing: 1px;">Oview OS</span>
          <span style="font-size: 11px; color: #10b981; font-weight: 600; letter-spacing: 0.5px;">Sovereign Substrate • ONE Lang • ECHO-1 AI Brain</span>
        </div>
      </div>

      <!-- Desktop Shortcut Icons Grid -->
      <div id="desktop-icons" style="display: flex; flex-direction: column; flex-wrap: wrap; align-content: flex-start; max-height: calc(100% - 100px); gap: 10px 14px; margin-top: 18px; z-index: 5; pointer-events: auto;">
        ${apps
          .map(
            (app) => `
          <div class="oview-desktop-icon" onclick="launchApp('${app.id}')" title="${app.name}: ${app.description}">
            <div style="font-size: 30px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));">${app.icon}</div>
            <div style="font-size: 11px; font-weight: 600; color: #f8fafc; margin-top: 4px; text-shadow: 0 1px 3px rgba(0,0,0,0.9); line-height: 1.2; word-break: break-word;">${app.name}</div>
          </div>
        `
          )
          .join('')}
      </div>

      <!-- Quick Hint -->
      <div style="font-size: 11px; color: #64748b; margin-top: auto;">
        Press <span style="padding: 2px 6px; background: rgba(255,255,255,0.08); border-radius: 4px; color: #10b981;">Ctrl + Space</span> for ECHO-1 Offline AI Search
      </div>
    </div>

    <!-- Window Compositor Layer -->
    <div id="window-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: calc(100% - 48px); pointer-events: none;"></div>

    <!-- Start Menu Flyout -->
    <div id="start-menu" style="display: none; position: absolute; bottom: 56px; left: 12px; width: 440px; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.85), 0 0 30px rgba(16, 185, 129, 0.15); padding: 20px; box-sizing: border-box; z-index: 10000;">
      <!-- Profile Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 28px;">👤</span>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 14px; font-weight: 700; color: #f8fafc;">Sovereign Operator</span>
            <span style="font-size: 11px; color: #10b981;">Oview OS v1.0.0 (Phase 2 Native Suite)</span>
          </div>
        </div>
        <span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">ECHO-1 OFFLINE</span>
      </div>

      <!-- Quick Search -->
      <div style="margin-bottom: 16px;">
        <input id="start-search-input" type="text" placeholder="Search apps, files, or ask ECHO-1..." oninput="filterStartMenu(this.value)" style="width: 100%; padding: 10px 14px; background: rgba(30, 41, 59, 0.8); border: 1.5px solid rgba(255, 255, 255, 0.12); border-radius: 10px; color: #f8fafc; font-size: 13px; outline: none; box-sizing: border-box;" />
      </div>

      <!-- App Grid -->
      <div style="font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 10px;">SYSTEM APPLICATIONS</div>
      <div id="start-apps-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
        ${apps
          .map(
            (app) => `
          <div class="oview-start-app-item" onclick="launchApp('${app.id}'); toggleStartMenu();">
            <span style="font-size: 20px;">${app.icon}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 12px; font-weight: 600; color: #f8fafc;">${app.name}</span>
              <span style="font-size: 10px; color: #94a3b8;">${app.description}</span>
            </div>
          </div>
        `
          )
          .join('')}
      </div>

      <!-- Footer Power Actions -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
        <span style="font-size: 11px; color: #94a3b8;">Address369: Memory Slots 0..368 Normal</span>
        <div style="display: flex; gap: 8px;">
          <button onclick="restartOS()" style="padding: 5px 12px; background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #f8fafc; border-radius: 6px; font-size: 11px; cursor: pointer;">Restart</button>
          <button onclick="shutdownOS()" style="padding: 5px 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; border-radius: 6px; font-size: 11px; cursor: pointer;">Shutdown</button>
        </div>
      </div>
    </div>

    <!-- Spotlight Modal Dialog -->
    <div id="spotlight-overlay" style="display: none; position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 20000; align-items: flex-start; justify-content: center; padding-top: 15vh; box-sizing: border-box;">
      <div style="width: 620px; max-width: 90vw; background: rgba(15, 23, 42, 0.98); border: 1.5px solid rgba(16, 185, 129, 0.4); border-radius: 18px; box-shadow: 0 25px 60px rgba(0,0,0,0.9), 0 0 40px rgba(16, 185, 129, 0.2); overflow: hidden; display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
          <span style="font-size: 24px;">🤖</span>
          <input id="spotlight-input" type="text" placeholder="Search apps, files, or ask ECHO-1 (Ctrl + Space)..." oninput="onSpotlightSearch(this.value)" onkeydown="if(event.key==='Enter')executeFirstSpotlight();" style="flex: 1; background: transparent; border: none; outline: none; font-size: 16px; color: #f8fafc; font-family: -apple-system, sans-serif;" />
          <span style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">ECHO-1</span>
        </div>
        <div id="spotlight-results" style="max-height: 380px; overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 4px;"></div>
        <div style="padding: 8px 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #94a3b8;">
          <span>Press [Enter] to open • [Esc] to exit</span>
          <span style="color: #10b981; font-weight: 600;">ECHO-1 4ms Latency</span>
        </div>
      </div>
    </div>

    <!-- Toast Notifications Floating Container -->
    <div id="toast-container" style="position: absolute; top: 18px; right: 18px; z-index: 30000; display: flex; flex-direction: column; gap: 10px; pointer-events: none;"></div>

    <!-- Desktop Right-Click Context Menu -->
    <div id="desktop-context-menu" style="display: none; position: absolute; z-index: 25000; width: 210px; background: rgba(18, 25, 41, 0.96); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.85); padding: 6px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
      <div onclick="contextRefresh()" style="padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #f8fafc; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">
        <span>🔄</span> <span>Refresh Desktop</span>
      </div>
      <div onclick="contextNewNote()" style="padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #f8fafc; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">
        <span>📄</span> <span>New Text Document</span>
      </div>
      <div onclick="contextNewFolder()" style="padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #f8fafc; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">
        <span>📁</span> <span>New Folder</span>
      </div>
      <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 4px 6px;"></div>
      <div onclick="contextChangeTheme()" style="padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #f8fafc; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">
        <span>🖼️</span> <span>Next Wallpaper</span>
      </div>
      <div onclick="launchApp('oview.trash'); hideContextMenu();" style="padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #f8fafc; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">
        <span>🗑️</span> <span>Open Recycle Bin</span>
      </div>
      <div onclick="launchApp('oview.settings'); hideContextMenu();" style="padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #f8fafc; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='transparent'">
        <span>⚙️</span> <span>Display Settings</span>
      </div>
    </div>

    <!-- Control Center Slide-out Panel -->
    <div id="control-center-panel" style="display: none; position: absolute; bottom: 58px; right: 12px; width: 320px; background: rgba(18, 25, 41, 0.96); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; box-shadow: 0 20px 48px rgba(0,0,0,0.85); z-index: 24000; padding: 18px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <span style="font-size: 15px; font-weight: 700; color: #f8fafc;">Control Center</span>
        <span id="cc-dnd-badge" style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: rgba(16, 185, 129, 0.2); color: #10b981;">SOVEREIGN MESH</span>
      </div>

      <!-- Quick Toggles -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
        <button id="cc-mesh-btn" onclick="toggleCcMesh()" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; font-weight: 600; font-size: 12px; cursor: pointer;">
          <span style="font-size: 16px;">📶</span> <span>Mesh: ON</span>
        </button>
        <button id="cc-focus-btn" onclick="toggleCcFocus()" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #cbd5e1; font-weight: 600; font-size: 12px; cursor: pointer;">
          <span style="font-size: 16px;">🌙</span> <span>Focus: OFF</span>
        </button>
      </div>

      <!-- Sliders -->
      <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
          <span>Volume</span> <span id="cc-vol-txt">80%</span>
        </div>
        <input type="range" id="cc-vol-slider" min="0" max="100" value="80" oninput="setCcVolume(this.value)" style="width: 100%; cursor: pointer;" />
      </div>

      <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
          <span>Display Brightness</span> <span id="cc-bright-txt">100%</span>
        </div>
        <input type="range" id="cc-bright-slider" min="20" max="100" value="100" oninput="setCcBrightness(this.value)" style="width: 100%; cursor: pointer;" />
      </div>

      <!-- Themes -->
      <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase;">Themes</div>
      <div style="display: flex; gap: 6px;">
        <button onclick="applyTheme('cyber-glass')" style="flex: 1; padding: 6px; border-radius: 6px; background: rgba(16,185,129,0.2); border: 1px solid #10b981; color: #10b981; font-size: 11px; font-weight: 700; cursor: pointer;">Cyber</button>
        <button onclick="applyTheme('deep-space')" style="flex: 1; padding: 6px; border-radius: 6px; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; font-size: 11px; font-weight: 700; cursor: pointer;">Space</button>
        <button onclick="applyTheme('neon-matrix')" style="flex: 1; padding: 6px; border-radius: 6px; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); color: #f43f5e; font-size: 11px; font-weight: 700; cursor: pointer;">Neon</button>
      </div>
    </div>

    <!-- Aero Snap 2.0 Ghost Outline Preview -->
    <div id="snap-preview-ghost" style="display: none; position: absolute; z-index: 21000; border: 2px solid #10b981; background: rgba(16, 185, 129, 0.14); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-radius: 12px; transition: all 0.15s ease-out; pointer-events: none; box-shadow: 0 0 30px rgba(16, 185, 129, 0.3);"></div>

    <!-- Alt + Tab Visual Window Switcher -->
    <div id="alt-tab-switcher" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 29000; background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); align-items: center; justify-content: center;">
      <div style="background: rgba(18, 25, 41, 0.94); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; padding: 24px; box-shadow: 0 25px 60px rgba(0,0,0,0.9); max-width: 800px; min-width: 450px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-size: 15px; font-weight: 700; color: #f8fafc;">Active Applications</span>
          <span style="font-size: 11px; color: #10b981; font-weight: 600;">Alt + Tab to Cycle • Release Alt to Select</span>
        </div>
        <div id="alt-tab-cards" style="display: flex; gap: 14px; overflow-x: auto; padding: 6px 2px;"></div>
      </div>
    </div>

    <!-- Universal Clipboard History (Win + V) -->
    <div id="clipboard-panel" style="display: none; position: absolute; bottom: 58px; right: 80px; width: 320px; background: rgba(18, 25, 41, 0.96); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; box-shadow: 0 20px 48px rgba(0,0,0,0.85); z-index: 24000; padding: 18px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">📋</span>
          <span style="font-size: 15px; font-weight: 700; color: #f8fafc;">Clipboard History</span>
        </div>
        <button onclick="clearClipboardHistory()" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; cursor: pointer;">Clear All</button>
      </div>
      <div id="clipboard-items-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto;"></div>
    </div>

    <!-- Taskbar & System Dock -->
    <div id="oview-taskbar" style="position: absolute; bottom: 0; left: 0; width: 100%; height: 48px; background: rgba(13, 18, 30, 0.94); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-top: 1px solid rgba(255, 255, 255, 0.12); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; box-sizing: border-box; z-index: 9999;">
      <!-- Left: Start + Dock Tabs -->
      <div style="display: flex; align-items: center; gap: 10px;">
        <button id="start-btn" onclick="toggleStartMenu()" style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3); transition: transform 0.1s;">
          <span style="font-size: 16px;">◈</span>
          <span>OVIEW</span>
        </button>

        <div id="taskbar-tabs" style="display: flex; align-items: center; gap: 6px; margin-left: 6px;"></div>
      </div>

      <!-- Right: System Tray & Clock -->
      <div style="display: flex; align-items: center; gap: 10px;">
        <span id="telemetry-cpu" style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">CPU: 1.2%</span>
        <span id="telemetry-ram" style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3);">RAM: 24.5MB</span>
        <span onclick="toggleSpotlight()" style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); cursor: pointer;">⚡ ECHO-1 OFFLINE</span>
        <button onclick="toggleControlCenter()" id="tray-control-btn" title="Control Center & Quick Settings" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; width: 30px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center;">🎛️</button>
        <button onclick="toggleClipboardHistory()" id="tray-clip-btn" title="Clipboard History (Win+V)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; width: 30px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center;">📋</button>
        <span id="digital-clock" style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-left: 2px; font-variant-numeric: tabular-nums;">12:00:00</span>
        <!-- Show Desktop Bar (Win+D) -->
        <div onclick="toggleShowDesktop()" title="Show Desktop (Win+D)" style="width: 6px; height: 32px; background: rgba(255,255,255,0.15); border-radius: 2px; cursor: pointer; margin-left: 4px;" onmouseover="this.style.background='#10b981'" onmouseout="this.style.background='rgba(255,255,255,0.15)'"></div>
      </div>
    </div>
  </div>

  <script>
    // ══════════════════════════════════════════════════════════════════════════
    // OVIEW OS PHASE 2 INTERACTIVE RUNTIME & APPLICATION SUITE
    // ══════════════════════════════════════════════════════════════════════════

    const APP_REGISTRY = ${JSON.stringify(apps)};
    let windows = [];
    let activeWindowId = null;
    let nextZIndex = 100;
    let isStartOpen = false;

    // In-memory Virtual File System (VFS)
    const CLIENT_VFS = {
      '/system': { type: 'dir' },
      '/system/kernel.one': { type: 'file', content: '// Oview OS Sovereign Microkernel v1.0.0\\nexport const KERNEL_CONFIG = { substrate: "ONE Language Core", slots: 369 };' },
      '/system/oview.config': { type: 'file', content: '{\\n  "theme": "cyber-glass",\\n  "accent": "#10b981",\\n  "qplayerOps": 204800000\\n}' },
      '/apps': { type: 'dir' },
      '/apps/notepad.olto': { type: 'file', content: 'component NotepadApp { ... }' },
      '/apps/explorer.olto': { type: 'file', content: 'component ExplorerApp { ... }' },
      '/user': { type: 'dir' },
      '/user/documents': { type: 'dir' },
      '/user/documents/welcome.txt': { type: 'file', content: 'Welcome to Oview OS!\\n\\nThe sovereign, zero-dependency, AI-native desktop operating system.\\nBuilt on ONE Language, fine-grained OLTO Signals, and ECHO-1 offline brain.\\n\\nEnjoy pure computing freedom!' },
      '/user/documents/notes.one': { type: 'file', content: '// Sovereign Notes App Scratchpad\\nfunction calculateMetrics(): String {\\n    return "Status: Operational | Address369 Verified";\\n}\\nprint calculateMetrics();' },
      '/user/desktop': { type: 'dir' },
      '/user/desktop/readme.txt': { type: 'file', content: 'OVIEW OS DESKTOP SHORTCUTS:\\n• Ctrl + Space: Launch ECHO-1 Offline AI Search\\n• Click Start to explore System Applications\\n• Draggable windows with snap, maximize, and minimize' },
      '/user/media': { type: 'dir' },
      '/user/media/sovereign_wave.mp3': { type: 'file', content: '// Audio Bitstream (Synthwave 128kbps)' },
      '/user/media/echo1_study_beats.mp3': { type: 'file', content: '// Audio Bitstream (Lo-Fi 128kbps)' },
      '/user/media/quantum_drift.mp3': { type: 'file', content: '// Audio Bitstream (Electronic Pulse 128kbps)' },
      '/user/flows': { type: 'dir' },
      '/user/flows/summarizer.flow': { type: 'file', content: '{"name":"Smart Note Summarizer","nodes":3}' },
      '/user/downloads': { type: 'dir' },
      '/user/downloads/sample_archive.zip': { type: 'file', content: 'PK\\x03\\x04... Sample Zip Archive' },
      '/user/documents/daily_routine.one': { type: 'file', content: '// Daily Schedule & Routine in ONE Language\\nprint "Morning: System Inspection\\nAfternoon: Architecture Plan\\nEvening: Oview Release";' },
      '/user/media/skyline_cyber.png': { type: 'file', content: 'PNG_IMAGE_DATA_CYBERPUNK_RETRO' },
      '/user/trash': { type: 'dir' },
      '/user/trash/old_draft.txt': { type: 'file', content: 'Draft of sovereign memory specs.' },
      '/user/trash/temp_notes.txt': { type: 'file', content: 'Temporary scratchpad notes.' },
      '/user/packages': { type: 'dir' },
      '/user/packages/putty_ssh.onepkg': { type: 'file', content: '{"name":"PuTTY SSH Client","version":"0.81.0","format":"onepkg","slot":105}' },
      '/user/documents/budget_2026.osheet': { type: 'file', content: '{"title":"Sovereign Budget 2026","rowCount":25,"cells":{"A1":{"raw":"Item","computed":"Item","bold":true},"C5":{"raw":"=SUM(C2:C4)","computed":"495"}}}' },
      '/user/documents/architecture_mindmap.board': { type: 'file', content: '{"title":"Architecture Mindmap","items":[{"id":"1","type":"sticky","text":"Oview OS Core"}]}' },
      '/system/marketplace': { type: 'dir' },
      '/system/marketplace/onepkg.putty_ssh.json': { type: 'file', content: '{"name":"PuTTY SSH Client","author":"Community Repacker","downloads":142}' }
    };

    // Notepad State Store
    let notepadActivePath = '/user/documents/welcome.txt';

    // Explorer Pro & My Space State Store
    let explorerCurrentDir = 'myspace'; // Default to My Space Personal Hub!
    let explorerPinnedPaths = [
      '/user/documents/welcome.txt',
      '/user/documents/daily_routine.one',
      '/user/packages/putty_ssh.onepkg'
    ];
    let explorerRecentFiles = [
      { path: '/user/documents/welcome.txt', timeAgo: '2m ago' },
      { path: '/user/documents/notes.one', timeAgo: '25m ago' },
      { path: '/user/media/sovereign_wave.mp3', timeAgo: '1h ago' },
      { path: '/user/packages/putty_ssh.onepkg', timeAgo: '3h ago' }
    ];
    let explorerCategoryFilter = 'all';
    let explorerSearchQuery = '';
    let explorerPreviewPath = null;

    // Terminal State Store
    let terminalHistory = [];
    let terminalBuffer = [
      { text: '═══════════════════════════════════════════════════════════════', type: 'system' },
      { text: '  ONE Language Sovereign REPL & System Shell (v1.3.0)', type: 'system' },
      { text: '  Qplayer Register VM (204.8M ops/sec) • Address369 Bounded', type: 'info' },
      { text: '═══════════════════════════════════════════════════════════════', type: 'system' },
      { text: "Type 'help' for available commands or 'eval <expr>' to evaluate.", type: 'output' }
    ];

    // Calculator State Store
    let calcDisplay = '0';
    let calcEquation = '';
    let calcReset = false;

    // ──────────────── 1. OVIEW NOTEPAD APP ────────────────
    function renderNotepadApp(winId) {
      const content = CLIENT_VFS[notepadActivePath] ? CLIENT_VFS[notepadActivePath].content : '';
      const lines = content.length === 0 ? 0 : content.split('\\n').length;
      const words = content.trim() === '' ? 0 : content.trim().split(/\\s+/).length;
      const chars = content.length;

      return \`
        <div style="display: flex; flex-direction: column; height: 100%; color: #f8fafc; font-family: -apple-system, sans-serif;">
          <!-- Tabs -->
          <div style="display: flex; gap: 4px; padding: 4px 8px; background: rgba(0,0,0,0.25); border-bottom: 1px solid rgba(255,255,255,0.08);">
            <div onclick="switchNotepadDoc('/user/documents/welcome.txt')" style="padding: 4px 10px; font-size: 11px; cursor: pointer; border-radius: 4px; background: \${notepadActivePath.includes('welcome') ? 'rgba(16,185,129,0.2)' : 'transparent'}; color: \${notepadActivePath.includes('welcome') ? '#10b981' : '#94a3b8'};">📄 welcome.txt</div>
            <div onclick="switchNotepadDoc('/user/documents/notes.one')" style="padding: 4px 10px; font-size: 11px; cursor: pointer; border-radius: 4px; background: \${notepadActivePath.includes('notes') ? 'rgba(16,185,129,0.2)' : 'transparent'}; color: \${notepadActivePath.includes('notes') ? '#10b981' : '#94a3b8'};">⚡ notes.one</div>
            <button onclick="newNotepadDoc()" style="padding: 2px 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; border-radius: 4px; font-size: 11px; cursor: pointer;">+ New</button>
          </div>
          <!-- Toolbar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06);">
            <div style="display: flex; gap: 6px;">
              <button onclick="saveNotepadDoc()" style="padding: 4px 12px; background: #10b981; border: none; color: #fff; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">💾 Save</button>
              <button onclick="newNotepadDoc()" style="padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px; font-size: 11px; cursor: pointer;">📄 New</button>
            </div>
            <span style="font-size: 11px; color: #10b981; font-family: monospace;">\${notepadActivePath}</span>
          </div>
          <!-- Editor -->
          <textarea id="notepad-textarea" oninput="updateNotepadMetrics()" style="flex: 1; width: 100%; box-sizing: border-box; background: transparent; border: none; outline: none; padding: 12px; color: #f8fafc; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; resize: none;">\${content}</textarea>
          <!-- Status -->
          <div style="display: flex; justify-content: space-between; padding: 4px 10px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #94a3b8; background: rgba(0,0,0,0.2);">
            <div id="notepad-metrics">Lines: \${lines} | Words: \${words} | Chars: \${chars}</div>
            <div>UTF-8 • Address369 Verified</div>
          </div>
        </div>
      \`;
    }

    function switchNotepadDoc(path) {
      notepadActivePath = path;
      renderWindows();
    }

    function newNotepadDoc() {
      const name = 'untitled_' + Math.floor(Math.random() * 100) + '.txt';
      const path = '/user/documents/' + name;
      CLIENT_VFS[path] = { type: 'file', content: '' };
      switchNotepadDoc(path);
    }

    function saveNotepadDoc() {
      const textarea = document.getElementById('notepad-textarea');
      if (textarea && CLIENT_VFS[notepadActivePath]) {
        CLIENT_VFS[notepadActivePath].content = textarea.value;
        alert('[Oview Notepad] File saved successfully to VFS: ' + notepadActivePath);
      }
    }

    function updateNotepadMetrics() {
      const textarea = document.getElementById('notepad-textarea');
      const metricsEl = document.getElementById('notepad-metrics');
      if (!textarea || !metricsEl) return;
      const text = textarea.value;
      const lines = text.length === 0 ? 0 : text.split('\\n').length;
      const words = text.trim() === '' ? 0 : text.trim().split(/\\s+/).length;
      const chars = text.length;
      metricsEl.textContent = \`Lines: \${lines} | Words: \${words} | Chars: \${chars}\`;
    }

    // ──────────────── 2. OVIEW FILE EXPLORER APP ────────────────
    function renderExplorerApp(winId) {
      const isMySpace = explorerCurrentDir === 'myspace';

      // Calculate Storage Health
      let totalVfsBytes = 0;
      let docsCount = 0;
      let mediaCount = 0;
      let packagesCount = 0;
      let downloadsCount = 0;
      let trashCount = 0;

      for (const [vPath, node] of Object.entries(CLIENT_VFS)) {
        if (node.content) totalVfsBytes += node.content.length;
        if (vPath.startsWith('/user/documents/')) docsCount++;
        else if (vPath.startsWith('/user/media/')) mediaCount++;
        else if (vPath.startsWith('/user/packages/')) packagesCount++;
        else if (vPath.startsWith('/user/downloads/')) downloadsCount++;
        else if (vPath.startsWith('/user/trash/')) trashCount++;
      }

      const totalQuota = 500 * 1024 * 1024; // 500 MB
      const usagePercent = Math.min(100, Math.round((totalVfsBytes / (1024 * 1024 * 10)) * 100) || 12);

      // List entries in current dir
      const items = [];
      if (!isMySpace) {
        const prefix = explorerCurrentDir === '/' ? '/' : explorerCurrentDir + '/';
        for (const [vPath, node] of Object.entries(CLIENT_VFS)) {
          if (vPath === explorerCurrentDir) continue;
          if (vPath.startsWith(prefix)) {
            const sub = vPath.slice(prefix.length);
            if (!sub.includes('/')) {
              if (explorerSearchQuery && !sub.toLowerCase().includes(explorerSearchQuery.toLowerCase())) {
                continue;
              }
              const isPinned = explorerPinnedPaths.includes(vPath);
              items.push({
                name: sub,
                path: vPath,
                type: node.type,
                size: node.content ? node.content.length : 0,
                isPinned
              });
            }
          }
        }
      }

      // Preview Node
      let previewNode = null;
      if (explorerPreviewPath && CLIENT_VFS[explorerPreviewPath]) {
        const n = CLIENT_VFS[explorerPreviewPath];
        const pName = explorerPreviewPath.split('/').pop();
        previewNode = {
          path: explorerPreviewPath,
          name: pName,
          type: n.type,
          size: n.content ? n.content.length : 0,
          content: n.content || '',
          isPinned: explorerPinnedPaths.includes(explorerPreviewPath)
        };
      }

      return \`
        <div style="display: flex; flex-direction: column; height: 100%; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19;">
          <!-- Top Navigation & Toolbar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(15, 23, 42, 0.7); border-bottom: 1px solid rgba(255,255,255,0.08); gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <button onclick="explorerNavigate('myspace')" style="padding: 4px 10px; border-radius: 6px; border: 1px solid \${isMySpace ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}; background: \${isMySpace ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)'}; color: \${isMySpace ? '#10b981' : '#fff'}; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 5px;">
                <span>🏠</span> My Space
              </button>
              <button onclick="explorerNavigateUp()" style="padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #fff; cursor: pointer; font-size: 11px;">▲ Up</button>
              
              <!-- Address Breadcrumb -->
              <div style="display: flex; align-items: center; padding: 4px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; font-size: 12px; font-family: monospace; color: #38bdf8; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                \${isMySpace ? '🏠 My Space' : explorerCurrentDir}
              </div>
            </div>

            <!-- Search Filter -->
            <div style="position: relative; width: 170px;">
              <input type="text" placeholder="🔍 Search files..." value="\${explorerSearchQuery}" oninput="explorerSearch(this.value)" style="width: 100%; box-sizing: border-box; padding: 4px 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 11px; outline: none;" />
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 6px;">
              <button onclick="explorerCreateFile()" style="padding: 4px 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #10b981; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">+ File</button>
              <button onclick="explorerCreateFolder()" style="padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px; font-size: 11px; cursor: pointer;">+ Folder</button>
            </div>
          </div>

          <!-- Main Layout -->
          <div style="display: flex; flex: 1; overflow: hidden;">
            <!-- Left Sidebar -->
            <div style="width: 165px; border-right: 1px solid rgba(255,255,255,0.08); padding: 12px 8px; display: flex; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.25); font-size: 12px;">
              <div style="font-size: 10px; font-weight: 700; color: #94a3b8; padding: 4px 8px; letter-spacing: 0.5px;">MY SPACE</div>
              <div onclick="explorerNavigate('myspace')" style="padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; \${isMySpace ? 'background: rgba(16,185,129,0.2); color: #10b981; font-weight: 600;' : 'color: #f1f5f9;'}">
                <span>🏠</span> My Space
              </div>
              <div onclick="explorerNavigate('/user/documents')" style="padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; \${explorerCurrentDir === '/user/documents' ? 'background: rgba(16,185,129,0.2); color: #10b981; font-weight: 600;' : 'color: #f1f5f9;'}">
                <span>📄</span> Documents
              </div>
              <div onclick="explorerNavigate('/user/media')" style="padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; \${explorerCurrentDir === '/user/media' ? 'background: rgba(16,185,129,0.2); color: #10b981; font-weight: 600;' : 'color: #f1f5f9;'}">
                <span>🖼️</span> Pictures & Media
              </div>
              <div onclick="explorerNavigate('/user/packages')" style="padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; \${explorerCurrentDir === '/user/packages' ? 'background: rgba(16,185,129,0.2); color: #10b981; font-weight: 600;' : 'color: #f1f5f9;'}">
                <span>📦</span> My Apps
              </div>
              <div onclick="explorerNavigate('/user/downloads')" style="padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; \${explorerCurrentDir === '/user/downloads' ? 'background: rgba(16,185,129,0.2); color: #10b981; font-weight: 600;' : 'color: #f1f5f9;'}">
                <span>📥</span> Downloads
              </div>
              <div onclick="explorerNavigate('/user/trash')" style="padding: 6px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; \${explorerCurrentDir === '/user/trash' ? 'background: rgba(16,185,129,0.2); color: #10b981; font-weight: 600;' : 'color: #f1f5f9;'}">
                <span>🗑️</span> Recycle Bin
              </div>

              <!-- Storage Health Widget -->
              <div style="margin-top: auto; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); font-size: 11px;">
                <div style="color: #94a3b8; font-size: 10px; font-weight: 700; margin-bottom: 6px;">STORAGE HEALTH</div>
                <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 6px;">
                  <div style="height: 100%; width: \${usagePercent}%; background: linear-gradient(90deg, #10b981, #06b6d4);"></div>
                </div>
                <div style="color: #64748b; font-size: 10px;">\${usagePercent}% Used (500 MB Quota)</div>
              </div>
            </div>

            <!-- Content Area -->
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: rgba(15, 23, 42, 0.4);" ondragover="event.preventDefault()" ondrop="explorerHandleDrop(event)">
              \${isMySpace ? \`
                <!-- 🏠 MY SPACE DASHBOARD VIEW -->
                <div style="flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
                  <!-- Header Hero -->
                  <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <div>
                      <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                        <span>🏠</span> My Space Personal Hub
                      </h2>
                      <p style="margin: 3px 0 0; font-size: 11px; color: #94a3b8;">Sovereign desktop file dashboard, quick categories, and offline backups</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button onclick="explorerFilterCategory('all')" style="padding: 4px 10px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(255,255,255,0.1); background: \${explorerCategoryFilter === 'all' ? '#10b981' : 'transparent'}; color: \${explorerCategoryFilter === 'all' ? '#000' : '#fff'}; cursor: pointer; font-weight: 600;">All Folders</button>
                    </div>
                  </div>

                  <!-- 5 Standard Categories Cards -->
                  <div>
                    <div style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 10px;">DAILY FOLDERS</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px;">
                      <div onclick="explorerNavigate('/user/documents')" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s;">
                        <span style="font-size: 26px;">📄</span>
                        <div style="font-weight: 600; font-size: 12px; color: #fff; margin-top: 6px;">Documents</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">\${docsCount} files</div>
                      </div>
                      <div onclick="explorerNavigate('/user/media')" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s;">
                        <span style="font-size: 26px;">🖼️</span>
                        <div style="font-weight: 600; font-size: 12px; color: #fff; margin-top: 6px;">Pictures & Media</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">\${mediaCount} files</div>
                      </div>
                      <div onclick="explorerNavigate('/user/packages')" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s;">
                        <span style="font-size: 26px;">📦</span>
                        <div style="font-weight: 600; font-size: 12px; color: #fff; margin-top: 6px;">My Apps (.onepkg)</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">\${packagesCount} packages</div>
                      </div>
                      <div onclick="explorerNavigate('/user/downloads')" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s;">
                        <span style="font-size: 26px;">📥</span>
                        <div style="font-weight: 600; font-size: 12px; color: #fff; margin-top: 6px;">Downloads</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">\${downloadsCount} items</div>
                      </div>
                      <div onclick="explorerNavigate('/user/trash')" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s;">
                        <span style="font-size: 26px;">🗑️</span>
                        <div style="font-weight: 600; font-size: 12px; color: #fff; margin-top: 6px;">Recycle Bin</div>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">\${trashCount} items</div>
                      </div>
                    </div>
                  </div>

                  <!-- ⭐ Starred & Pinned Favorites -->
                  <div>
                    <div style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                      <span>⭐</span> PINNED & FAVORITES
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
                      \${explorerPinnedPaths.map(p => {
                        const name = p.split('/').pop();
                        const isPkg = name.endsWith('.onepkg');
                        const isOne = name.endsWith('.one');
                        const isMp3 = name.endsWith('.mp3');
                        const icon = isPkg ? '📦' : (isOne ? '⚡' : (isMp3 ? '🎵' : '📄'));
                        return \`
                          <div onclick="explorerOpenFile('\${p}')" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer;">
                            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                              <span style="font-size: 18px;">\${icon}</span>
                              <div style="overflow: hidden;">
                                <div style="font-size: 11px; font-weight: 600; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">\${name}</div>
                                <div style="font-size: 9px; color: #94a3b8;">\${p}</div>
                              </div>
                            </div>
                            <button onclick="explorerTogglePin('\${p}', event)" style="background: transparent; border: none; color: #fbbf24; cursor: pointer; font-size: 14px;" title="Unpin">★</button>
                          </div>
                        \`;
                      }).join('')}
                    </div>
                  </div>

                  <!-- 🕒 Recent Files Activity -->
                  <div>
                    <div style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                      <span>🕒</span> RECENT ACTIVITY
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      \${explorerRecentFiles.map(r => {
                        const name = r.path.split('/').pop();
                        const isPkg = name.endsWith('.onepkg');
                        const isOne = name.endsWith('.one');
                        const isMp3 = name.endsWith('.mp3');
                        const icon = isPkg ? '📦' : (isOne ? '⚡' : (isMp3 ? '🎵' : '📄'));
                        return \`
                          <div onclick="explorerOpenFile('\${r.path}')" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; border-radius: 6px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); cursor: pointer;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <span>\${icon}</span>
                              <span style="font-size: 11px; font-weight: 500; color: #fff;">\${name}</span>
                              <span style="font-size: 9px; color: #64748b;">(\${r.path})</span>
                            </div>
                            <span style="font-size: 10px; color: #64748b;">\${r.timeAgo}</span>
                          </div>
                        \`;
                      }).join('')}
                    </div>
                  </div>

                  <!-- 📥 Drag & Drop Zone from Windows -->
                  <div style="border: 2px dashed rgba(16,185,129,0.3); border-radius: 8px; padding: 14px; text-align: center; background: rgba(16,185,129,0.03); color: #94a3b8; font-size: 11px;">
                    📥 <strong style="color: #10b981;">Drag & Drop files from Windows</strong> here to import directly into Oview OS Sovereign Storage.
                  </div>
                </div>
              \` : \`
                <!-- 📁 STANDARD FOLDER VIEW WITH PREVIEW -->
                <div style="flex: 1; display: flex; overflow: hidden;">
                  <!-- Items Grid -->
                  <div style="flex: 1; padding: 14px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)); gap: 12px; align-content: start;">
                    \${items.map(item => \`
                      <div onclick="\${item.type === 'dir' ? \`explorerNavigate('\${item.path}')\` : \`explorerQuickLook('\${item.path}', event)\`}" ondblclick="\${item.type === 'dir' ? \`explorerNavigate('\${item.path}')\` : \`explorerOpenFile('\${item.path}')\`}" style="position: relative; display: flex; flex-direction: column; align-items: center; padding: 10px 6px; border-radius: 8px; cursor: pointer; text-align: center; background: \${explorerPreviewPath === item.path ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)'}; border: 1px solid \${explorerPreviewPath === item.path ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)'}; transition: background 0.15s;">
                        <button onclick="explorerTogglePin('\${item.path}', event)" style="position: absolute; top: 4px; right: 4px; background: transparent; border: none; font-size: 12px; cursor: pointer; color: \${item.isPinned ? '#fbbf24' : 'rgba(255,255,255,0.2)'};" title="Star / Pin">
                          \${item.isPinned ? '★' : '☆'}
                        </button>
                        <span style="font-size: 28px;">\${item.type === 'dir' ? '📁' : (item.name.endsWith('.onepkg') ? '📦' : (item.name.endsWith('.one') ? '⚡' : (item.name.endsWith('.mp3') ? '🎵' : '📄')))}</span>
                        <span style="font-size: 11px; font-weight: 600; color: #f8fafc; margin-top: 4px; word-break: break-all;">\${item.name}</span>
                        <span style="font-size: 10px; color: #94a3b8; margin-top: 2px;">\${item.type === 'dir' ? 'Folder' : item.size + ' B'}</span>
                      </div>
                    \`).join('')}
                    \${items.length === 0 ? \`
                      <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #64748b; font-size: 12px;">
                        This folder is empty or no files match "\${explorerSearchQuery}"
                      </div>
                    \` : ''}
                  </div>

                  <!-- Quick-Look Preview Pane -->
                  \${previewNode ? \`
                    <div style="width: 220px; border-left: 1px solid rgba(255,255,255,0.08); padding: 12px; display: flex; flex-direction: column; gap: 10px; background: rgba(0,0,0,0.3); font-size: 11px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: #cbd5e1;">PREVIEW</span>
                        <button onclick="explorerQuickLook(null, event)" style="background: transparent; border: none; color: #64748b; cursor: pointer; font-size: 12px;">✕</button>
                      </div>
                      <div style="text-align: center; padding: 10px 0;">
                        <span style="font-size: 36px;">\${previewNode.name.endsWith('.onepkg') ? '📦' : (previewNode.name.endsWith('.one') ? '⚡' : (previewNode.name.endsWith('.mp3') ? '🎵' : '📄'))}</span>
                        <div style="font-weight: 600; color: #fff; font-size: 12px; margin-top: 6px; word-break: break-all;">\${previewNode.name}</div>
                        <div style="color: #94a3b8; font-size: 10px;">\${previewNode.size} bytes</div>
                      </div>

                      <div style="flex: 1; overflow: hidden; background: rgba(0,0,0,0.4); border-radius: 6px; padding: 8px; border: 1px solid rgba(255,255,255,0.06); font-family: monospace; font-size: 10px; color: #94a3b8; white-space: pre-wrap; word-break: break-all; overflow-y: auto;">
                        \${previewNode.content.slice(0, 300) || '(No preview content)'}
                      </div>

                      <div style="display: flex; flex-direction: column; gap: 6px;">
                        <button onclick="explorerOpenFile('\${previewNode.path}')" style="padding: 6px; border-radius: 6px; background: #10b981; border: none; color: #000; font-weight: 600; cursor: pointer; font-size: 11px;">
                          \${previewNode.name.endsWith('.onepkg') ? '🚀 Open in Packager' : (previewNode.name.endsWith('.mp3') ? '▶ Play in Oplayer' : '✏️ Open in Notepad')}
                        </button>
                        <button onclick="explorerTogglePin('\${previewNode.path}', event)" style="padding: 5px; border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; cursor: pointer; font-size: 10px;">
                          \${previewNode.isPinned ? '★ Unpin from My Space' : '☆ Pin to My Space'}
                        </button>
                      </div>
                    </div>
                  \` : ''}
                </div>
              \`}
            </div>
          </div>

          <!-- Status Bar -->
          <div style="padding: 4px 12px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #94a3b8; background: rgba(0,0,0,0.3); display: flex; justify-content: space-between;">
            <span>\${isMySpace ? '🏠 My Space Hub (Online)' : items.length + ' items'}</span>
            <span>Sovereign Virtual File System (100% Offline)</span>
          </div>
        </div>
      \`;
    }

    function explorerNavigate(path) {
      explorerCurrentDir = path;
      explorerPreviewPath = null;
      renderWindows();
    }

    function explorerNavigateUp() {
      if (explorerCurrentDir === 'myspace') return;
      if (explorerCurrentDir === '/' || explorerCurrentDir === '/user') {
        explorerCurrentDir = 'myspace';
      } else {
        const parts = explorerCurrentDir.split('/').filter(Boolean);
        parts.pop();
        explorerCurrentDir = parts.length === 0 ? '/' : '/' + parts.join('/');
      }
      explorerPreviewPath = null;
      renderWindows();
    }

    function explorerOpenFile(path) {
      explorerRecentFiles = explorerRecentFiles.filter(r => r.path !== path);
      explorerRecentFiles.unshift({ path, timeAgo: 'Just now' });
      if (explorerRecentFiles.length > 8) explorerRecentFiles.pop();

      if (path.endsWith('.mp3')) {
        launchApp('oview.oplayer');
      } else if (path.endsWith('.onepkg')) {
        launchApp('oview.opackager');
      } else {
        notepadActivePath = path;
        launchApp('oview.notepad');
      }
      renderWindows();
    }

    function explorerTogglePin(path, ev) {
      if (ev) ev.stopPropagation();
      const idx = explorerPinnedPaths.indexOf(path);
      if (idx >= 0) {
        explorerPinnedPaths.splice(idx, 1);
        pushToast('Unpinned from My Space', 'info');
      } else {
        explorerPinnedPaths.push(path);
        pushToast('Pinned to My Space ⭐', 'success');
      }
      renderWindows();
    }

    function explorerQuickLook(path, ev) {
      if (ev) ev.stopPropagation();
      explorerPreviewPath = explorerPreviewPath === path ? null : path;
      renderWindows();
    }

    function explorerFilterCategory(cat) {
      explorerCategoryFilter = cat;
      renderWindows();
    }

    function explorerSearch(q) {
      explorerSearchQuery = q;
      renderWindows();
    }

    function explorerHandleDrop(ev) {
      ev.preventDefault();
      if (!ev.dataTransfer || !ev.dataTransfer.files || ev.dataTransfer.files.length === 0) return;
      const file = ev.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        const targetDir = explorerCurrentDir === 'myspace' ? '/user/documents' : explorerCurrentDir;
        const fullPath = targetDir + '/' + file.name;
        CLIENT_VFS[fullPath] = { type: 'file', content: e.target.result };
        explorerRecentFiles.unshift({ path: fullPath, timeAgo: 'Just imported' });
        pushToast('Imported from Windows: ' + file.name, 'success');
        renderWindows();
      };
      reader.readAsText(file);
    }

    function explorerCreateFile() {
      const name = prompt('Enter new file name:', 'new_file.txt');
      if (name) {
        const dir = explorerCurrentDir === 'myspace' ? '/user/documents' : explorerCurrentDir;
        const full = (dir === '/' ? '' : dir) + '/' + name;
        CLIENT_VFS[full] = { type: 'file', content: '' };
        renderWindows();
      }
    }

    function explorerCreateFolder() {
      const name = prompt('Enter new folder name:', 'new_folder');
      if (name) {
        const dir = explorerCurrentDir === 'myspace' ? '/user/documents' : explorerCurrentDir;
        const full = (dir === '/' ? '' : dir) + '/' + name;
        CLIENT_VFS[full] = { type: 'dir' };
        renderWindows();
      }
    }

    // ──────────────── 3. OVIEW TERMINAL APP ────────────────
    function renderTerminalApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #060910; color: #10b981; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; padding: 12px; box-sizing: border-box; overflow: hidden;">
          <!-- Buffer -->
          <div id="term-buffer" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
            \${terminalBuffer.map(l => {
              let c = '#cbd5e1';
              if (l.type === 'input') c = '#38bdf8';
              else if (l.type === 'error') c = '#ef4444';
              else if (l.type === 'system') c = '#10b981';
              else if (l.type === 'info') c = '#a78bfa';
              return \`<div style="color: \${c}; white-space: pre-wrap; line-height: 1.5;">\${l.text}</div>\`;
            }).join('')}
          </div>
          <!-- Input -->
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
            <span style="color: #10b981; font-weight: 700;">[oview ~] $</span>
            <input id="term-input" type="text" placeholder="Type help, version, mem, eval 2+2..." onkeydown="handleTerminalKey(event)" style="flex: 1; background: transparent; border: none; outline: none; color: #f8fafc; font-family: inherit; font-size: 12px;" />
          </div>
        </div>
      \`;
    }

    function handleTerminalKey(e) {
      if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (!val) return;
        e.target.value = '';
        executeTerminalCommand(val);
      }
    }

    function executeTerminalCommand(cmdStr) {
      terminalBuffer.push({ text: '[oview ~] $ ' + cmdStr, type: 'input' });
      const parts = cmdStr.split(/\\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      let out = '';
      let type = 'output';

      if (cmd === 'help') {
        out = 'Commands:\\n  help       - Show help\\n  version    - Version specifications\\n  eval <ex>  - Evaluate expression\\n  vfs ls     - List VFS files\\n  vfs cat <p>- Read VFS file\\n  mem        - Address369 spatial memory map\\n  telemetry  - CPU and RAM status\\n  clear      - Clear buffer\\n  echo <txt> - Print text';
      } else if (cmd === 'version') {
        out = 'Oview OS: v1.0.0 (Phase 2 Native Suite)\\nONE Language: v1.3.0\\nQplayer VM: 204.8M ops/sec\\nECHO-1: 24.56 MB (4.89M Parameters)';
        type = 'info';
      } else if (cmd === 'clear') {
        terminalBuffer = [];
        renderWindows();
        return;
      } else if (cmd === 'echo') {
        out = args.join(' ');
      } else if (cmd === 'mem') {
        out = 'ADDRESS369 SPATIAL MEMORY MAP:\\n  Slots 0..9    : Kernel & ECHO-1 Brain (Protected)\\n  Slots 10..19  : Notepad & File Explorer (Active)\\n  Slots 20..29  : Terminal & Calculator (Active)\\n  Slots 30..359 : Available for User Apps\\n  Slots 360..368: Checkpoint Ring\\n  Invariant E9001: 100% Enforced';
        type = 'info';
      } else if (cmd === 'telemetry') {
        out = 'CPU Usage: 1.4%\\nMemory: 28.2MB / 1024MB\\nActive Processes: ' + windows.length + '\\nSpatial Slots Allocated: ' + (windows.length + 1) + ' / 369';
        type = 'info';
      } else if (cmd === 'eval') {
        try {
          const res = Function('"use strict"; return (' + args.join(' ') + ')')();
          out = '[Result]: ' + res;
          type = 'info';
        } catch(err) {
          out = '[Error]: ' + err.message;
          type = 'error';
        }
      } else if (cmd === 'vfs') {
        if (args[0] === 'ls') {
          out = Object.keys(CLIENT_VFS).join('\\n');
        } else if (args[0] === 'cat') {
          const node = CLIENT_VFS[args[1]];
          out = node ? node.content : 'File not found: ' + args[1];
        } else {
          out = 'Usage: vfs ls, vfs cat <path>';
        }
      } else {
        // Try eval
        try {
          const res = Function('"use strict"; return (' + cmdStr + ')')();
          out = '[Result]: ' + res;
          type = 'info';
        } catch {
          out = "Command not recognized: '" + cmd + "'. Type 'help' for command list.";
          type = 'error';
        }
      }

      terminalBuffer.push({ text: out, type });
      renderWindows();
      setTimeout(() => {
        const buf = document.getElementById('term-buffer');
        if (buf) buf.scrollTop = buf.scrollHeight;
        const inp = document.getElementById('term-input');
        if (inp) inp.focus();
      }, 50);
    }

    // ──────────────── 4. OVIEW CALCULATOR APP ────────────────
    function renderCalculatorApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; padding: 12px; box-sizing: border-box; font-family: -apple-system, sans-serif; color: #f8fafc;">
          <!-- Screen -->
          <div style="background: rgba(0, 0, 0, 0.4); border: 1.5px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-height: 58px;">
            <span style="font-size: 11px; color: #94a3b8; margin-bottom: 2px;">\${calcEquation}</span>
            <span style="font-size: 26px; font-weight: 700; color: #10b981; font-family: monospace;">\${calcDisplay}</span>
          </div>
          <!-- Grid Keypad -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; flex: 1;">
            <button onclick="calcClear()" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.08); font-size: 16px;">C</button>
            <button onclick="calcSign()" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.08); font-size: 16px;">±</button>
            <button onclick="calcBack()" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.08); font-size: 16px;">⌫</button>
            <button onclick="calcOp('÷')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(16,185,129,0.2); color: #10b981; font-size: 16px;">÷</button>

            <button onclick="calcDigit('7')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">7</button>
            <button onclick="calcDigit('8')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">8</button>
            <button onclick="calcDigit('9')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">9</button>
            <button onclick="calcOp('×')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(16,185,129,0.2); color: #10b981; font-size: 16px;">×</button>

            <button onclick="calcDigit('4')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">4</button>
            <button onclick="calcDigit('5')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">5</button>
            <button onclick="calcDigit('6')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">6</button>
            <button onclick="calcOp('-')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(16,185,129,0.2); color: #10b981; font-size: 16px;">-</button>

            <button onclick="calcDigit('1')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">1</button>
            <button onclick="calcDigit('2')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">2</button>
            <button onclick="calcDigit('3')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">3</button>
            <button onclick="calcOp('+')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(16,185,129,0.2); color: #10b981; font-size: 16px;">+</button>

            <button onclick="calcDigit('0')" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px; grid-column: span 2;">0</button>
            <button onclick="calcDot()" class="oview-window-ctrl" style="width: auto; height: auto; background: rgba(255,255,255,0.05); font-size: 16px;">.</button>
            <button onclick="calcEquals()" class="oview-window-ctrl" style="width: auto; height: auto; background: #10b981; color: #fff; font-size: 16px; font-weight: 700;">=</button>
          </div>
        </div>
      \`;
    }

    function calcDigit(d) {
      if (calcReset || calcDisplay === '0') {
        calcDisplay = d;
        calcReset = false;
      } else {
        calcDisplay += d;
      }
      renderWindows();
    }

    function calcDot() {
      if (calcReset) {
        calcDisplay = '0.';
        calcReset = false;
      } else if (!calcDisplay.includes('.')) {
        calcDisplay += '.';
      }
      renderWindows();
    }

    function calcOp(op) {
      calcReset = false;
      const last = calcDisplay.slice(-1);
      if (['+', '-', '×', '÷'].includes(last)) {
        calcDisplay = calcDisplay.slice(0, -1) + op;
      } else {
        calcDisplay += op;
      }
      renderWindows();
    }

    function calcClear() {
      calcDisplay = '0';
      calcEquation = '';
      calcReset = false;
      renderWindows();
    }

    function calcBack() {
      if (calcDisplay.length <= 1) calcDisplay = '0';
      else calcDisplay = calcDisplay.slice(0, -1);
      renderWindows();
    }

    function calcSign() {
      if (calcDisplay !== '0') {
        calcDisplay = calcDisplay.startsWith('-') ? calcDisplay.slice(1) : '-' + calcDisplay;
      }
      renderWindows();
    }

    function calcEquals() {
      const expr = calcDisplay.replace(/×/g, '*').replace(/÷/g, '/');
      try {
        const res = Function('"use strict"; return (' + expr + ')')();
        calcEquation = calcDisplay + ' =';
        calcDisplay = String(Number(res.toFixed(8)));
        calcReset = true;
      } catch {
        calcDisplay = 'Error';
        calcReset = true;
      }
      renderWindows();
    }

    // ──────────────── 5. OVIEW SETTINGS APP ────────────────
    function renderSettingsApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; gap: 16px; height: 100%; padding: 16px; box-sizing: border-box; overflow-y: auto;">
          <div style="font-size: 15px; font-weight: 700; color: #10b981;">Desktop Themes & Personalization</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            <div onclick="applyTheme('cyber-glass')" style="padding: 12px; border-radius: 8px; border: 2px solid #10b981; background: rgba(16,185,129,0.12); cursor: pointer; text-align: center;">
              <div style="font-size: 13px; font-weight: 700; color: #10b981;">Cyber Glass</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Emerald Glow (Default)</div>
            </div>
            <div onclick="applyTheme('deep-space')" style="padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); cursor: pointer; text-align: center;">
              <div style="font-size: 13px; font-weight: 700; color: #38bdf8;">Deep Space</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Electric Blue</div>
            </div>
            <div onclick="applyTheme('neon-matrix')" style="padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); cursor: pointer; text-align: center;">
              <div style="font-size: 13px; font-weight: 700; color: #f43f5e;">Neon Matrix</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Cyberpunk Red</div>
            </div>
          </div>
          <div style="margin-top: 8px; padding: 14px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 13px; font-weight: 600; color: #f8fafc; margin-bottom: 8px;">Address369 & Architecture Invariants</div>
            <div style="font-size: 12px; color: #94a3b8; line-height: 1.8;">
              • Address369 Bounded Spatial Slots: Active [Slots 0..368]<br>
              • Microkernel & ECHO-1 Brain Footprint: 24.56 MB (100% Offline)<br>
              • Qplayer Register VM Execution: 204.8M ops/sec<br>
              • Invariant E9001 (Zero Secret Leakage): Verified Fail-Closed
            </div>
          </div>
        </div>
      \`;
    }

    function applyTheme(theme) {
      const root = document.getElementById('oview-root');
      if (theme === 'cyber-glass') {
        root.style.background = 'radial-gradient(circle at 15% 15%, rgba(16, 185, 129, 0.16) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(59, 130, 246, 0.14) 0%, transparent 45%), #090d16';
      } else if (theme === 'deep-space') {
        root.style.background = 'radial-gradient(circle at 15% 15%, rgba(56, 189, 248, 0.2) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(99, 102, 241, 0.18) 0%, transparent 45%), #030712';
      } else if (theme === 'neon-matrix') {
        root.style.background = 'radial-gradient(circle at 15% 15%, rgba(244, 63, 94, 0.22) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(234, 88, 12, 0.18) 0%, transparent 45%), #0a0508';
      }
      if (typeof showToast === 'function') {
        showToast('Theme Changed', 'Switched to ' + theme + ' theme', 'info');
      }
    }

    // ──────────────── 6. ECHO-1 SPOTLIGHT APP ────────────────
    function renderSpotlightApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; gap: 14px; height: 100%;">
          <div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(30, 41, 59, 0.8); border: 1.5px solid #10b981; border-radius: 10px;">
            <span style="font-size: 20px;">🤖</span>
            <input id="echo-query-input" type="text" placeholder="Ask ECHO-1 AI anything or control Oview OS..." value="Explain Address369 memory slots" style="flex: 1; background: transparent; border: none; outline: none; color: #f8fafc; font-size: 13px;" />
            <button onclick="askEcho()" style="padding: 4px 12px; background: #10b981; border: none; border-radius: 6px; color: #fff; font-weight: 600; font-size: 11px; cursor: pointer;">Ask</button>
          </div>
          <div id="echo-response-box" style="flex: 1; background: rgba(0,0,0,0.3); border-radius: 10px; padding: 14px; font-size: 12px; line-height: 1.6; color: #cbd5e1; overflow-y: auto;">
            <div style="font-weight: 700; color: #10b981; margin-bottom: 6px;">ECHO-1 Local Brain Response (4ms Latency):</div>
            Address369 defines 369 bounded spatial memory slots [0..368] in ONE Language. Slots 0-9 are dedicated to the OS kernel, slots 10-359 are assigned to user applications, and slots 360-368 manage emergency checkpointing.
          </div>
        </div>
      \`;
    }

    function askEcho() {
      const inp = document.getElementById('echo-query-input');
      const box = document.getElementById('echo-response-box');
      if (!inp || !box) return;
      const q = inp.value.trim();
      box.innerHTML = \`<div style="font-weight: 700; color: #10b981; margin-bottom: 6px;">ECHO-1 Local Brain Thinking...</div>Generating sovereign offline response for: "\${q}"...\`;
      setTimeout(() => {
        box.innerHTML = \`
          <div style="font-weight: 700; color: #10b981; margin-bottom: 6px;">ECHO-1 Local Brain Response (4ms Latency):</div>
          Processed command: "<b>\${q}</b>".<br/><br/>
          Oview OS executes all intents through the sovereign ONE Language substrate with zero external cloud dependencies.
        \`;
      }, 200);
    }

    const APP_RENDERERS = {
      'oview.notepad': renderNotepadApp,
      'oview.explorer': renderExplorerApp,
      'oview.terminal': renderTerminalApp,
      'oview.calculator': renderCalculatorApp,
      'oview.settings': renderSettingsApp,
      'oview.spotlight': renderSpotlightApp,
      'oview.cubio': renderCubioApp,
      'oview.spacemanager': renderSpaceManagerApp,
      'oview.artcanvas': renderArtCanvasApp,
      'oview.rxp': renderRxpApp,
      'oview.ogallery': renderOgalleryApp,
      'oview.clock': renderClockApp,
      'oview.weather': renderWeatherApp,
      'oview.recorder': renderRecorderApp,
      'oview.oarchive': renderOarchiveApp,
      'oview.trash': renderTrashApp,
      'oview.flow': renderFlowApp,
      'oview.taskmgr': renderTaskManagerApp,
      'oview.player': renderPlayerApp,
      'oview.opackager': renderOPackagerApp,
      'oview.osheets': renderOsheetsApp,
      'oview.ocanvas': renderOcanvasApp
    };

    // ──────────────── 7. CUBIO BROWSER (FREETREE ENGINE) ────────────────
    let cubioCurrentUrl = 'cubio://home';
    function renderCubioApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #0c1222; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Navigation Bar -->
          <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255,255,255,0.08);">
            <button onclick="cubioNavigate('cubio://home')" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #cbd5e1; width: 28px; height: 28px; border-radius: 6px; cursor: pointer;">🏠</button>
            <button onclick="cubioNavigate(cubioCurrentUrl)" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #cbd5e1; width: 28px; height: 28px; border-radius: 6px; cursor: pointer;">↻</button>
            <div style="flex: 1; display: flex; align-items: center; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 0 10px; height: 32px;">
              <span style="font-size: 12px; margin-right: 6px;" title="FreeTree Isolated Sandbox">🛡️</span>
              <input id="cubio-url-bar" type="text" value="\${cubioCurrentUrl}" onkeydown="if(event.key==='Enter') cubioNavigate(this.value)" style="flex: 1; background: transparent; border: none; color: #f8fafc; font-size: 12px; outline: none; font-family: monospace;" />
              <button onclick="cubioNavigate(document.getElementById('cubio-url-bar').value)" style="background: #10b981; border: none; color: #022c22; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;">GO</button>
            </div>
            <button onclick="cubioToggleDevTools()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #cbd5e1; height: 28px; padding: 0 8px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">🛠️ DevTools</button>
          </div>

          <!-- Viewport -->
          <div style="flex: 1; overflow-y: auto; position: relative;" id="cubio-viewport-content">
            \${renderCubioPageContent(cubioCurrentUrl)}
          </div>

          <!-- Footer Status -->
          <div style="height: 22px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; padding: 0 10px; font-size: 11px; color: #64748b;">
            <span>FreeTree Engine: Ready (204.8M ops/s VM Target)</span>
            <span>Spatial Slot: [Address369 #40]</span>
          </div>
        </div>
      \`;
    }

    function renderCubioPageContent(url) {
      if (url === 'cubio://docs') {
        return \`
          <div style="max-width: 800px; margin: 0 auto; padding: 24px; color: #f8fafc;">
            <h1 style="color: #10b981; font-size: 24px; margin-bottom: 8px;">FreeTree Engine Specifications</h1>
            <p style="color: #94a3b8; font-size: 13px; margin-bottom: 20px;">V8-Equivalent Sovereign Execution Pipeline</p>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 18px; margin-bottom: 16px;">
              <h3 style="color: #f8fafc; font-size: 15px; margin-bottom: 8px;">1. Zero-Bloat DOM Tree</h3>
              <p style="color: #cbd5e1; font-size: 12px; line-height: 1.6;">FreeTree replaces Chromium's 30M lines of C++ with lightweight, signal-driven AST evaluation directly linked to Qplayer VM.</p>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 18px;">
              <h3 style="color: #f8fafc; font-size: 15px; margin-bottom: 8px;">2. Address369 Micro-Sandboxing</h3>
              <p style="color: #cbd5e1; font-size: 12px; line-height: 1.6;">Each tab runs in a dedicated Address369 slot with fail-closed security boundary (Invariant E9001).</p>
            </div>
          </div>
        \`;
      }
      return \`
        <div style="max-width: 800px; margin: 0 auto; padding: 36px 20px; text-align: center; color: #f8fafc;">
          <div style="font-size: 40px; margin-bottom: 6px;">🌐</div>
          <h1 style="font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #10b981, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;">
            CUBiO Sovereign Browser
          </h1>
          <p style="color: #94a3b8; font-size: 13px; max-width: 520px; margin: 0 auto 28px auto; line-height: 1.6;">
            Powered by the <strong>FreeTree Engine</strong> (Zero-bloat V8 equivalent). 100% offline, zero trackers, fine-grained reactive tree execution.
          </p>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; text-align: left;">
            <div onclick="cubioNavigate('cubio://docs')" style="background: rgba(18, 25, 41, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
              <div style="font-size: 24px; margin-bottom: 8px;">📚</div>
              <h3 style="font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">FreeTree Docs</h3>
              <p style="font-size: 11px; color: #94a3b8; line-height: 1.4;">Architecture of the AST parser and VM evaluator.</p>
            </div>
            <div onclick="cubioNavigate('file:///user/documents/welcome.txt')" style="background: rgba(18, 25, 41, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
              <div style="font-size: 24px; margin-bottom: 8px;">📂</div>
              <h3 style="font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">VFS Files</h3>
              <p style="font-size: 11px; color: #94a3b8; line-height: 1.4;">Browse sovereign documents in Address369 VFS.</p>
            </div>
            <div onclick="launchApp('oview.spacemanager')" style="background: rgba(18, 25, 41, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; cursor: pointer;">
              <div style="font-size: 24px; margin-bottom: 8px;">🪐</div>
              <h3 style="font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">Space Manager</h3>
              <p style="font-size: 11px; color: #94a3b8; line-height: 1.4;">Inspect Address369 slots and memory spaces.</p>
            </div>
          </div>
        </div>
      \`;
    }

    function cubioNavigate(url) {
      cubioCurrentUrl = url;
      const bar = document.getElementById('cubio-url-bar');
      if (bar) bar.value = url;
      const vp = document.getElementById('cubio-viewport-content');
      if (vp) vp.innerHTML = renderCubioPageContent(url);
    }

    function cubioToggleDevTools() {
      alert('[FreeTree DevTools]\\n• VM Status: Operational\\n• Substrate: Qplayer Register VM (204.8M ops/s)\\n• Memory Slot: #40\\n• AST Nodes: 18 branches parsed');
    }

    // ──────────────── 8. SPACE MANAGER APP ────────────────
    let smActiveTab = 'slots';
    function renderSpaceManagerApp(winId) {
      let slotsHtml = '';
      for (let i = 0; i < 369; i++) {
        let color = 'rgba(255,255,255,0.05)';
        let border = 'rgba(255,255,255,0.08)';
        if (i < 10) { color = 'rgba(6, 182, 212, 0.4)'; border = '#06b6d4'; }
        else if (i >= 360) { color = 'rgba(245, 158, 11, 0.4)'; border = '#f59e0b'; }
        else if (i % 17 === 0) { color = 'rgba(16, 185, 129, 0.5)'; border = '#10b981'; }
        slotsHtml += \`<div title="Slot #\${i}" style="width: 13px; height: 13px; border-radius: 2px; background: \${color}; border: 1px solid \${border};"></div>\`;
      }

      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #0b1120; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Tabs -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; gap: 6px;">
              <button style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">🧠 Address369 Slots</button>
              <button onclick="alert('Workspace switched to Space 2: Dev & Web')" style="background: rgba(255,255,255,0.05); color: #94a3b8; font-weight: 600; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">🪐 Virtual Spaces</button>
              <button onclick="alert('Active PIDs: 7 | All slots operating within deterministic boundaries.')" style="background: rgba(255,255,255,0.05); color: #94a3b8; font-weight: 600; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">⚙️ Tasks</button>
            </div>
            <div style="font-size: 11px; color: #64748b; font-family: monospace;">Bounds: [0..368]</div>
          </div>

          <!-- Body -->
          <div style="flex: 1; overflow-y: auto; padding: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 13px; font-weight: 700; color: #f8fafc;">Spatial Memory Grid (369 Slots)</span>
              <div style="display: flex; gap: 8px; font-size: 10px; color: #94a3b8;">
                <span>● Cyan: Kernel (0-9)</span>
                <span>● Green: User Apps (10-359)</span>
                <span>● Amber: Ring (360-368)</span>
              </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 3px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px; margin-bottom: 14px;">
              \${slotsHtml}
            </div>
            <div style="background: rgba(18, 25, 41, 0.85); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="color: #10b981; font-weight: 700; font-size: 13px;">Address369 Sovereign Allocator</div>
                <div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Active Space: Space 1 (Core) | Telemetry: 0.019ms IPC latency</div>
              </div>
              <button onclick="alert('Memory defragmented. All Address369 slots verified.')" style="background: #10b981; border: none; color: #022c22; font-weight: 700; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">Verify Slots</button>
            </div>
          </div>
        </div>
      \`;
    }

    // ──────────────── 9. ART CANVAS STUDIO ────────────────
    function renderArtCanvasApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #0c1222; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Studio Toolbar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; gap: 4px; align-items: center;">
              <button onclick="artSetTool('brush')" style="background: #10b981; color: #022c22; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer;">🖌️</button>
              <button onclick="artSetTool('pencil')" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.08); width: 28px; height: 28px; border-radius: 6px; cursor: pointer;">✏️</button>
              <button onclick="artSetTool('eraser')" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.08); width: 28px; height: 28px; border-radius: 6px; cursor: pointer;">🧹</button>
              <input type="color" id="art-color-\${winId}" value="#10b981" style="width: 26px; height: 26px; border: none; background: transparent; cursor: pointer;" />
            </div>
            <div style="display: flex; gap: 6px;">
              <button onclick="artClear('\${winId}')" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">🗑️ Clear</button>
              <button onclick="artSave('\${winId}')" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 4px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">💾 Save VFS</button>
            </div>
          </div>

          <!-- Canvas Viewport -->
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: #070a12; padding: 12px; overflow: hidden;">
            <canvas id="art-canvas-\${winId}" width="780" height="460" onmousedown="artStartDraw(event, '\${winId}')" onmousemove="artDraw(event, '\${winId}')" onmouseup="artEndDraw()" onmouseleave="artEndDraw()" style="background: #111827; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); cursor: crosshair;"></canvas>
          </div>
        </div>
      \`;
    }

    let isArtDrawing = false;
    let artTool = 'brush';
    function artSetTool(tool) {
      artTool = tool;
    }
    function artStartDraw(e, winId) {
      isArtDrawing = true;
      const cvs = document.getElementById('art-canvas-' + winId);
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      const rect = cvs.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    function artDraw(e, winId) {
      if (!isArtDrawing) return;
      const cvs = document.getElementById('art-canvas-' + winId);
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      const rect = cvs.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const colorPicker = document.getElementById('art-color-' + winId);
      ctx.strokeStyle = artTool === 'eraser' ? '#111827' : (colorPicker ? colorPicker.value : '#10b981');
      ctx.lineWidth = artTool === 'brush' ? 6 : (artTool === 'eraser' ? 16 : 2);
      ctx.lineCap = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    function artEndDraw() {
      isArtDrawing = false;
    }
    function artClear(winId) {
      const cvs = document.getElementById('art-canvas-' + winId);
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, cvs.width, cvs.height);
    }
    function artSave(winId) {
      CLIENT_VFS['/user/media/artwork.png'] = { type: 'file', content: 'data:image/png;base64,sovereign_art_canvas_render' };
      alert('[Art Canvas] Saved artwork to VFS: /user/media/artwork.png');
    }

    // ──────────────── 10. REBEL X PLAY (RXP) ────────────────
    let rxpIsPlaying = false;
    function renderRxpApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #080b14; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; gap: 8px;">
              <button onclick="rxpSetTab('audio', '\${winId}')" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 4px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">🎵 Spatial Audio</button>
              <button onclick="rxpSetTab('arcade', '\${winId}')" style="background: rgba(255,255,255,0.05); color: #cbd5e1; font-weight: 600; border: 1px solid rgba(255,255,255,0.08); padding: 4px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">🕹️ 60FPS Arcade</button>
            </div>
            <span style="font-size: 11px; color: #a855f7; font-weight: 700;">REBEL X PLAY</span>
          </div>

          <!-- Main Player Surface -->
          <div id="rxp-audio-view-\${winId}" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px;">
            <!-- Equalizer Bars -->
            <div id="rxp-equalizer" style="display: flex; align-items: flex-end; gap: 6px; height: 100px; margin-bottom: 24px;">
              \${Array.from({length: 16}).map((_, i) => \`<div style="width: 8px; height: \${15 + (i * 4) % 60}px; background: linear-gradient(to top, #10b981, #3b82f6); border-radius: 4px;"></div>\`).join('')}
            </div>

            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-bottom: 4px;">Cyber Pulse 369</h2>
              <p style="font-size: 12px; color: #10b981;">Sovereign Synthesizer Core • 369 Hz Pure Tone</p>
            </div>

            <!-- Controls -->
            <div style="display: flex; align-items: center; gap: 14px; background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 20px;">
              <button onclick="alert('Previous Track')" style="background: transparent; border: none; font-size: 16px; cursor: pointer; color: #cbd5e1;">⏮️</button>
              <button onclick="rxpTogglePlay()" id="rxp-play-btn" style="background: #10b981; border: none; color: #022c22; width: 38px; height: 38px; border-radius: 50%; font-size: 16px; font-weight: 800; cursor: pointer;">▶</button>
              <button onclick="alert('Next Track: Sovereign Odyssey')" style="background: transparent; border: none; font-size: 16px; cursor: pointer; color: #cbd5e1;">⏭️</button>
            </div>
          </div>

          <!-- Arcade Surface -->
          <div id="rxp-arcade-view-\${winId}" style="flex: 1; display: none; flex-direction: column; align-items: center; justify-content: center; padding: 16px;">
            <canvas id="rxp-canvas-\${winId}" width="600" height="340" style="background: #090e1a; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 8px;"></canvas>
            <div style="font-size: 11px; color: #64748b; margin-top: 8px;">60 FPS Sovereign Physics • Use Mouse to Move Paddle</div>
          </div>
        </div>
      \`;
    }

    function rxpSetTab(tab, winId) {
      const audioV = document.getElementById('rxp-audio-view-' + winId);
      const arcadeV = document.getElementById('rxp-arcade-view-' + winId);
      if (tab === 'audio') {
        if (audioV) audioV.style.display = 'flex';
        if (arcadeV) arcadeV.style.display = 'none';
      } else {
        if (audioV) audioV.style.display = 'none';
        if (arcadeV) arcadeV.style.display = 'flex';
        initRxpArcade(winId);
      }
    }

    function rxpTogglePlay() {
      rxpIsPlaying = !rxpIsPlaying;
      const btn = document.getElementById('rxp-play-btn');
      if (btn) btn.innerHTML = rxpIsPlaying ? '⏸' : '▶';
    }

    function initRxpArcade(winId) {
      const cvs = document.getElementById('rxp-canvas-' + winId);
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      let bx = 300, by = 150, bvx = 3, bvy = -3, px = 250;
      cvs.onmousemove = (e) => {
        const r = cvs.getBoundingClientRect();
        px = Math.max(0, Math.min(e.clientX - r.left - 45, cvs.width - 90));
      };
      function loop() {
        if (cvs.offsetParent === null) return;
        bx += bvx; by += bvy;
        if (bx <= 5 || bx >= cvs.width - 5) bvx = -bvx;
        if (by <= 5) bvy = -bvy;
        if (by >= cvs.height - 25 && bx >= px && bx <= px + 90) bvy = -Math.abs(bvy);
        if (by > cvs.height) { bx = 300; by = 150; }
        ctx.fillStyle = '#090e1a';
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(px, cvs.height - 20, 90, 10);
        requestAnimationFrame(loop);
      }
      loop();
    }

    // ──────────────── 11. OGALLERY (PHOTO VIEWER) ────────────────
    const OGALLERY_IMAGES = [
      { name: 'artwork.png', label: 'Sovereign Art Canvas', color: '#10b981' },
      { name: 'cyber_landscape.png', label: 'Neon Cyberpunk Horizon', color: '#38bdf8' },
      { name: 'sovereign_symbol.svg', label: 'Address369 Vector Seal', color: '#a855f7' }
    ];
    let ogalleryCurrentIdx = 0;
    let ogalleryZoom = 100;
    let ogalleryRot = 0;
    let ogallerySlideshowTimer = null;

    function renderOgalleryApp(winId) {
      const cur = OGALLERY_IMAGES[ogalleryCurrentIdx];
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #070913; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Toolbar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255,255,255,0.08);">
            <div style="display: flex; gap: 6px; align-items: center;">
              <button onclick="ogalleryZoomDelta(-25, '\${winId}')" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); width: 28px; height: 28px; border-radius: 6px; cursor: pointer;">🔍-</button>
              <span id="ogallery-zoom-txt-\${winId}" style="font-size: 11px; font-weight: 700; color: #10b981; width: 42px; text-align: center;">\${ogalleryZoom}%</span>
              <button onclick="ogalleryZoomDelta(25, '\${winId}')" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); width: 28px; height: 28px; border-radius: 6px; cursor: pointer;">🔍+</button>
              <div style="height: 18px; width: 1px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
              <button onclick="ogalleryRotate(90, '\${winId}')" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;">⟳ Rotate</button>
              <button onclick="ogalleryToggleSlideshow('\${winId}')" id="ogallery-ss-btn-\${winId}" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">▶ Slideshow</button>
            </div>
            <span style="font-size: 11px; color: #94a3b8;">/user/media/\${cur.name}</span>
          </div>

          <!-- Main Image Viewport -->
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 20px; position: relative;">
            <div id="ogallery-canvas-wrap-\${winId}" style="width: 420px; height: 260px; background: radial-gradient(circle, \${cur.color}33 0%, #0c1222 70%); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: all 0.25s ease; transform: scale(\${ogalleryZoom / 100}) rotate(\${ogalleryRot}deg); box-shadow: 0 12px 36px rgba(0,0,0,0.7);">
              <div style="font-size: 48px; margin-bottom: 8px;">🖼️</div>
              <div style="font-size: 15px; font-weight: 700; color: #f8fafc;">\${cur.label}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">1920 × 1080 • VFS Hardware 2D Stream</div>
            </div>
          </div>

          <!-- Thumbnail Strip -->
          <div style="height: 68px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 10px; padding: 0 14px;">
            \${OGALLERY_IMAGES.map((img, i) => \`
              <div onclick="ogallerySelectImage(\${i}, '\${winId}')" style="width: 50px; height: 44px; border-radius: 8px; background: \${img.color}22; border: 2px solid \${i === ogalleryCurrentIdx ? '#10b981' : 'rgba(255,255,255,0.1)'}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s;">
                <span style="font-size: 20px;">🖼️</span>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;
    }

    function ogallerySelectImage(idx, winId) {
      ogalleryCurrentIdx = idx;
      ogalleryZoom = 100;
      ogalleryRot = 0;
      const wrap = document.getElementById('ogallery-canvas-wrap-' + winId);
      if (wrap) {
        const cur = OGALLERY_IMAGES[idx];
        wrap.style.background = \`radial-gradient(circle, \${cur.color}33 0%, #0c1222 70%)\`;
        wrap.style.transform = 'scale(1) rotate(0deg)';
        wrap.children[1].innerText = cur.label;
      }
      const zoomTxt = document.getElementById('ogallery-zoom-txt-' + winId);
      if (zoomTxt) zoomTxt.innerText = '100%';
    }

    function ogalleryZoomDelta(delta, winId) {
      ogalleryZoom = Math.max(50, Math.min(300, ogalleryZoom + delta));
      const wrap = document.getElementById('ogallery-canvas-wrap-' + winId);
      if (wrap) wrap.style.transform = \`scale(\${ogalleryZoom / 100}) rotate(\${ogalleryRot}deg)\`;
      const zoomTxt = document.getElementById('ogallery-zoom-txt-' + winId);
      if (zoomTxt) zoomTxt.innerText = ogalleryZoom + '%';
    }

    function ogalleryRotate(delta, winId) {
      ogalleryRot = (ogalleryRot + delta) % 360;
      const wrap = document.getElementById('ogallery-canvas-wrap-' + winId);
      if (wrap) wrap.style.transform = \`scale(\${ogalleryZoom / 100}) rotate(\${ogalleryRot}deg)\`;
    }

    function ogalleryToggleSlideshow(winId) {
      const btn = document.getElementById('ogallery-ss-btn-' + winId);
      if (ogallerySlideshowTimer) {
        clearInterval(ogallerySlideshowTimer);
        ogallerySlideshowTimer = null;
        if (btn) btn.innerHTML = '▶ Slideshow';
      } else {
        if (btn) btn.innerHTML = '⏸ Pause';
        ogallerySlideshowTimer = setInterval(() => {
          ogalleryCurrentIdx = (ogalleryCurrentIdx + 1) % OGALLERY_IMAGES.length;
          ogallerySelectImage(ogalleryCurrentIdx, winId);
        }, 2500);
      }
    }

    // ──────────────── 12. CLOCK & TIMER APP ────────────────
    let clockTab = 'world';
    let clockSwMs = 0;
    let clockSwRunning = false;
    let clockSwTimer = null;
    let clockLaps = [];

    function renderClockApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #080c16; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Tabs -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; gap: 8px;">
              <button onclick="clockSwitchTab('world', '\${winId}')" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">🌍 World Clock</button>
              <button onclick="clockSwitchTab('stopwatch', '\${winId}')" style="background: rgba(255,255,255,0.05); color: #cbd5e1; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">⏱️ Stopwatch</button>
              <button onclick="clockSwitchTab('timer', '\${winId}')" style="background: rgba(255,255,255,0.05); color: #cbd5e1; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">⏳ Timer</button>
            </div>
            <span style="font-size: 11px; color: #38bdf8; font-family: monospace;">Address369 Precision</span>
          </div>

          <!-- Body Surface -->
          <div id="clock-content-\${winId}" style="flex: 1; overflow-y: auto; padding: 18px;">
            \${renderClockWorldView()}
          </div>
        </div>
      \`;
    }

    function renderClockWorldView() {
      const now = new Date();
      const formatTime = (offset) => {
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const d = new Date(utc + 3600000 * offset);
        let h = d.getHours();
        const p = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return \`\${h}:\${String(d.getMinutes()).padStart(2, '0')}:\${String(d.getSeconds()).padStart(2, '0')} \${p}\`;
      };

      return \`
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
          <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 18px;">
            <div style="font-size: 11px; color: #10b981; font-weight: 700; text-transform: uppercase;">Karachi, Pakistan (PKT)</div>
            <div style="font-size: 26px; font-weight: 800; color: #f8fafc; margin: 8px 0;">\${formatTime(5)}</div>
            <div style="font-size: 11px; color: #94a3b8;">UTC +5:00 • Primary Gateway</div>
          </div>
          <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
            <div style="font-size: 11px; color: #38bdf8; font-weight: 700; text-transform: uppercase;">Tokyo, Japan (JST)</div>
            <div style="font-size: 26px; font-weight: 800; color: #f8fafc; margin: 8px 0;">\${formatTime(9)}</div>
            <div style="font-size: 11px; color: #94a3b8;">UTC +9:00 • East Hub</div>
          </div>
          <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
            <div style="font-size: 11px; color: #a855f7; font-weight: 700; text-transform: uppercase;">London, UK (GMT)</div>
            <div style="font-size: 26px; font-weight: 800; color: #f8fafc; margin: 8px 0;">\${formatTime(0)}</div>
            <div style="font-size: 11px; color: #94a3b8;">UTC +0:00 • Prime Meridian</div>
          </div>
          <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
            <div style="font-size: 11px; color: #f59e0b; font-weight: 700; text-transform: uppercase;">New York, USA (EST)</div>
            <div style="font-size: 26px; font-weight: 800; color: #f8fafc; margin: 8px 0;">\${formatTime(-5)}</div>
            <div style="font-size: 11px; color: #94a3b8;">UTC -5:00 • Western Node</div>
          </div>
        </div>
      \`;
    }

    function clockSwitchTab(tab, winId) {
      clockTab = tab;
      const content = document.getElementById('clock-content-' + winId);
      if (!content) return;

      if (tab === 'world') {
        content.innerHTML = renderClockWorldView();
      } else if (tab === 'stopwatch') {
        content.innerHTML = \`
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px;">
            <div id="clock-sw-display-\${winId}" style="font-size: 46px; font-family: monospace; font-weight: 800; color: #10b981; margin-bottom: 24px; text-shadow: 0 0 20px rgba(16,185,129,0.4);">
              00:00.00
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 20px;">
              <button onclick="clockToggleSw('\${winId}')" id="clock-sw-btn-\${winId}" style="background: #10b981; color: #022c22; font-weight: 800; border: none; padding: 8px 22px; border-radius: 8px; font-size: 13px; cursor: pointer;">Start</button>
              <button onclick="clockLapSw('\${winId}')" style="background: rgba(255,255,255,0.08); color: #f8fafc; border: 1px solid rgba(255,255,255,0.15); padding: 8px 18px; border-radius: 8px; font-size: 13px; cursor: pointer;">Lap</button>
              <button onclick="clockResetSw('\${winId}')" style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); padding: 8px 18px; border-radius: 8px; font-size: 13px; cursor: pointer;">Reset</button>
            </div>
            <div id="clock-laps-box-\${winId}" style="width: 100%; max-width: 380px; max-height: 140px; overflow-y: auto; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px;">
              <div style="font-size: 11px; color: #64748b; text-align: center;">No recorded split laps.</div>
            </div>
          </div>
        \`;
      } else if (tab === 'timer') {
        content.innerHTML = \`
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px;">
            <div style="font-size: 44px; font-family: monospace; font-weight: 800; color: #38bdf8; margin-bottom: 20px;">05:00</div>
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
              <button onclick="alert('Timer started: 5 minutes')" style="background: #38bdf8; color: #022c22; font-weight: 800; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; cursor: pointer;">Start 5m</button>
              <button onclick="alert('Timer started: 15 minutes')" style="background: rgba(255,255,255,0.08); color: #f8fafc; border: 1px solid rgba(255,255,255,0.15); padding: 8px 20px; border-radius: 8px; font-size: 13px; cursor: pointer;">Start 15m</button>
              <button onclick="alert('Timer reset')" style="background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer;">Reset</button>
            </div>
            <div style="font-size: 12px; color: #94a3b8;">Countdown alerts via Sovereign SystemBus Notification</div>
          </div>
        \`;
      }
    }

    function clockToggleSw(winId) {
      clockSwRunning = !clockSwRunning;
      const btn = document.getElementById('clock-sw-btn-' + winId);
      const disp = document.getElementById('clock-sw-display-' + winId);
      if (clockSwRunning) {
        if (btn) { btn.innerHTML = 'Pause'; btn.style.background = '#f59e0b'; }
        clockSwTimer = setInterval(() => {
          clockSwMs += 50;
          const s = Math.floor(clockSwMs / 1000);
          const m = Math.floor(s / 60);
          const ms = Math.floor((clockSwMs % 1000) / 10);
          if (disp) disp.innerText = \`\${String(m).padStart(2, '0')}:\${String(s % 60).padStart(2, '0')}.\${String(ms).padStart(2, '0')}\`;
        }, 50);
      } else {
        if (btn) { btn.innerHTML = 'Start'; btn.style.background = '#10b981'; }
        if (clockSwTimer) clearInterval(clockSwTimer);
      }
    }

    function clockLapSw(winId) {
      if (!clockSwRunning) return;
      const s = Math.floor(clockSwMs / 1000);
      const m = Math.floor(s / 60);
      const ms = Math.floor((clockSwMs % 1000) / 10);
      const formatted = \`\${String(m).padStart(2, '0')}:\${String(s % 60).padStart(2, '0')}.\${String(ms).padStart(2, '0')}\`;
      clockLaps.push(formatted);
      const box = document.getElementById('clock-laps-box-' + winId);
      if (box) {
        box.innerHTML = clockLaps.map((lap, i) => \`
          <div style="display: flex; justify-content: space-between; padding: 4px 6px; font-size: 11px; font-family: monospace; border-bottom: 1px solid rgba(255,255,255,0.05); color: #cbd5e1;">
            <span>Lap #\${i + 1}</span>
            <span style="color: #10b981;">\${lap}</span>
          </div>
        \`).join('');
      }
    }

    function clockResetSw(winId) {
      clockSwRunning = false;
      if (clockSwTimer) clearInterval(clockSwTimer);
      clockSwMs = 0;
      clockLaps = [];
      const disp = document.getElementById('clock-sw-display-' + winId);
      if (disp) disp.innerText = '00:00.00';
      const btn = document.getElementById('clock-sw-btn-' + winId);
      if (btn) { btn.innerHTML = 'Start'; btn.style.background = '#10b981'; }
      const box = document.getElementById('clock-laps-box-' + winId);
      if (box) box.innerHTML = '<div style="font-size: 11px; color: #64748b; text-align: center;">No recorded split laps.</div>';
    }

    // ──────────────── 13. WEATHER APP ────────────────
    const WEATHER_CITIES = {
      Karachi: { temp: 28, cond: 'Sunny & Clear', icon: '☀️', hum: 58, wind: 14, uv: 7 },
      Tokyo: { temp: 19, cond: 'Cyber Haze', icon: '🌫️', hum: 65, wind: 10, uv: 4 },
      London: { temp: 14, cond: 'Light Rain', icon: '🌧️', hum: 82, wind: 18, uv: 2 },
      'New York': { temp: 21, cond: 'Partly Cloudy', icon: '⛅', hum: 50, wind: 12, uv: 5 }
    };
    let weatherActiveCity = 'Karachi';

    function renderWeatherApp(winId) {
      const data = WEATHER_CITIES[weatherActiveCity];
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #070a14; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- City Switcher Bar -->
          <div style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            \${Object.keys(WEATHER_CITIES).map(c => \`
              <button onclick="weatherSetCity('\${c}', '\${winId}')" style="background: \${c === weatherActiveCity ? '#10b981' : 'rgba(255,255,255,0.05)'}; color: \${c === weatherActiveCity ? '#022c22' : '#cbd5e1'}; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">\${c}</button>
            \`).join('')}
          </div>

          <!-- Main Surface -->
          <div id="weather-surface-\${winId}" style="flex: 1; overflow-y: auto; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div>
                <h2 style="font-size: 28px; font-weight: 800; color: #f8fafc; margin-bottom: 4px;">\${weatherActiveCity}</h2>
                <div style="font-size: 14px; color: #94a3b8;">\${data.icon} \${data.cond}</div>
              </div>
              <div style="font-size: 42px; font-weight: 800; color: #10b981;">\${data.temp}°C</div>
            </div>

            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
              <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Humidity</div>
                <div style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 4px;">\${data.hum}%</div>
              </div>
              <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Wind Speed</div>
                <div style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 4px;">\${data.wind} km/h</div>
              </div>
              <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">UV Index</div>
                <div style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 4px;">\${data.uv} / 10</div>
              </div>
            </div>

            <!-- 5-Day Forecast -->
            <div style="font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 10px;">5-DAY ATMOSPHERIC FORECAST</div>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
              \${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, idx) => \`
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; text-align: center;">
                  <div style="font-size: 11px; color: #94a3b8;">\${day}</div>
                  <div style="font-size: 20px; margin: 6px 0;">\${idx % 2 === 0 ? '☀️' : '🌤️'}</div>
                  <div style="font-size: 12px; font-weight: 700; color: #f8fafc;">\${data.temp - idx}°</div>
                </div>
              \`).join('')}
            </div>
          </div>
        </div>
      \`;
    }

    function weatherSetCity(city, winId) {
      weatherActiveCity = city;
      const sf = document.getElementById('weather-surface-' + winId);
      if (sf) {
        const data = WEATHER_CITIES[city];
        sf.innerHTML = \`
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h2 style="font-size: 28px; font-weight: 800; color: #f8fafc; margin-bottom: 4px;">\${city}</h2>
              <div style="font-size: 14px; color: #94a3b8;">\${data.icon} \${data.cond}</div>
            </div>
            <div style="font-size: 42px; font-weight: 800; color: #10b981;">\${data.temp}°C</div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
            <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Humidity</div>
              <div style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 4px;">\${data.hum}%</div>
            </div>
            <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Wind Speed</div>
              <div style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 4px;">\${data.wind} km/h</div>
            </div>
            <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px;">
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">UV Index</div>
              <div style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 4px;">\${data.uv} / 10</div>
            </div>
          </div>
        \`;
      }
    }

    // ──────────────── 14. VOICE RECORDER APP ────────────────
    let recIsActive = false;
    let recSecs = 0;
    let recTimer = null;

    function renderRecorderApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #070914; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="rec-dot-\${winId}" style="width: 10px; height: 10px; border-radius: 50%; background: #64748b;"></span>
              <span id="rec-status-txt-\${winId}" style="font-size: 12px; font-weight: 700; color: #94a3b8;">STANDBY</span>
            </div>
            <span style="font-size: 11px; color: #64748b;">WebAudio PCM 16-Bit 44.1kHz</span>
          </div>

          <!-- Main Viewport -->
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
            <!-- Oscilloscope Bars -->
            <div id="rec-bars-\${winId}" style="display: flex; align-items: center; gap: 4px; height: 70px; margin-bottom: 24px;">
              \${Array.from({length: 24}).map(() => \`<div style="width: 4px; height: 8px; background: #334155; border-radius: 2px;"></div>\`).join('')}
            </div>

            <!-- Timer Display -->
            <div id="rec-timer-txt-\${winId}" style="font-size: 42px; font-family: monospace; font-weight: 800; color: #f8fafc; margin-bottom: 24px;">
              00:00
            </div>

            <!-- Controls -->
            <div style="display: flex; align-items: center; gap: 14px;">
              <button onclick="recToggle('\${winId}')" id="rec-btn-\${winId}" style="width: 54px; height: 54px; border-radius: 50%; background: #ef4444; border: none; font-size: 20px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(239,68,68,0.5);">●</button>
              <button onclick="recSaveToVfs('\${winId}')" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 8px 18px; border-radius: 8px; font-size: 12px; cursor: pointer;">💾 Save VFS</button>
            </div>
          </div>
        </div>
      \`;
    }

    function recToggle(winId) {
      recIsActive = !recIsActive;
      const btn = document.getElementById('rec-btn-' + winId);
      const dot = document.getElementById('rec-dot-' + winId);
      const statusTxt = document.getElementById('rec-status-txt-' + winId);
      const timerTxt = document.getElementById('rec-timer-txt-' + winId);
      const bars = document.getElementById('rec-bars-' + winId);

      if (recIsActive) {
        if (btn) btn.innerHTML = '⏹';
        if (dot) { dot.style.background = '#ef4444'; dot.style.boxShadow = '0 0 10px #ef4444'; }
        if (statusTxt) { statusTxt.innerText = 'RECORDING LIVE'; statusTxt.style.color = '#ef4444'; }
        recTimer = setInterval(() => {
          recSecs++;
          const m = Math.floor(recSecs / 60);
          const s = recSecs % 60;
          if (timerTxt) timerTxt.innerText = \`\${String(m).padStart(2, '0')}:\${String(s).padStart(2, '0')}\`;
          if (bars) {
            Array.from(bars.children).forEach(bar => {
              const h = Math.floor(Math.random() * 50) + 8;
              bar.style.height = h + 'px';
              bar.style.background = '#10b981';
            });
          }
        }, 1000);
      } else {
        if (btn) btn.innerHTML = '●';
        if (dot) { dot.style.background = '#64748b'; dot.style.boxShadow = 'none'; }
        if (statusTxt) { statusTxt.innerText = 'PAUSED'; statusTxt.style.color = '#94a3b8'; }
        if (recTimer) clearInterval(recTimer);
        if (bars) {
          Array.from(bars.children).forEach(bar => {
            bar.style.height = '8px';
            bar.style.background = '#334155';
          });
        }
      }
    }

    function recSaveToVfs(winId) {
      const fileName = \`recording_\${Date.now()}.wav\`;
      CLIENT_VFS[\`/user/media/\${fileName}\`] = { type: 'file', content: \`SOVEREIGN_AUDIO_STREAM_DURATION_\${recSecs}S\` };
      alert('[Voice Recorder] Saved to VFS: /user/media/' + fileName);
      recSecs = 0;
      recIsActive = false;
      if (recTimer) clearInterval(recTimer);
      const timerTxt = document.getElementById('rec-timer-txt-' + winId);
      if (timerTxt) timerTxt.innerText = '00:00';
      const btn = document.getElementById('rec-btn-' + winId);
      if (btn) btn.innerHTML = '●';
    }

    // ──────────────── 15. OARCHIVE APP ────────────────
    function renderOarchiveApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #070914; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; gap: 8px;">
              <button onclick="alert('Packer Mode: Selected 4 files from /user/documents/')" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">📦 Pack .oarc</button>
              <button onclick="alert('Unpacked backup.oarc to /user/documents/extracted/')" style="background: rgba(255,255,255,0.05); color: #cbd5e1; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">📂 Extract</button>
            </div>
            <span style="font-size: 11px; color: #a855f7; font-weight: 700;">Format: .oarc (Sovereign Zip)</span>
          </div>

          <!-- Body -->
          <div style="flex: 1; overflow-y: auto; padding: 18px;">
            <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; margin-bottom: 16px;">
              <div style="font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">Archive Payload: backup.oarc</div>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 14px;">Total Files: 3 • Compression Ratio: 64% • Integrity: Verified</div>
              <div style="font-size: 11px; font-family: monospace; color: #cbd5e1; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px; line-height: 1.8;">
                • /user/documents/welcome.txt (148 bytes)<br/>
                • /user/documents/notes.one (210 bytes)<br/>
                • /user/media/artwork.png (1024 bytes)
              </div>
            </div>

            <div style="display: flex; gap: 10px;">
              <button onclick="alert('Created sovereign archive: /user/documents/backup.oarc')" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 8px 18px; border-radius: 8px; font-size: 12px; cursor: pointer;">Generate .oarc Bundle</button>
              <button onclick="alert('Integrity check: SHA-256 Checksum VALID')" style="background: rgba(255,255,255,0.06); color: #f8fafc; border: 1px solid rgba(255,255,255,0.15); padding: 8px 18px; border-radius: 8px; font-size: 12px; cursor: pointer;">Verify Checksum</button>
            </div>
          </div>
        </div>
      \`;
    }

    // ──────────────── 16. RECYCLE BIN APP (TRASH) ────────────────
    function renderTrashApp(winId) {
      const trashPrefix = '/user/trash/';
      const trashed = [];
      for (const [vPath, node] of Object.entries(CLIENT_VFS)) {
        if (vPath.startsWith(trashPrefix) && vPath !== '/user/trash') {
          const name = vPath.slice(trashPrefix.length);
          if (!name.includes('/')) {
            trashed.push({
              name,
              path: vPath,
              type: node.type,
              size: node.content ? node.content.length : 0
            });
          }
        }
      }

      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #070914; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Action Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; gap: 8px;">
              <button onclick="restoreAllTrash()" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">♻️ Restore All</button>
              <button onclick="emptyAllTrash()" style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-weight: 600; border: 1px solid rgba(239, 68, 68, 0.4); padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">🗑️ Empty Recycle Bin</button>
            </div>
            <span style="font-size: 11px; color: \${trashed.length > 0 ? '#f59e0b' : '#10b981'}; font-weight: 700;">
              \${trashed.length} Items in /user/trash
            </span>
          </div>

          <!-- Body -->
          <div style="flex: 1; overflow-y: auto; padding: 16px;">
            \${trashed.length === 0 ? \`
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #64748b;">
                <div style="font-size: 48px; margin-bottom: 8px; opacity: 0.6;">🗑️</div>
                <div style="font-size: 14px; font-weight: 600; color: #94a3b8;">Recycle Bin is Empty</div>
                <div style="font-size: 11px; margin-top: 4px;">Deleted files will appear here for safe recovery.</div>
              </div>
            \` : \`
              <div style="display: flex; flex-direction: column; gap: 8px;">
                \${trashed.map(item => \`
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 20px;">\${item.type === 'dir' ? '📁' : '📄'}</span>
                      <div>
                        <div style="font-size: 13px; font-weight: 600; color: #f8fafc;">\${item.name}</div>
                        <div style="font-size: 11px; color: #94a3b8;">Original: /user/documents/\${item.name} • \${item.size} bytes</div>
                      </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <button onclick="restoreTrashItem('\${item.path}')" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">Restore</button>
                      <button onclick="deleteTrashItemPermanently('\${item.path}')" style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: #f43f5e; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">Delete</button>
                    </div>
                  </div>
                \`).join('')}
              </div>
            \`}
          </div>

          <!-- Footer -->
          <div style="padding: 8px 14px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b;">
            <span>Address369 Slot [80] • Fail-Safe Recovery Layer</span>
            <span>Zero Data Loss Guarantee</span>
          </div>
        </div>
      \`;
    }

    function restoreTrashItem(trashPath) {
      const node = CLIENT_VFS[trashPath];
      if (!node) return;
      const fileName = trashPath.split('/').pop();
      const targetPath = '/user/documents/' + fileName;
      CLIENT_VFS[targetPath] = node;
      delete CLIENT_VFS[trashPath];
      showToast('Recycle Bin', 'Restored ' + fileName + ' to /user/documents/', 'success');
      renderWindows();
    }

    function deleteTrashItemPermanently(trashPath) {
      const fileName = trashPath.split('/').pop();
      delete CLIENT_VFS[trashPath];
      showToast('Recycle Bin', 'Permanently deleted ' + fileName, 'warning');
      renderWindows();
    }

    function restoreAllTrash() {
      let count = 0;
      for (const [vPath, node] of Object.entries(CLIENT_VFS)) {
        if (vPath.startsWith('/user/trash/') && vPath !== '/user/trash') {
          const fileName = vPath.slice('/user/trash/'.length);
          if (!fileName.includes('/')) {
            CLIENT_VFS['/user/documents/' + fileName] = node;
            delete CLIENT_VFS[vPath];
            count++;
          }
        }
      }
      showToast('Recycle Bin', 'Restored ' + count + ' files to /user/documents/', 'success');
      renderWindows();
    }

    function emptyAllTrash() {
      let count = 0;
      for (const vPath of Object.keys(CLIENT_VFS)) {
        if (vPath.startsWith('/user/trash/') && vPath !== '/user/trash') {
          delete CLIENT_VFS[vPath];
          count++;
        }
      }
      showToast('Recycle Bin', 'Recycle Bin emptied (' + count + ' items purged)', 'info');
      renderWindows();
    }

    // ──────────────── 17. OVIEW FLOW (VISUAL N8N AUTOMATION) ────────────────
    let flowNodes = [
      { id: 'f1', type: 'trigger', title: 'VFS File Watcher', icon: '📁', desc: 'Watch /user/documents/*.txt', x: 40, y: 80, status: 'idle', output: '' },
      { id: 'f2', type: 'agent', title: 'ECHO-1 AI Summarizer', icon: '🤖', desc: 'Extract key points with local LLM', x: 280, y: 80, status: 'idle', output: '' },
      { id: 'f3', type: 'action', title: 'Save & Notify', icon: '🔔', desc: 'Send Toast & write summary.txt', x: 520, y: 80, status: 'idle', output: '' }
    ];
    let isFlowRunning = false;

    function renderFlowApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #080c18; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Flow Action Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <button onclick="runFlowWorkflow('\${winId}')" \${isFlowRunning ? 'disabled' : ''} style="background: \${isFlowRunning ? '#059669' : '#10b981'}; color: #022c22; font-weight: 700; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <span>\${isFlowRunning ? '⏳' : '▶'}</span> <span>\${isFlowRunning ? 'Running...' : 'Run Workflow'}</span>
              </button>
              <button onclick="addFlowNode('\${winId}')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; font-weight: 600; padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">+ Add Node</button>
              <button onclick="resetFlowWorkflow('\${winId}')" style="background: transparent; border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; padding: 6px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;">Reset</button>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 11px; color: #a78bfa; font-weight: 600;">Template: Smart Note Summarizer</span>
              <span style="font-size: 10px; padding: 2px 8px; border-radius: 4px; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3);">ECHO-1 ACTIVE</span>
            </div>
          </div>

          <!-- Flow Node Canvas -->
          <div style="flex: 1; position: relative; overflow: auto; background: radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 20px 20px; padding: 30px;">
            <!-- SVG Wires -->
            <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;">
              <path d="M 230 130 C 255 130, 255 130, 280 130" stroke="\${isFlowRunning ? '#10b981' : '#334155'}" stroke-width="3" fill="none" stroke-dasharray="\${isFlowRunning ? '6,6' : 'none'}" />
              <path d="M 470 130 C 495 130, 495 130, 520 130" stroke="\${isFlowRunning ? '#10b981' : '#334155'}" stroke-width="3" fill="none" stroke-dasharray="\${isFlowRunning ? '6,6' : 'none'}" />
            </svg>

            <!-- Rendered Nodes -->
            <div style="position: relative; z-index: 2; display: flex; gap: 50px;">
              \${flowNodes.map(node => \`
                <div style="width: 190px; background: rgba(18, 25, 41, 0.95); border: 2px solid \${node.status === 'running' ? '#f59e0b' : node.status === 'success' ? '#10b981' : 'rgba(255,255,255,0.1)'}; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); overflow: hidden; transition: all 0.2s;">
                  <div style="padding: 10px 12px; background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 16px;">\${node.icon}</span>
                      <span style="font-size: 12px; font-weight: 700; color: #f8fafc;">\${node.title}</span>
                    </div>
                    <span style="font-size: 9px; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; font-weight: 700; background: \${node.status === 'success' ? 'rgba(16,185,129,0.2)' : node.status === 'running' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}; color: \${node.status === 'success' ? '#10b981' : node.status === 'running' ? '#f59e0b' : '#94a3b8'};">
                      \${node.status}
                    </span>
                  </div>
                  <div style="padding: 12px; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                    \${node.desc}
                    \${node.output ? \`<div style="margin-top: 8px; padding: 6px 8px; border-radius: 6px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #6ee7b7; font-size: 10px; font-family: monospace;">\${node.output}</div>\` : ''}
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>

          <!-- Bottom Footer -->
          <div style="padding: 8px 14px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b;">
            <span>Address369 Slot [85] • Offline n8n Visual Automation Substrate</span>
            <span>Zero Cloud Dependency • Sovereign Local Execution</span>
          </div>
        </div>
      \`;
    }

    function runFlowWorkflow(winId) {
      if (isFlowRunning) return;
      isFlowRunning = true;
      flowNodes.forEach(n => { n.status = 'idle'; n.output = ''; });
      renderWindows();

      flowNodes[0].status = 'running';
      renderWindows();

      setTimeout(() => {
        flowNodes[0].status = 'success';
        flowNodes[0].output = '✓ /user/documents/notes.one (210B)';
        flowNodes[1].status = 'running';
        renderWindows();

        setTimeout(() => {
          flowNodes[1].status = 'success';
          flowNodes[1].output = '✓ ECHO-1: Status Operational | A369 Ok';
          flowNodes[2].status = 'running';
          renderWindows();

          setTimeout(() => {
            flowNodes[2].status = 'success';
            flowNodes[2].output = '✓ Dispatched Toast & Saved';
            isFlowRunning = false;
            CLIENT_VFS['/user/documents/summary.txt'] = {
              type: 'file',
              content: 'AUTOMATED SUMMARY BY ECHO-1:\\n• System Status: Operational\\n• Memory Slots: Address369 Verified\\n'
            };
            showToast('Oview Flow', 'Workflow Completed: Smart Note Summarizer Finished!', 'success');
            renderWindows();
          }, 600);
        }, 700);
      }, 500);
    }

    function addFlowNode(winId) {
      const idx = flowNodes.length + 1;
      flowNodes.push({
        id: 'f' + idx,
        type: 'logic',
        title: 'Transform Node #' + idx,
        icon: '⚙️',
        desc: 'Custom filter / JSON parser',
        x: 40 + (idx * 160),
        y: 80,
        status: 'idle',
        output: ''
      });
      showToast('Oview Flow', 'Added new node to workflow canvas', 'info');
      renderWindows();
    }

    function resetFlowWorkflow(winId) {
      isFlowRunning = false;
      flowNodes.forEach(n => { n.status = 'idle'; n.output = ''; });
      renderWindows();
    }

    // ──────────────── 18. SOVEREIGN TASK MANAGER ────────────────
    let taskMgrActiveTab = 'processes';

    function renderTaskManagerApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #070914; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Tab Navigation Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; gap: 8px;">
              <button onclick="setTaskMgrTab('processes')" style="background: \${taskMgrActiveTab === 'processes' ? '#10b981' : 'rgba(255,255,255,0.06)'}; color: \${taskMgrActiveTab === 'processes' ? '#022c22' : '#cbd5e1'}; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">Processes (\${windows.length})</button>
              <button onclick="setTaskMgrTab('performance')" style="background: \${taskMgrActiveTab === 'performance' ? '#10b981' : 'rgba(255,255,255,0.06)'}; color: \${taskMgrActiveTab === 'performance' ? '#022c22' : '#cbd5e1'}; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">Performance</button>
              <button onclick="setTaskMgrTab('memory')" style="background: \${taskMgrActiveTab === 'memory' ? '#10b981' : 'rgba(255,255,255,0.06)'}; color: \${taskMgrActiveTab === 'memory' ? '#022c22' : '#cbd5e1'}; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">Address369 Map [0..368]</button>
            </div>
            <span style="font-size: 11px; color: #60a5fa; font-weight: 700;">CPU: 1.2% • RAM: 24.5 MB</span>
          </div>

          <!-- Body Content -->
          <div style="flex: 1; overflow-y: auto; padding: 16px;">
            \${taskMgrActiveTab === 'processes' ? \`
              <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; color: #cbd5e1;">
                  <thead>
                    <tr style="background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08); color: #94a3b8; font-size: 11px;">
                      <th style="padding: 10px 14px;">App Name</th>
                      <th style="padding: 10px 14px;">PID</th>
                      <th style="padding: 10px 14px;">Address369 Slot</th>
                      <th style="padding: 10px 14px;">Memory</th>
                      <th style="padding: 10px 14px;">Status</th>
                      <th style="padding: 10px 14px; text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                      <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">◈ Oview Microkernel Core</td>
                      <td style="padding: 10px 14px; font-family: monospace;">PID 1</td>
                      <td style="padding: 10px 14px; color: #10b981;">Slot #0 (Kernel)</td>
                      <td style="padding: 10px 14px;">8.5 MB</td>
                      <td style="padding: 10px 14px;"><span style="color: #10b981; font-weight: 600;">System Core</span></td>
                      <td style="padding: 10px 14px; text-align: right;"><span style="color: #64748b; font-size: 11px;">Protected</span></td>
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                      <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">🤖 ECHO-1 Offline Brain</td>
                      <td style="padding: 10px 14px; font-family: monospace;">PID 2</td>
                      <td style="padding: 10px 14px; color: #10b981;">Slot #1 (Neural)</td>
                      <td style="padding: 10px 14px;">16.0 MB</td>
                      <td style="padding: 10px 14px;"><span style="color: #10b981; font-weight: 600;">Active</span></td>
                      <td style="padding: 10px 14px; text-align: right;"><span style="color: #64748b; font-size: 11px;">Protected</span></td>
                    </tr>
                    \${windows.map((w, idx) => \`
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                        <td style="padding: 10px 14px; font-weight: 600; color: #f8fafc;">\${w.icon} \${w.title}</td>
                        <td style="padding: 10px 14px; font-family: monospace;">PID \${100 + idx}</td>
                        <td style="padding: 10px 14px; color: #38bdf8;">Slot #\${20 + idx * 5}</td>
                        <td style="padding: 10px 14px;">\${(12.4 + idx * 2.1).toFixed(1)} MB</td>
                        <td style="padding: 10px 14px;"><span style="color: \${w.isMinimized ? '#94a3b8' : '#10b981'}; font-weight: 600;">\${w.isMinimized ? 'Minimized' : 'Running'}</span></td>
                        <td style="padding: 10px 14px; text-align: right;">
                          <button onclick="closeWindow('\${w.id}'); showToast('Task Manager', 'Terminated process for \${w.title}', 'warning');" style="background: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.3); color: #f43f5e; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">End Task</button>
                        </td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>
            \` : taskMgrActiveTab === 'performance' ? \`
              <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="font-size: 14px; font-weight: 700; color: #f8fafc;">CPU Telemetry (Qplayer Register VM)</span>
                    <span style="font-size: 12px; color: #10b981; font-weight: 600;">204.8M ops/sec target</span>
                  </div>
                  <div style="height: 100px; display: flex; align-items: flex-end; gap: 6px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    \${[12, 18, 14, 25, 20, 15, 28, 19, 14, 22, 16, 24, 18, 30, 22, 14, 26, 18, 15, 20].map(h => \`
                      <div style="flex: 1; height: \${h * 2.5}px; background: linear-gradient(to top, #10b981, #3b82f6); border-radius: 3px 3px 0 0; opacity: 0.85;"></div>
                    \`).join('')}
                  </div>
                </div>

                <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 14px; font-weight: 700; color: #f8fafc;">Sovereign Memory Footprint</span>
                    <span style="font-size: 12px; color: #a855f7; font-weight: 600;">24.5 MB / 1024 MB (2.4%)</span>
                  </div>
                  <div style="width: 100%; height: 16px; background: rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden;">
                    <div style="width: 2.4%; height: 100%; background: linear-gradient(90deg, #a855f7, #6366f1); border-radius: 8px;"></div>
                  </div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Microkernel, OLTO Signals, and ECHO-1 offline brain combined consume less than 25MB total RAM.</div>
                </div>
              </div>
            \` : \`
              <div style="background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div>
                    <span style="font-size: 14px; font-weight: 700; color: #f8fafc;">Address369 Spatial Memory Map</span>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Slots [0..9] Kernel • [10..359] User • [360..368] Reserved</div>
                  </div>
                  <div style="display: flex; gap: 8px; font-size: 10px;">
                    <span style="color: #10b981;">■ Kernel</span>
                    <span style="color: #38bdf8;">■ Allocated User</span>
                    <span style="color: #334155;">■ Free Slot</span>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(24, 1fr); gap: 4px; max-height: 260px; overflow-y: auto; padding: 4px;">
                  \${Array.from({ length: 120 }).map((_, i) => {
                    const isKernel = i < 10;
                    const isAllocated = isKernel || i === 12 || i === 15 || i === 20 || i === 25 || i === 30 || i === 35 || i === 40 || i === 45 || i === 50 || i === 55 || i === 60 || i === 65 || i === 70 || i === 75 || i === 80 || i === 85 || i === 90 || i === 95;
                    const color = isKernel ? '#10b981' : isAllocated ? '#38bdf8' : '#1e293b';
                    return \`<div title="Slot #\${i}: \${isKernel ? 'Kernel' : isAllocated ? 'Allocated App' : 'Free'}" style="height: 14px; background: \${color}; border-radius: 2px; cursor: pointer;"></div>\`;
                  }).join('')}
                </div>
              </div>
            \`}
          </div>

          <!-- Bottom Footer -->
          <div style="padding: 8px 14px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b;">
            <span>Address369 Slot [90] • Fail-Safe Process Supervisor</span>
            <span>Invariant E9001: Zero Leakage Enforced</span>
          </div>
        </div>
      \`;
    }

    function setTaskMgrTab(tab) {
      taskMgrActiveTab = tab;
      renderWindows();
    }

    // ──────────────── 19. OPLAYER (MEDIA ENGINE) ────────────────
    let playerIsPlaying = false;
    let playerTrackIndex = 0;
    let playerPosition = 42;
    const playerPlaylist = [
      { title: 'Sovereign Wave', artist: 'ONE Lang Sound Collective', duration: 214, genre: 'Synthwave' },
      { title: 'ECHO-1 Neural Beats', artist: 'Deepmind Offline Model', duration: 185, genre: 'Lo-Fi Ambient' },
      { title: 'Address369 Quantum Drift', artist: 'Qplayer Registers', duration: 240, genre: 'Electronic Pulse' }
    ];

    function renderPlayerApp(winId) {
      const cur = playerPlaylist[playerTrackIndex];
      const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
      };

      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #070914; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Media Bar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <span style="font-size: 13px; font-weight: 700; color: #f8fafc;">Oplayer • Sovereign Media Engine</span>
            <span style="font-size: 11px; color: #a855f7; font-weight: 700;">Genre: \${cur.genre}</span>
          </div>

          <!-- Body: Now Playing & FFT Visualizer -->
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px;">
            <div style="width: 110px; height: 110px; border-radius: 50%; background: radial-gradient(circle, #38bdf8 0%, #1e1b4b 70%); display: flex; align-items: center; justify-content: center; font-size: 46px; box-shadow: 0 0 35px rgba(56, 189, 248, 0.35); margin-bottom: 18px;">
              🎵
            </div>

            <div style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-bottom: 4px;">\${cur.title}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 18px;">\${cur.artist}</div>

            <!-- Simulated WebAudio FFT Spectrum Bars -->
            <div style="display: flex; align-items: flex-end; gap: 4px; height: 50px; width: 340px; margin-bottom: 18px;">
              \${Array.from({ length: 28 }).map((_, i) => {
                const height = playerIsPlaying ? Math.max(8, (i * 13 + playerPosition * 5) % 48) : 6;
                return \`<div style="flex: 1; height: \${height}px; background: linear-gradient(to top, #38bdf8, #a855f7); border-radius: 2px; transition: height 0.15s ease;"></div>\`;
              }).join('')}
            </div>

            <!-- Timeline Scrubber -->
            <div style="width: 380px; max-width: 90%; display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px;">
              <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; position: relative; cursor: pointer;">
                <div style="width: \${(playerPosition / cur.duration * 100).toFixed(1)}%; height: 100%; background: #38bdf8; border-radius: 3px;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-family: monospace;">
                <span>\${formatTime(playerPosition)}</span>
                <span>\${formatTime(cur.duration)}</span>
              </div>
            </div>

            <!-- Playback Controls -->
            <div style="display: flex; align-items: center; gap: 16px;">
              <button onclick="playerPrevTrack()" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 14px;">⏮</button>
              <button onclick="playerTogglePlay()" style="background: linear-gradient(135deg, #38bdf8, #2563eb); border: none; color: #fff; width: 48px; height: 48px; border-radius: 50%; cursor: pointer; font-size: 20px; box-shadow: 0 4px 15px rgba(56,189,248,0.4);">\${playerIsPlaying ? '⏸' : '▶'}</button>
              <button onclick="playerNextTrack()" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 14px;">⏭</button>
            </div>
          </div>

          <!-- Bottom Footer -->
          <div style="padding: 8px 14px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b;">
            <span>Address369 Slot [95] • WebAudio FFT Synthesizer Pipeline</span>
            <span>VFS Storage: /user/media/</span>
          </div>
        </div>
      \`;
    }

    function playerTogglePlay() {
      playerIsPlaying = !playerIsPlaying;
      showToast('Oplayer', playerIsPlaying ? 'Playing: ' + playerPlaylist[playerTrackIndex].title : 'Paused', 'info');
      renderWindows();
    }

    function playerNextTrack() {
      playerTrackIndex = (playerTrackIndex + 1) % playerPlaylist.length;
      playerPosition = 0;
      showToast('Oplayer', 'Track: ' + playerPlaylist[playerTrackIndex].title, 'info');
      renderWindows();
    }

    function playerPrevTrack() {
      playerTrackIndex = (playerTrackIndex - 1 + playerPlaylist.length) % playerPlaylist.length;
      playerPosition = 0;
      showToast('Oplayer', 'Track: ' + playerPlaylist[playerTrackIndex].title, 'info');
      renderWindows();
    }

    // ──────────────── 20. OPACKAGER (.ONEPKG CONVERTER & PUBLISHER) ────────────────
    let opackagerActiveTab = 'packager';
    let opackagerRawFiles = [
      { id: 'raw_1', filename: 'putty_installer.exe', size: '1.8 MB', type: 'Windows PE Executable (.exe)', name: 'PuTTY SSH Terminal', icon: '⚡', category: 'developer' },
      { id: 'raw_2', filename: '7zip_setup.exe', size: '1.5 MB', type: 'Windows Installer (.exe)', name: '7-Zip Archiver Pro', icon: '📦', category: 'utility' },
      { id: 'raw_3', filename: 'retro_arcade_invaders.zip', size: '3.4 MB', type: 'Compressed Binary (.zip)', name: 'Retro Space Invaders', icon: '👾', category: 'games' }
    ];
    let opackagerPackages = [
      {
        id: 'onepkg_putty',
        appId: 'onepkg.putty_ssh',
        name: 'PuTTY SSH Terminal',
        version: '0.81.0',
        icon: '⚡',
        category: 'developer',
        originalFile: 'putty_installer.exe',
        compressedSize: '612 KB',
        backupPath: '/user/packages/putty_ssh.onepkg',
        isInstalled: false,
        isPublished: true,
        downloads: 142
      }
    ];
    let isOpackagerConverting = false;
    let opackagerConversionProgress = 0;
    let opackagerConvertingName = '';

    function renderOPackagerApp(winId) {
      return \`
        <div style="display: flex; flex-direction: column; height: 100%; background: #070914; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
          <!-- Top Navigation Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; gap: 8px;">
              <button onclick="setOPackagerTab('packager')" style="background: \${opackagerActiveTab === 'packager' ? '#10b981' : 'rgba(255,255,255,0.06)'}; color: \${opackagerActiveTab === 'packager' ? '#022c22' : '#cbd5e1'}; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">⚡ Repackager & Converter</button>
              <button onclick="setOPackagerTab('backups')" style="background: \${opackagerActiveTab === 'backups' ? '#10b981' : 'rgba(255,255,255,0.06)'}; color: \${opackagerActiveTab === 'backups' ? '#022c22' : '#cbd5e1'}; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">💾 Saved .onepkg Backups (\${opackagerPackages.length})</button>
              <button onclick="setOPackagerTab('marketplace')" style="background: \${opackagerActiveTab === 'marketplace' ? '#10b981' : 'rgba(255,255,255,0.06)'}; color: \${opackagerActiveTab === 'marketplace' ? '#022c22' : '#cbd5e1'}; font-weight: 700; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">🌐 Oview Marketplace</button>
            </div>
            <span style="font-size: 11px; color: #a855f7; font-weight: 700;">Format: .onepkg Sovereign Container</span>
          </div>

          <!-- Body -->
          <div style="flex: 1; overflow-y: auto; padding: 18px;">
            \${opackagerActiveTab === 'packager' ? \`
              <!-- Drop Zone & Converter -->
              <div style="background: rgba(18, 25, 41, 0.8); border: 2px dashed rgba(16, 185, 129, 0.4); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 20px;">
                <div style="font-size: 38px; margin-bottom: 8px;">📦</div>
                <div style="font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">Drag & Drop Any Windows/Mac Software Package Here</div>
                <div style="font-size: 11px; color: #94a3b8; max-width: 500px; margin: 0 auto 16px auto;">
                  Drop any raw .exe, .zip, or .dmg installer. OPackager will analyze the payload, synthesize launcher.one, compress into a sovereign .onepkg, save an offline backup, and enable 1-click desktop installation!
                </div>
                \${isOpackagerConverting ? \`
                  <div style="max-width: 400px; margin: 0 auto; background: rgba(0,0,0,0.4); border-radius: 10px; padding: 12px; border: 1px solid rgba(16, 185, 129, 0.3);">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #10b981; font-weight: 600; margin-bottom: 6px;">
                      <span>Converting \${opackagerConvertingName} ➔ .onepkg...</span>
                      <span>\${opackagerConversionProgress}%</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                      <div style="width: \${opackagerConversionProgress}%; height: 100%; background: #10b981; border-radius: 4px; transition: width 0.2s;"></div>
                    </div>
                  </div>
                \` : \`
                  <button onclick="opackagerConvertFile(0)" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 8px 20px; border-radius: 8px; font-size: 12px; cursor: pointer;">⚡ Convert Sample Software (puTTY.exe)</button>
                \`}
              </div>

              <!-- Available External Installers Ready for Conversion -->
              <div style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-bottom: 10px;">Detected External Software Payloads:</div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                \${opackagerRawFiles.map((rf, idx) => \`
                  <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(18, 25, 41, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 24px;">\${rf.icon}</span>
                      <div>
                        <div style="font-size: 13px; font-weight: 600; color: #f8fafc;">\${rf.name}</div>
                        <div style="font-size: 11px; color: #94a3b8;">\${rf.filename} • \${rf.size} • <span style="color: #38bdf8;">\${rf.type}</span></div>
                      </div>
                    </div>
                    <button onclick="opackagerConvertFile(\${idx})" \${isOpackagerConverting ? 'disabled' : ''} style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                      Convert ➔ .onepkg
                    </button>
                  </div>
                \`).join('')}
              </div>
            \` : opackagerActiveTab === 'backups' ? \`
              <!-- Saved .onepkg Backups in /user/packages/ -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #f8fafc;">Sovereign Package Backups</div>
                  <div style="font-size: 11px; color: #94a3b8;">Permanently stored in VFS (/user/packages/). Ready to install or share anytime.</div>
                </div>
                <span style="font-size: 11px; color: #10b981; font-weight: 600;">\${opackagerPackages.length} Offline Packages</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 10px;">
                \${opackagerPackages.map(pkg => \`
                  <div style="padding: 14px 18px; background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                      <span style="font-size: 30px;">\${pkg.icon}</span>
                      <div>
                        <div style="font-size: 14px; font-weight: 700; color: #f8fafc;">\${pkg.name} <span style="font-size: 10px; color: #10b981; background: rgba(16,185,129,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">.onepkg</span></div>
                        <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">
                          Compressed: \${pkg.compressedSize} • Original: \${pkg.originalFile} • Backup: <span style="color: #cbd5e1; font-family: monospace;">\${pkg.backupPath}</span>
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button onclick="opackagerInstall('\${pkg.id}')" style="background: \${pkg.isInstalled ? 'rgba(255,255,255,0.06)' : '#10b981'}; color: \${pkg.isInstalled ? '#94a3b8' : '#022c22'}; border: none; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                        \${pkg.isInstalled ? '✓ Installed' : '🚀 Install to Desktop'}
                      </button>
                      <button onclick="opackagerPublish('\${pkg.id}')" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">
                        \${pkg.isPublished ? '🌐 Live in Marketplace' : '🌐 Publish to Store'}
                      </button>
                    </div>
                  </div>
                \`).join('')}
              </div>
            \` : \`
              <!-- Oview Marketplace Catalog -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                <div>
                  <div style="font-size: 15px; font-weight: 700; color: #f8fafc;">Oview Sovereign Marketplace</div>
                  <div style="font-size: 11px; color: #94a3b8;">Discover & Install Community-Repackaged Applications with 1-Click</div>
                </div>
                <button onclick="setOPackagerTab('packager')" style="background: #10b981; color: #022c22; font-weight: 700; border: none; padding: 6px 14px; border-radius: 6px; font-size: 11px; cursor: pointer;">+ Publish My App</button>
              </div>

              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                \${opackagerPackages.filter(p => p.isPublished).map(pkg => \`
                  <div style="padding: 16px; background: rgba(18, 25, 41, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                      <span style="font-size: 32px;">\${pkg.icon}</span>
                      <div>
                        <div style="font-size: 14px; font-weight: 700; color: #f8fafc;">\${pkg.name}</div>
                        <div style="font-size: 11px; color: #10b981; font-weight: 600;">v\${pkg.version} • \${pkg.category.toUpperCase()}</div>
                        <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Universal .onepkg container repackaged from \${pkg.originalFile}. Tested offline with zero dependencies.</div>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; margin-top: 6px;">
                      <span style="font-size: 11px; color: #64748b;">📥 \${pkg.downloads} Downloads • ⭐ 4.9</span>
                      <button onclick="opackagerInstall('\${pkg.id}')" style="background: \${pkg.isInstalled ? 'rgba(255,255,255,0.06)' : '#10b981'}; color: \${pkg.isInstalled ? '#94a3b8' : '#022c22'}; border: none; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                        \${pkg.isInstalled ? 'Installed' : 'Get (1-Click)'}
                      </button>
                    </div>
                  </div>
                \`).join('')}
              </div>
            \`}
          </div>

          <!-- Bottom Status Footer -->
          <div style="padding: 8px 14px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b;">
            <span>Address369 Slot [100] • Sovereign .onepkg Converter & Publisher</span>
            <span>Tri-Pillar Output: Install • Offline Backup • Marketplace</span>
          </div>
        </div>
      \`;
    }

    function setOPackagerTab(tab) {
      opackagerActiveTab = tab;
      renderWindows();
    }

    function opackagerConvertFile(idx) {
      const raw = opackagerRawFiles[idx];
      if (!raw || isOpackagerConverting) return;

      isOpackagerConverting = true;
      opackagerConvertingName = raw.name;
      opackagerConversionProgress = 15;
      renderWindows();

      setTimeout(() => {
        opackagerConversionProgress = 45;
        renderWindows();

        setTimeout(() => {
          opackagerConversionProgress = 80;
          renderWindows();

          setTimeout(() => {
            opackagerConversionProgress = 100;
            isOpackagerConverting = false;

            const slug = raw.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const newPkg = {
              id: 'onepkg_' + Date.now(),
              appId: 'onepkg.' + slug,
              name: raw.name,
              version: '1.0.0',
              icon: raw.icon,
              category: raw.category,
              originalFile: raw.filename,
              compressedSize: (parseFloat(raw.size) * 0.45).toFixed(1) + ' MB',
              backupPath: '/user/packages/' + slug + '.onepkg',
              isInstalled: false,
              isPublished: false,
              downloads: 1
            };

            opackagerPackages.unshift(newPkg);
            CLIENT_VFS[newPkg.backupPath] = {
              type: 'file',
              content: JSON.stringify(newPkg, null, 2)
            };

            showToast('OPackager', 'Converted ' + raw.filename + ' ➔ ' + slug + '.onepkg and saved to /user/packages/!', 'success');
            opackagerActiveTab = 'backups';
            renderWindows();
          }, 400);
        }, 500);
      }, 400);
    }

    function opackagerInstall(pkgId) {
      const pkg = opackagerPackages.find(p => p.id === pkgId);
      if (!pkg) return;

      pkg.isInstalled = true;

      // Add to APP_REGISTRY and APP_RENDERERS dynamically
      if (!APP_REGISTRY.some(a => a.id === pkg.appId)) {
        APP_REGISTRY.push({
          id: pkg.appId,
          name: pkg.name,
          icon: pkg.icon,
          defaultWidth: 700,
          defaultHeight: 460
        });

        APP_RENDERERS[pkg.appId] = function(winId) {
          return \`
            <div style="display: flex; flex-direction: column; height: 100%; background: #080d1a; color: #f8fafc; font-family: -apple-system, sans-serif; padding: 20px;">
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <span style="font-size: 32px;">\${pkg.icon}</span>
                <div>
                  <div style="font-size: 18px; font-weight: 800;">\${pkg.name}</div>
                  <div style="font-size: 11px; color: #10b981; font-weight: 600;">Sovereign .onepkg Container • Converted from \${pkg.originalFile}</div>
                </div>
              </div>
              <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; margin-bottom: 14px; font-family: monospace; font-size: 11px; line-height: 1.6; color: #cbd5e1;">
                [Address369 Isolation Sandbox Active]<br/>
                • Container: \${pkg.backupPath}<br/>
                • Original Binary: \${pkg.originalFile} (Win32 Intercepted)<br/>
                • Native OLTO Canvas: Active (60 FPS)<br/>
                • Memory Boundary: Slot Assigned [E9001 Compliant]
              </div>
              <div style="padding: 12px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; color: #6ee7b7; font-size: 12px;">
                Application is running smoothly in pure ONE Language substrate!
              </div>
            </div>
          \`;
        };
      }

      showToast('OPackager', 'Installed ' + pkg.name + ' to Oview Desktop! Launching...', 'success');
      launchApp(pkg.appId);
      renderWindows();
      renderTaskbar();
    }

    function opackagerPublish(pkgId) {
      const pkg = opackagerPackages.find(p => p.id === pkgId);
      if (!pkg) return;

      pkg.isPublished = true;
      CLIENT_VFS['/system/marketplace/' + pkg.appId + '.json'] = {
        type: 'file',
        content: JSON.stringify(pkg, null, 2)
      };

      showToast('Marketplace', 'Published ' + pkg.name + ' to Community Store!', 'success');
      renderWindows();
    }

    // ──────────────── 21. OSHEETS SPREADSHEET (EXCEL IN ONE) ────────────────
    let osheetsCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let osheetsRowsCount = 20;
    let osheetsSelectedCell = 'A1';
    let osheetsCells = {
      'A1': { raw: 'Item Description', computed: 'Item Description', bold: true },
      'B1': { raw: 'Category', computed: 'Category', bold: true },
      'C1': { raw: 'Cost ($)', computed: 'Cost ($)', bold: true, align: 'right' },
      'D1': { raw: 'Status', computed: 'Status', bold: true },
      'A2': { raw: 'Cloud Server VM', computed: 'Cloud Server VM' },
      'B2': { raw: 'Infrastructure', computed: 'Infrastructure' },
      'C2': { raw: '120', computed: '120', align: 'right' },
      'D2': { raw: 'Paid', computed: 'Paid' },
      'A3': { raw: 'Domain Name Registry', computed: 'Domain Name Registry' },
      'B3': { raw: 'Operations', computed: 'Operations' },
      'C3': { raw: '25', computed: '25', align: 'right' },
      'D3': { raw: 'Paid', computed: 'Paid' },
      'A4': { raw: 'Hardware Edge Nodes', computed: 'Hardware Edge Nodes' },
      'B4': { raw: 'Hardware', computed: 'Hardware' },
      'C4': { raw: '350', computed: '350', align: 'right' },
      'D4': { raw: 'Pending', computed: 'Pending' },
      'A5': { raw: 'TOTAL COST', computed: 'TOTAL COST', bold: true },
      'C5': { raw: '=SUM(C2:C4)', computed: '495', bold: true, align: 'right' }
    };

    function osheetsEvaluateFormula(expr) {
      if (!expr || !expr.startsWith('=')) return expr || '';
      const f = expr.slice(1).trim().toUpperCase();

      // =SUM(C2:C4)
      if (f.startsWith('SUM(') && f.endsWith(')')) {
        const inner = f.slice(4, -1);
        const parts = inner.split(':');
        let sum = 0;
        if (parts.length === 2) {
          const col = parts[0][0];
          const r1 = parseInt(parts[0].slice(1));
          const r2 = parseInt(parts[1].slice(1));
          for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
            const v = parseFloat((osheetsCells[col + r] && osheetsCells[col + r].computed) || 0);
            if (!isNaN(v)) sum += v;
          }
        }
        return sum.toString();
      }

      // =AVG(C2:C4)
      if (f.startsWith('AVG(') && f.endsWith(')')) {
        const inner = f.slice(4, -1);
        const parts = inner.split(':');
        let sum = 0, count = 0;
        if (parts.length === 2) {
          const col = parts[0][0];
          const r1 = parseInt(parts[0].slice(1));
          const r2 = parseInt(parts[1].slice(1));
          for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
            const v = parseFloat((osheetsCells[col + r] && osheetsCells[col + r].computed) || 0);
            if (!isNaN(v)) { sum += v; count++; }
          }
        }
        return count > 0 ? (sum / count).toFixed(2) : '0';
      }

      // Basic Binary: e.g. A1 + B1 or C2 * 2
      for (const op of ['+', '-', '*', '/']) {
        if (f.includes(op)) {
          const parts = f.split(op).map(s => s.trim());
          if (parts.length === 2) {
            const lKey = parts[0], rKey = parts[1];
            const lVal = isNaN(Number(lKey)) ? parseFloat((osheetsCells[lKey] && osheetsCells[lKey].computed) || 0) : parseFloat(lKey);
            const rVal = isNaN(Number(rKey)) ? parseFloat((osheetsCells[rKey] && osheetsCells[rKey].computed) || 0) : parseFloat(rKey);
            if (isNaN(lVal) || isNaN(rVal)) return '#VALUE!';
            if (op === '+') return (lVal + rVal).toString();
            if (op === '-') return (lVal - rVal).toString();
            if (op === '*') return (lVal * rVal).toString();
            if (op === '/') return rVal !== 0 ? (lVal / rVal).toString() : '#DIV/0!';
          }
        }
      }
      return '#ERROR!';
    }

    function osheetsRecalculate() {
      for (let p = 0; p < 2; p++) {
        for (const [k, cell] of Object.entries(osheetsCells)) {
          if (cell.raw && cell.raw.startsWith('=')) {
            cell.computed = osheetsEvaluateFormula(cell.raw);
          } else {
            cell.computed = cell.raw || '';
          }
        }
      }
    }

    function osheetsSelectCell(cid) {
      osheetsSelectedCell = cid;
      renderWindows();
    }

    function osheetsUpdateActiveCell(val) {
      if (!osheetsCells[osheetsSelectedCell]) {
        osheetsCells[osheetsSelectedCell] = { raw: '', computed: '' };
      }
      osheetsCells[osheetsSelectedCell].raw = val;
      osheetsRecalculate();
      renderWindows();
    }

    function osheetsToggleBold() {
      if (!osheetsCells[osheetsSelectedCell]) osheetsCells[osheetsSelectedCell] = { raw: '', computed: '' };
      osheetsCells[osheetsSelectedCell].bold = !osheetsCells[osheetsSelectedCell].bold;
      renderWindows();
    }

    function osheetsToggleItalic() {
      if (!osheetsCells[osheetsSelectedCell]) osheetsCells[osheetsSelectedCell] = { raw: '', computed: '' };
      osheetsCells[osheetsSelectedCell].italic = !osheetsCells[osheetsSelectedCell].italic;
      renderWindows();
    }

    function osheetsExportCSV() {
      let csv = '';
      for (let r = 1; r <= 10; r++) {
        let row = [];
        for (const c of osheetsCols) {
          const val = (osheetsCells[c + r] && osheetsCells[c + r].computed) || '';
          row.push('"' + val.replace(/"/g, '""') + '"');
        }
        csv += row.join(',') + '\\n';
      }
      CLIENT_VFS['/user/documents/budget_export.csv'] = { type: 'file', content: csv };
      showToast('Osheets', 'Exported to /user/documents/budget_export.csv!', 'success');
      renderWindows();
    }

    function osheetsSaveVFS() {
      CLIENT_VFS['/user/documents/budget_2026.osheet'] = {
        type: 'file',
        content: JSON.stringify({ cells: osheetsCells, rows: osheetsRowsCount }, null, 2)
      };
      showToast('Osheets', 'Saved sheet to /user/documents/budget_2026.osheet', 'success');
    }

    function renderOsheetsApp(winId) {
      const activeRaw = (osheetsCells[osheetsSelectedCell] && osheetsCells[osheetsSelectedCell].raw) || '';

      // Compute status bar stats for numeric cells
      let sum = 0, count = 0;
      for (const [k, v] of Object.entries(osheetsCells)) {
        const num = parseFloat(v.computed);
        if (!isNaN(num) && !k.endsWith('1')) {
          sum += num;
          count++;
        }
      }
      const avg = count > 0 ? (sum / count).toFixed(1) : 0;

      return \`
        <div style="display: flex; flex-direction: column; height: 100%; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a;">
          <!-- Ribbon Toolbar -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.08);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; color: #10b981; font-size: 13px;">📊 Osheets</span>
              <div style="display: flex; gap: 4px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 8px;">
                <button onclick="osheetsToggleBold()" style="padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-weight: bold; cursor: pointer; font-size: 11px;">B</button>
                <button onclick="osheetsToggleItalic()" style="padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-style: italic; cursor: pointer; font-size: 11px;">I</button>
                <button onclick="osheetsUpdateActiveCell('$' + (osheetsCells[osheetsSelectedCell] ? osheetsCells[osheetsSelectedCell].computed : '0'))" style="padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #10b981; cursor: pointer; font-size: 11px;">$ Format</button>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <button onclick="osheetsExportCSV()" style="padding: 4px 10px; border-radius: 6px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; font-size: 11px; font-weight: 600; cursor: pointer;">📥 Export CSV</button>
              <button onclick="osheetsSaveVFS()" style="padding: 4px 10px; border-radius: 6px; background: #10b981; border: none; color: #022c22; font-size: 11px; font-weight: 600; cursor: pointer;">💾 Save</button>
            </div>
          </div>

          <!-- Formula Bar -->
          <div style="display: flex; align-items: center; gap: 8px; padding: 4px 12px; background: rgba(15, 23, 42, 0.8); border-bottom: 1px solid rgba(255,255,255,0.08);">
            <span style="font-family: monospace; font-size: 12px; font-weight: 700; color: #38bdf8; width: 35px;">\${osheetsSelectedCell}</span>
            <span style="font-size: 12px; color: #94a3b8; font-style: italic;">fx:</span>
            <input type="text" value="\${activeRaw}" oninput="osheetsUpdateActiveCell(this.value)" placeholder="Enter value or formula like =SUM(C2:C4)" style="flex: 1; padding: 4px 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: monospace; font-size: 11px; outline: none;" />
          </div>

          <!-- Spreadsheet Grid -->
          <div style="flex: 1; overflow: auto; background: #0b0f19;">
            <table style="border-collapse: collapse; width: 100%; min-width: 600px; font-size: 11px;">
              <thead>
                <tr style="background: rgba(15, 23, 42, 0.9); position: sticky; top: 0; z-index: 2;">
                  <th style="width: 36px; padding: 4px; border: 1px solid rgba(255,255,255,0.08); color: #64748b; font-weight: 600; text-align: center;">#</th>
                  \${osheetsCols.map(c => \`
                    <th style="padding: 4px 8px; border: 1px solid rgba(255,255,255,0.08); color: #94a3b8; font-weight: 600; text-align: center; min-width: 90px;">\${c}</th>
                  \`).join('')}
                </tr>
              </thead>
              <tbody>
                \${Array.from({ length: 15 }, (_, i) => i + 1).map(r => \`
                  <tr>
                    <td style="background: rgba(15, 23, 42, 0.5); padding: 4px; border: 1px solid rgba(255,255,255,0.06); color: #64748b; font-weight: 600; text-align: center;">\${r}</td>
                    \${osheetsCols.map(c => {
                      const cid = c + r;
                      const cell = osheetsCells[cid] || { raw: '', computed: '' };
                      const isSel = osheetsSelectedCell === cid;
                      const isB = cell.bold;
                      const isI = cell.italic;
                      const align = cell.align || 'left';
                      return \`
                        <td onclick="osheetsSelectCell('\${cid}')" style="padding: 5px 8px; border: 1px solid rgba(255,255,255,0.06); cursor: pointer; text-align: \${align}; font-weight: \${isB ? '700' : 'normal'}; font-style: \${isI ? 'italic' : 'normal'}; background: \${isSel ? 'rgba(16,185,129,0.2)' : 'transparent'}; outline: \${isSel ? '2px solid #10b981' : 'none'}; color: \${cell.raw && cell.raw.startsWith('=') ? '#38bdf8' : '#f8fafc'}; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                          \${cell.computed || '&nbsp;'}
                        </td>
                      \`;
                    }).join('')}
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>

          <!-- Bottom Status Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #94a3b8;">
            <span>Cell: <strong>\${osheetsSelectedCell}</strong></span>
            <span>SUM: <strong style="color: #10b981;">\${sum}</strong> | AVG: <strong>\${avg}</strong> | COUNT: <strong>\${count}</strong></span>
            <span>ONE Language Math VM</span>
          </div>
        </div>
      \`;
    }

    // ──────────────── 22. OCANVAS INFINITE WHITEBOARD (MIND-MAPPING) ────────────────
    let ocanvasItems = [
      { id: 'core_1', type: 'shape', shapeType: 'rect', x: 60, y: 70, width: 200, height: 75, label: 'Sovereign Oview OS\\n(ONE Language Core)', color: '#10b981' },
      { id: 'sticky_1', type: 'sticky', x: 340, y: 40, width: 170, height: 110, text: '📊 Osheets\\n• Tabular Grid A..H\\n• Formula Math Engine\\n• CSV & VFS Export', color: '#bae6fd' },
      { id: 'sticky_2', type: 'sticky', x: 340, y: 180, width: 170, height: 110, text: '🎨 Ocanvas\\n• Infinite 2D Surface\\n• Mind-Mapping Links\\n• Interactive Sticky Notes', color: '#fef08a' }
    ];
    let ocanvasZoom = 100;
    let ocanvasSelectedId = null;

    function ocanvasAddSticky(color) {
      const id = 'sticky_' + Math.random().toString(36).substring(2, 7);
      const x = 120 + (ocanvasItems.length * 25);
      const y = 140 + (ocanvasItems.length * 20);
      ocanvasItems.push({
        id,
        type: 'sticky',
        x,
        y,
        width: 160,
        height: 110,
        text: 'New Idea Note\\n• Click to edit text\\n• Drag to organize',
        color: color || '#fef08a'
      });
      ocanvasSelectedId = id;
      showToast('Ocanvas', 'Added new sticky note! 📝', 'success');
      renderWindows();
    }

    function ocanvasAddShape(shapeType) {
      const id = 'shape_' + Math.random().toString(36).substring(2, 7);
      const x = 160 + (ocanvasItems.length * 20);
      const y = 100 + (ocanvasItems.length * 15);
      ocanvasItems.push({
        id,
        type: 'shape',
        shapeType: shapeType || 'rect',
        x,
        y,
        width: 170,
        height: 60,
        label: 'Process Step ' + (ocanvasItems.length + 1),
        color: '#38bdf8'
      });
      ocanvasSelectedId = id;
      showToast('Ocanvas', 'Added process node! ⬜', 'success');
      renderWindows();
    }

    function ocanvasUpdateText(id, newText) {
      const item = ocanvasItems.find(i => i.id === id);
      if (item) {
        if (item.type === 'sticky') item.text = newText;
        else if (item.type === 'shape') item.label = newText;
      }
    }

    function ocanvasDeleteItem(id) {
      ocanvasItems = ocanvasItems.filter(i => i.id !== id);
      if (ocanvasSelectedId === id) ocanvasSelectedId = null;
      renderWindows();
    }

    function ocanvasZoomIn() {
      ocanvasZoom = Math.min(200, ocanvasZoom + 15);
      renderWindows();
    }

    function ocanvasZoomOut() {
      ocanvasZoom = Math.max(50, ocanvasZoom - 15);
      renderWindows();
    }

    function ocanvasResetZoom() {
      ocanvasZoom = 100;
      renderWindows();
    }

    function ocanvasSaveVFS() {
      CLIENT_VFS['/user/documents/architecture_mindmap.board'] = {
        type: 'file',
        content: JSON.stringify({ items: ocanvasItems, zoom: ocanvasZoom }, null, 2)
      };
      showToast('Ocanvas', 'Saved board to /user/documents/architecture_mindmap.board', 'success');
    }

    function renderOcanvasApp(winId) {
      const scale = ocanvasZoom / 100;

      return \`
        <div style="display: flex; flex-direction: column; height: 100%; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070a12; overflow: hidden; position: relative;">
          <!-- Ribbon Toolbar -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.08); z-index: 10;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; color: #38bdf8; font-size: 13px;">🎨 Ocanvas</span>
              <div style="display: flex; gap: 4px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 8px;">
                <button onclick="ocanvasAddSticky('#fef08a')" style="padding: 3px 8px; border-radius: 4px; background: #fef08a; border: none; color: #713f12; font-weight: 600; cursor: pointer; font-size: 11px;">+ 🟡 Yellow</button>
                <button onclick="ocanvasAddSticky('#fbcfe8')" style="padding: 3px 8px; border-radius: 4px; background: #fbcfe8; border: none; color: #831843; font-weight: 600; cursor: pointer; font-size: 11px;">+ 🌸 Pink</button>
                <button onclick="ocanvasAddSticky('#bae6fd')" style="padding: 3px 8px; border-radius: 4px; background: #bae6fd; border: none; color: #0c4a6e; font-weight: 600; cursor: pointer; font-size: 11px;">+ 🔵 Cyan</button>
                <button onclick="ocanvasAddShape('rect')" style="padding: 3px 8px; border-radius: 4px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; cursor: pointer; font-size: 11px;">+ ⬜ Shape</button>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button onclick="ocanvasZoomOut()" style="padding: 3px 8px; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; cursor: pointer; font-size: 11px;">-</button>
              <button onclick="ocanvasResetZoom()" style="padding: 3px 8px; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; cursor: pointer; font-size: 11px;">\${ocanvasZoom}%</button>
              <button onclick="ocanvasZoomIn()" style="padding: 3px 8px; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff; cursor: pointer; font-size: 11px;">+</button>
              <button onclick="ocanvasSaveVFS()" style="padding: 4px 10px; border-radius: 6px; background: #38bdf8; border: none; color: #082f49; font-size: 11px; font-weight: 600; cursor: pointer; margin-left: 6px;">💾 Save Board</button>
            </div>
          </div>

          <!-- Infinite 2D Surface -->
          <div style="flex: 1; position: relative; overflow: hidden; background-image: radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px); background-size: 24px 24px;">
            <!-- Surface Transform Container -->
            <div style="transform: scale(\${scale}); transform-origin: top left; width: 2500px; height: 1800px; position: absolute; top: 0; left: 0;">
              <!-- Render Connectors SVG -->
              <svg style="position: absolute; width: 100%; height: 100%; pointer-events: none;">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
                  </marker>
                </defs>
                <line x1="260" y1="105" x2="340" y2="95" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4" marker-end="url(#arrowhead)" />
                <line x1="260" y1="120" x2="340" y2="230" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4" marker-end="url(#arrowhead)" />
              </svg>

              <!-- Render Items -->
              \${ocanvasItems.map(item => {
                if (item.type === 'shape') {
                  return \`
                    <div style="position: absolute; left: \${item.x}px; top: \${item.y}px; width: \${item.width}px; height: \${item.height}px; background: rgba(16, 185, 129, 0.15); border: 2px solid \${item.color}; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px; box-sizing: border-box; text-align: center; color: #fff; font-weight: 600; font-size: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.4); cursor: move;">
                      <textarea oninput="ocanvasUpdateText('\${item.id}', this.value)" style="width: 100%; height: 100%; background: transparent; border: none; color: #fff; font-weight: 600; font-size: 11px; text-align: center; resize: none; outline: none; font-family: inherit;">\${item.label}</textarea>
                    </div>
                  \`;
                } else if (item.type === 'sticky') {
                  const textColor = item.color === '#fef08a' ? '#713f12' : (item.color === '#fbcfe8' ? '#831843' : '#0c4a6e');
                  return \`
                    <div style="position: absolute; left: \${item.x}px; top: \${item.y}px; width: \${item.width}px; height: \${item.height}px; background: \${item.color}; border-radius: 6px; padding: 10px; box-sizing: border-box; box-shadow: 0 6px 18px rgba(0,0,0,0.35); display: flex; flex-direction: column; cursor: move;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 9px; font-weight: 700; color: \${textColor}; opacity: 0.7;">STICKY NOTE</span>
                        <button onclick="ocanvasDeleteItem('\${item.id}')" style="background: transparent; border: none; color: \${textColor}; cursor: pointer; font-size: 11px; font-weight: bold; opacity: 0.6;">✕</button>
                      </div>
                      <textarea oninput="ocanvasUpdateText('\${item.id}', this.value)" style="flex: 1; width: 100%; background: transparent; border: none; color: \${textColor}; font-size: 11px; font-family: inherit; resize: none; outline: none; line-height: 1.4;">\${item.text}</textarea>
                    </div>
                  \`;
                }
                return '';
              }).join('')}
            </div>
          </div>

          <!-- Bottom Status Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #94a3b8;">
            <span>Items: <strong>\${ocanvasItems.length} nodes</strong></span>
            <span>Zoom: <strong>\${ocanvasZoom}%</strong> (Infinite 2D Canvas)</span>
            <span>Sovereign VFS Mindmap</span>
          </div>
        </div>
      \`;
    }

    function launchApp(appId) {
      const desc = APP_REGISTRY.find(a => a.id === appId) || {
        id: appId,
        name: appId.toUpperCase(),
        icon: '🪟',
        defaultWidth: 720,
        defaultHeight: 480
      };

      // If singleInstance and already open, focus it
      const existing = windows.find(w => w.appId === appId);
      if (existing && desc.singleInstance) {
        focusWindow(existing.id);
        if (existing.isMinimized) unminimizeWindow(existing.id);
        return;
      }

      const id = 'win_' + appId + '_' + Date.now();
      const count = windows.length;
      const offset = (count % 6) * 30;

      nextZIndex++;
      const newWin = {
        id,
        appId,
        title: desc.name,
        icon: desc.icon,
        x: Math.max(40, 80 + offset),
        y: Math.max(40, 60 + offset),
        width: desc.defaultWidth || 720,
        height: desc.defaultHeight || 480,
        isMinimized: false,
        isMaximized: false,
        isFocused: true,
        zIndex: nextZIndex
      };

      windows.forEach(w => w.isFocused = false);
      windows.push(newWin);
      activeWindowId = id;

      renderWindows();
      renderTaskbar();
    }

    function closeWindow(id) {
      windows = windows.filter(w => w.id !== id);
      if (activeWindowId === id) {
        const visible = windows.filter(w => !w.isMinimized);
        if (visible.length > 0) {
          visible.sort((a, b) => b.zIndex - a.zIndex);
          visible[0].isFocused = true;
          activeWindowId = visible[0].id;
        } else {
          activeWindowId = null;
        }
      }
      renderWindows();
      renderTaskbar();
    }

    function focusWindow(id) {
      const target = windows.find(w => w.id === id);
      if (!target) return;
      nextZIndex++;
      windows.forEach(w => {
        w.isFocused = (w.id === id);
        if (w.id === id) {
          w.zIndex = nextZIndex;
          w.isMinimized = false;
        }
      });
      activeWindowId = id;
      renderWindows();
      renderTaskbar();
    }

    function toggleMinimize(id) {
      const win = windows.find(w => w.id === id);
      if (!win) return;
      if (win.isMinimized) {
        unminimizeWindow(id);
      } else if (win.isFocused) {
        win.isMinimized = true;
        win.isFocused = false;
        const visible = windows.filter(w => !w.isMinimized && w.id !== id);
        if (visible.length > 0) {
          visible.sort((a, b) => b.zIndex - a.zIndex);
          visible[0].isFocused = true;
          activeWindowId = visible[0].id;
        } else {
          activeWindowId = null;
        }
        renderWindows();
        renderTaskbar();
      } else {
        focusWindow(id);
      }
    }

    function unminimizeWindow(id) {
      const win = windows.find(w => w.id === id);
      if (!win) return;
      win.isMinimized = false;
      focusWindow(id);
    }

    function toggleMaximize(id) {
      const win = windows.find(w => w.id === id);
      if (!win) return;
      if (win.isMaximized) {
        const prev = win.prevBounds || { x: 80, y: 60, width: 720, height: 480 };
        win.x = prev.x;
        win.y = prev.y;
        win.width = prev.width;
        win.height = prev.height;
        win.isMaximized = false;
      } else {
        win.prevBounds = { x: win.x, y: win.y, width: win.width, height: win.height };
        win.x = 0;
        win.y = 0;
        win.width = window.innerWidth;
        win.height = window.innerHeight - 48;
        win.isMaximized = true;
      }
      focusWindow(id);
    }

    function toggleStartMenu() {
      isStartOpen = !isStartOpen;
      const menu = document.getElementById('start-menu');
      if (menu) menu.style.display = isStartOpen ? 'block' : 'none';
    }

    function filterStartMenu(query) {
      const q = query.toLowerCase();
      const items = document.querySelectorAll('.oview-start-app-item');
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? 'flex' : 'none';
      });
    }

    function renderWindows() {
      const layer = document.getElementById('window-layer');
      if (!layer) return;
      layer.innerHTML = '';

      windows.forEach(win => {
        if (win.isMinimized) return;

        const el = document.createElement('div');
        el.className = 'oview-window ' + (win.isFocused ? 'focused' : '');
        el.id = 'window-' + win.id;
        el.style.left = win.x + 'px';
        el.style.top = win.y + 'px';
        el.style.width = win.width + 'px';
        el.style.height = win.height + 'px';
        el.style.zIndex = win.zIndex;
        el.style.pointerEvents = 'auto';

        el.addEventListener('mousedown', () => focusWindow(win.id));

        const bodyHTML = (APP_RENDERERS[win.appId] ? APP_RENDERERS[win.appId](win.id) : '<p>Native Oview OS Application</p>');

        el.innerHTML = \`
          <div class="oview-window-titlebar" id="titlebar-\${win.id}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">\${win.icon}</span>
              <span style="font-size: 13px; font-weight: 600; color: \${win.isFocused ? '#f8fafc' : '#94a3b8'};">\${win.title}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="oview-window-ctrl" onclick="event.stopPropagation(); toggleMinimize('\${win.id}')">─</button>
              <button class="oview-window-ctrl" onclick="event.stopPropagation(); toggleMaximize('\${win.id}')">\${win.isMaximized ? '❐' : '□'}</button>
              <button class="oview-window-ctrl close" onclick="event.stopPropagation(); closeWindow('\${win.id}')">✕</button>
            </div>
          </div>
          <div style="flex: 1; overflow: hidden; background: rgba(10, 15, 26, 0.7); display: flex; flex-direction: column;">
            \${bodyHTML}
          </div>
        \`;

        // Attach Dragging
        const titlebar = el.querySelector('#titlebar-' + win.id);
        if (titlebar) {
          titlebar.addEventListener('mousedown', (e) => {
            if (e.target.tagName.toLowerCase() === 'button') return;
            focusWindow(win.id);
            if (win.isMaximized) return;

            let startX = e.clientX;
            let startY = e.clientY;
            let initialX = win.x;
            let initialY = win.y;

            let currentSnapZone = 'none';

            function onMouseMove(ev) {
              const dx = ev.clientX - startX;
              const dy = ev.clientY - startY;
              win.x = Math.max(-win.width + 100, Math.min(initialX + dx, window.innerWidth - 100));
              win.y = Math.max(0, Math.min(initialY + dy, window.innerHeight - 48 - 40));
              el.style.left = win.x + 'px';
              el.style.top = win.y + 'px';

              // Aero Snap 2.0 Quadrant & Edge Snapping
              const screenW = window.innerWidth;
              const screenH = window.innerHeight;
              const usableH = screenH - 48;
              const halfW = Math.floor(screenW / 2);
              const halfH = Math.floor(usableH / 2);

              currentSnapZone = 'none';
              if (ev.clientX <= 36 && ev.clientY <= 36) {
                currentSnapZone = 'top-left';
                showSnapGhost(0, 0, halfW, halfH);
              } else if (ev.clientX >= screenW - 36 && ev.clientY <= 36) {
                currentSnapZone = 'top-right';
                showSnapGhost(halfW, 0, halfW, halfH);
              } else if (ev.clientX <= 36 && ev.clientY >= usableH - 36) {
                currentSnapZone = 'bottom-left';
                showSnapGhost(0, halfH, halfW, halfH);
              } else if (ev.clientX >= screenW - 36 && ev.clientY >= usableH - 36) {
                currentSnapZone = 'bottom-right';
                showSnapGhost(halfW, halfH, halfW, halfH);
              } else if (ev.clientY <= 24) {
                currentSnapZone = 'maximize';
                showSnapGhost(0, 0, screenW, usableH);
              } else if (ev.clientX <= 24) {
                currentSnapZone = 'left-half';
                showSnapGhost(0, 0, halfW, usableH);
              } else if (ev.clientX >= screenW - 24) {
                currentSnapZone = 'right-half';
                showSnapGhost(halfW, 0, halfW, usableH);
              } else {
                hideSnapGhost();
              }
            }

            function onMouseUp() {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
              hideSnapGhost();

              const screenW = window.innerWidth;
              const usableH = window.innerHeight - 48;
              const halfW = Math.floor(screenW / 2);
              const halfH = Math.floor(usableH / 2);

              if (currentSnapZone === 'maximize') {
                win.x = 0; win.y = 0; win.width = screenW; win.height = usableH;
                win.isMaximized = true;
                showToast('Aero Snap', 'Window Maximized', 'info');
              } else if (currentSnapZone === 'left-half') {
                win.x = 0; win.y = 0; win.width = halfW; win.height = usableH;
                win.isMaximized = false;
                showToast('Aero Snap', 'Snapped Left Half (50%)', 'info');
              } else if (currentSnapZone === 'right-half') {
                win.x = halfW; win.y = 0; win.width = halfW; win.height = usableH;
                win.isMaximized = false;
                showToast('Aero Snap', 'Snapped Right Half (50%)', 'info');
              } else if (currentSnapZone === 'top-left') {
                win.x = 0; win.y = 0; win.width = halfW; win.height = halfH;
                win.isMaximized = false;
                showToast('Aero Snap', 'Snapped Top-Left Quadrant (25%)', 'info');
              } else if (currentSnapZone === 'top-right') {
                win.x = halfW; win.y = 0; win.width = halfW; win.height = halfH;
                win.isMaximized = false;
                showToast('Aero Snap', 'Snapped Top-Right Quadrant (25%)', 'info');
              } else if (currentSnapZone === 'bottom-left') {
                win.x = 0; win.y = halfH; win.width = halfW; win.height = halfH;
                win.isMaximized = false;
                showToast('Aero Snap', 'Snapped Bottom-Left Quadrant (25%)', 'info');
              } else if (currentSnapZone === 'bottom-right') {
                win.x = halfW; win.y = halfH; win.width = halfW; win.height = halfH;
                win.isMaximized = false;
                showToast('Aero Snap', 'Snapped Bottom-Right Quadrant (25%)', 'info');
              }
              renderWindows();
            }

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          });
        }

        layer.appendChild(el);
      });
    }

    function renderTaskbar() {
      const container = document.getElementById('taskbar-tabs');
      if (!container) return;
      container.innerHTML = '';

      windows.forEach(win => {
        const tab = document.createElement('div');
        tab.className = 'oview-taskbar-tab ' + (win.isFocused && !win.isMinimized ? 'active' : '');
        tab.onclick = () => toggleMinimize(win.id);
        tab.innerHTML = \`
          <span>\${win.icon}</span>
          <span style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${win.title}</span>
        \`;
        container.appendChild(tab);
      });
    }

    function updateClock() {
      const clock = document.getElementById('digital-clock');
      if (!clock) return;
      const d = new Date();
      clock.textContent = String(d.getHours()).padStart(2, '0') + ':' +
                          String(d.getMinutes()).padStart(2, '0') + ':' +
                          String(d.getSeconds()).padStart(2, '0');
    }

    function restartOS() {
      alert('[Oview OS] Restarting Sovereign Substrate...');
      location.reload();
    }

    function shutdownOS() {
      document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;background:#000;color:#10b981;font-size:24px;font-family:monospace;">Oview OS Power Down Complete. System is safe.</div>';
    }

    let isSpotlightOpen = false;
    let spotlightResultsList = [];

    function toggleSpotlight() {
      isSpotlightOpen = !isSpotlightOpen;
      const overlay = document.getElementById('spotlight-overlay');
      if (overlay) {
        overlay.style.display = isSpotlightOpen ? 'flex' : 'none';
        if (isSpotlightOpen) {
          const inp = document.getElementById('spotlight-input');
          if (inp) {
            inp.value = '';
            inp.focus();
            onSpotlightSearch('');
          }
        }
      }
    }

    function onSpotlightSearch(query) {
      const q = query.trim().toLowerCase();
      const container = document.getElementById('spotlight-results');
      if (!container) return;
      spotlightResultsList = [];

      // 1. Apps
      APP_REGISTRY.forEach(app => {
        if (!q || app.name.toLowerCase().includes(q) || app.description.toLowerCase().includes(q)) {
          spotlightResultsList.push({
            icon: app.icon,
            title: app.name,
            sub: 'Application • ' + app.description,
            cat: 'app',
            action: () => { launchApp(app.id); toggleSpotlight(); }
          });
        }
      });

      // 2. VFS Files
      if (q) {
        Object.entries(CLIENT_VFS).forEach(([vPath, node]) => {
          const name = vPath.split('/').pop();
          if (name.toLowerCase().includes(q) || vPath.toLowerCase().includes(q)) {
            spotlightResultsList.push({
              icon: node.type === 'dir' ? '📁' : '📄',
              title: name,
              sub: 'VFS File • ' + vPath,
              cat: 'file',
              action: () => { notepadActivePath = vPath; launchApp('oview.notepad'); toggleSpotlight(); }
            });
          }
        });
      }

      // 3. Actions
      if (!q || q.includes('neon') || q.includes('theme')) {
        spotlightResultsList.push({
          icon: '🎨',
          title: 'Switch to Neon Matrix Theme',
          sub: 'System Action • Red/Cyberpunk Styling',
          cat: 'action',
          action: () => { applyTheme('neon-matrix'); toggleSpotlight(); }
        });
      }
      if (!q || q.includes('close') || q.includes('window')) {
        spotlightResultsList.push({
          icon: '✕',
          title: 'Close All Windows',
          sub: 'Window Manager • Dismiss all open app frames',
          cat: 'action',
          action: () => { windows = []; renderWindows(); renderTaskbar(); toggleSpotlight(); }
        });
      }

      // 4. ECHO-1 AI prompt
      if (q.length > 2) {
        spotlightResultsList.push({
          icon: '🤖',
          title: 'Ask ECHO-1 AI: "' + query + '"',
          sub: '100% Offline Local Neural Reasoning (4ms latency)',
          cat: 'ai',
          action: () => { launchApp('oview.spotlight'); toggleSpotlight(); }
        });
      }

      container.innerHTML = spotlightResultsList.map((item, idx) => \`
        <div onclick="spotlightResultsList[\${idx}].action()" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 10px; cursor: pointer; transition: all 0.15s; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 20px;">\${item.icon}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 600; color: #f8fafc;">\${item.title}</span>
              <span style="font-size: 11px; color: #94a3b8;">\${item.sub}</span>
            </div>
          </div>
          <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3);">\${item.cat}</span>
        </div>
      \`).join('');
    }

    function executeFirstSpotlight() {
      if (spotlightResultsList.length > 0) {
        spotlightResultsList[0].action();
      }
    }

    // ──────────────── TOAST NOTIFICATION ENGINE ────────────────
    function showToast(title, message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const id = 'toast_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️';
      const borderCol = type === 'success' ? 'rgba(16, 185, 129, 0.4)' : type === 'warning' ? 'rgba(245, 158, 11, 0.4)' : type === 'error' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(56, 189, 248, 0.4)';
      const accentBg = type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : type === 'error' ? '#f43f5e' : '#38bdf8';

      const toast = document.createElement('div');
      toast.id = id;
      toast.style.cssText = \`
        pointer-events: auto;
        min-width: 280px;
        max-width: 360px;
        background: rgba(18, 25, 41, 0.94);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid \${borderCol};
        border-left: 4px solid \${accentBg};
        border-radius: 10px;
        padding: 12px 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        display: flex;
        align-items: flex-start;
        gap: 10px;
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        animation: toastSlideIn 0.25s ease-out;
        transition: opacity 0.3s ease, transform 0.3s ease;
      \`;

      toast.innerHTML = \`
        <span style="font-size: 16px; margin-top: 1px;">\${icon}</span>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 12px; font-weight: 700; color: #f8fafc; margin-bottom: 2px;">\${title}</div>
          <div style="font-size: 11px; color: #cbd5e1; line-height: 1.4; word-break: break-word;">\${message}</div>
        </div>
        <button onclick="dismissToast('\${id}')" style="background: transparent; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 0 2px; line-height: 1;">×</button>
      \`;

      container.appendChild(toast);

      setTimeout(() => {
        dismissToast(id);
      }, 4500);
    }

    function dismissToast(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }

    // ──────────────── CONTROL CENTER SUBSYSTEM ────────────────
    let ccVolume = 80;
    let ccBrightness = 100;
    let isCcMeshOn = true;
    let isCcDndOn = false;

    function toggleControlCenter() {
      const panel = document.getElementById('control-center-panel');
      if (!panel) return;
      const isOpen = panel.style.display === 'block';
      panel.style.display = isOpen ? 'none' : 'block';
      if (!isOpen && isStartOpen) toggleStartMenu();
      hideContextMenu();
    }

    function setCcVolume(val) {
      ccVolume = parseInt(val, 10);
      const txt = document.getElementById('cc-vol-txt');
      if (txt) txt.innerText = ccVolume + '%';
    }

    function setCcBrightness(val) {
      ccBrightness = parseInt(val, 10);
      const txt = document.getElementById('cc-bright-txt');
      if (txt) txt.innerText = ccBrightness + '%';
      const root = document.getElementById('oview-root');
      if (root) {
        root.style.filter = 'brightness(' + (ccBrightness / 100) + ')';
      }
    }

    function toggleCcMesh() {
      isCcMeshOn = !isCcMeshOn;
      const btn = document.getElementById('cc-mesh-btn');
      if (btn) {
        if (isCcMeshOn) {
          btn.style.background = 'rgba(16, 185, 129, 0.2)';
          btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          btn.style.color = '#6ee7b7';
          btn.innerHTML = '<span style="font-size: 16px;">📶</span> <span>Mesh: ON</span>';
        } else {
          btn.style.background = 'rgba(255, 255, 255, 0.05)';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          btn.style.color = '#94a3b8';
          btn.innerHTML = '<span style="font-size: 16px;">📶</span> <span>Mesh: OFF</span>';
        }
      }
      showToast('Sovereign Mesh', isCcMeshOn ? 'P2P Sovereign Mesh Connected' : 'Mesh Radios Suspended', 'info');
    }

    function toggleCcFocus() {
      isCcDndOn = !isCcDndOn;
      const btn = document.getElementById('cc-focus-btn');
      const badge = document.getElementById('cc-dnd-badge');
      if (btn) {
        if (isCcDndOn) {
          btn.style.background = 'rgba(168, 85, 247, 0.2)';
          btn.style.borderColor = 'rgba(168, 85, 247, 0.4)';
          btn.style.color = '#c084fc';
          btn.innerHTML = '<span style="font-size: 16px;">🌙</span> <span>Focus: ON</span>';
        } else {
          btn.style.background = 'rgba(255, 255, 255, 0.05)';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          btn.style.color = '#cbd5e1';
          btn.innerHTML = '<span style="font-size: 16px;">🌙</span> <span>Focus: OFF</span>';
        }
      }
      if (badge) {
        if (isCcDndOn) {
          badge.innerText = 'FOCUS ACTIVE';
          badge.style.background = 'rgba(168, 85, 247, 0.2)';
          badge.style.color = '#c084fc';
        } else {
          badge.innerText = 'SOVEREIGN MESH';
          badge.style.background = 'rgba(16, 185, 129, 0.2)';
          badge.style.color = '#10b981';
        }
      }
      showToast('Focus Assistant', isCcDndOn ? 'Do Not Disturb Enabled' : 'Do Not Disturb Disabled', 'info');
    }

    // ──────────────── CONTEXT MENU SUBSYSTEM ────────────────
    function showContextMenu(x, y) {
      const menu = document.getElementById('desktop-context-menu');
      if (!menu) return;
      const maxX = window.innerWidth - 220;
      const maxY = window.innerHeight - 260;
      menu.style.left = Math.min(x, maxX) + 'px';
      menu.style.top = Math.min(y, maxY) + 'px';
      menu.style.display = 'block';
    }

    function hideContextMenu() {
      const menu = document.getElementById('desktop-context-menu');
      if (menu) menu.style.display = 'none';
    }

    function contextRefresh() {
      hideContextMenu();
      showToast('Desktop', 'Refreshed desktop environment', 'info');
      renderWindows();
      renderTaskbar();
    }

    function contextNewNote() {
      hideContextMenu();
      const id = Date.now().toString().slice(-4);
      const vPath = '/user/desktop/note_' + id + '.txt';
      CLIENT_VFS[vPath] = {
        type: 'file',
        content: '// Sovereign Desktop Note #' + id + '\\nCreated via Context Menu at ' + new Date().toLocaleTimeString() + '\\n'
      };
      showToast('New Document', 'Created note_' + id + '.txt on Desktop', 'success');
      notepadActivePath = vPath;
      launchApp('oview.notepad');
    }

    function contextNewFolder() {
      hideContextMenu();
      const id = Date.now().toString().slice(-4);
      const vPath = '/user/desktop/Folder_' + id;
      CLIENT_VFS[vPath] = {
        type: 'dir'
      };
      showToast('New Folder', 'Created Folder_' + id + ' on Desktop', 'success');
      explorerCurrentDir = '/user/desktop';
      launchApp('oview.explorer');
    }

    let currentThemeIdx = 0;
    const THEMES = ['cyber-glass', 'deep-space', 'neon-matrix'];
    function contextChangeTheme() {
      hideContextMenu();
      currentThemeIdx = (currentThemeIdx + 1) % THEMES.length;
      applyTheme(THEMES[currentThemeIdx]);
      showToast('Theme Changed', 'Switched to ' + THEMES[currentThemeIdx], 'info');
    }

    // ──────────────── SHOW DESKTOP (WIN+D) ────────────────
    let desktopPreviousStates = null;

    function toggleShowDesktop() {
      const anyVisible = windows.some(w => !w.isMinimized);
      if (anyVisible) {
        desktopPreviousStates = windows.map(w => ({ id: w.id, isMinimized: w.isMinimized }));
        windows.forEach(w => {
          w.isMinimized = true;
          w.isFocused = false;
        });
        activeWindowId = null;
        showToast('Desktop', 'All windows minimized (Show Desktop)', 'info');
      } else {
        if (desktopPreviousStates && desktopPreviousStates.length > 0) {
          desktopPreviousStates.forEach(prev => {
            const w = windows.find(win => win.id === prev.id);
            if (w) w.isMinimized = prev.isMinimized;
          });
          desktopPreviousStates = null;
        } else {
          windows.forEach(w => w.isMinimized = false);
        }
        const visible = windows.filter(w => !w.isMinimized);
        if (visible.length > 0) {
          visible.sort((a, b) => b.zIndex - a.zIndex);
          visible[0].isFocused = true;
          activeWindowId = visible[0].id;
        }
        showToast('Desktop', 'Windows restored', 'info');
      }
      renderWindows();
      renderTaskbar();
    }

    // ──────────────── AERO SNAP 2.0 GHOST PREVIEW ────────────────
    function showSnapGhost(x, y, w, h) {
      const g = document.getElementById('snap-preview-ghost');
      if (!g) return;
      g.style.left = x + 'px';
      g.style.top = y + 'px';
      g.style.width = w + 'px';
      g.style.height = h + 'px';
      g.style.display = 'block';
    }

    function hideSnapGhost() {
      const g = document.getElementById('snap-preview-ghost');
      if (g) g.style.display = 'none';
    }

    // ──────────────── ALT + TAB VISUAL WINDOW SWITCHER ────────────────
    let isAltTabVisible = false;
    let altTabSelectedIndex = 0;

    function openAltTabSwitcher() {
      if (windows.length === 0) return;
      isAltTabVisible = true;
      altTabSelectedIndex = windows.length > 1 ? 1 : 0;
      renderAltTabCards();
      const el = document.getElementById('alt-tab-switcher');
      if (el) el.style.display = 'flex';
    }

    function cycleAltTab(dir = 1) {
      if (!isAltTabVisible || windows.length === 0) return;
      altTabSelectedIndex = (altTabSelectedIndex + dir + windows.length) % windows.length;
      renderAltTabCards();
    }

    function closeAltTabSwitcher() {
      if (!isAltTabVisible) return;
      isAltTabVisible = false;
      const el = document.getElementById('alt-tab-switcher');
      if (el) el.style.display = 'none';
      if (windows[altTabSelectedIndex]) {
        focusWindow(windows[altTabSelectedIndex].id);
        if (windows[altTabSelectedIndex].isMinimized) {
          unminimizeWindow(windows[altTabSelectedIndex].id);
        }
      }
    }

    function renderAltTabCards() {
      const container = document.getElementById('alt-tab-cards');
      if (!container) return;
      container.innerHTML = windows.map((w, idx) => \`
        <div onclick="focusWindow('\${w.id}'); closeAltTabSwitcher();" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 110px; height: 100px; border-radius: 12px; cursor: pointer; transition: all 0.15s; background: \${idx === altTabSelectedIndex ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255,255,255,0.04)'}; border: 2px solid \${idx === altTabSelectedIndex ? '#10b981' : 'rgba(255,255,255,0.08)'}; box-shadow: \${idx === altTabSelectedIndex ? '0 0 16px rgba(16,185,129,0.35)' : 'none'};">
          <span style="font-size: 32px; margin-bottom: 6px;">\${w.icon}</span>
          <span style="font-size: 11px; font-weight: 600; color: #f8fafc; text-align: center; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${w.title}</span>
        </div>
      \`).join('');
    }

    // ──────────────── UNIVERSAL CLIPBOARD HISTORY (WIN + V) ────────────────
    let clipboardHistoryList = [
      { id: 'clip_1', text: 'Address369 Spatial Memory Slot Invariant E9001', pinned: true },
      { id: 'clip_2', text: 'print "Hello Sovereign Computing!";', pinned: false },
      { id: 'clip_3', text: '204.8M ops/sec Qplayer VM Target', pinned: false }
    ];

    function toggleClipboardHistory() {
      const panel = document.getElementById('clipboard-panel');
      if (!panel) return;
      const isOpen = panel.style.display === 'block';
      panel.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        renderClipboardItems();
        if (isStartOpen) toggleStartMenu();
        const cc = document.getElementById('control-center-panel');
        if (cc) cc.style.display = 'none';
      }
    }

    function renderClipboardItems() {
      const list = document.getElementById('clipboard-items-list');
      if (!list) return;
      if (clipboardHistoryList.length === 0) {
        list.innerHTML = '<div style="color: #64748b; font-size: 12px; text-align: center; padding: 24px;">Clipboard is empty. Copy text anywhere to store here.</div>';
        return;
      }
      list.innerHTML = clipboardHistoryList.map((item, idx) => \`
        <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div onclick="pasteClipboardSnippet('\${item.id}')" style="flex: 1; cursor: pointer;">
            <div style="font-size: 12px; color: #f8fafc; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 210px;">\${item.text}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Click to Copy / Paste</div>
          </div>
          <button onclick="togglePinClipboard('\${item.id}')" style="background: transparent; border: none; font-size: 12px; cursor: pointer; color: \${item.pinned ? '#10b981' : '#64748b'};">\${item.pinned ? '📌' : '📍'}</button>
        </div>
      \`).join('');
    }

    function pasteClipboardSnippet(id) {
      const item = clipboardHistoryList.find(i => i.id === id);
      if (!item) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(item.text).catch(() => {});
      }
      showToast('Clipboard History', 'Copied: "' + item.text.slice(0, 24) + '..."', 'success');
      toggleClipboardHistory();
    }

    function togglePinClipboard(id) {
      const item = clipboardHistoryList.find(i => i.id === id);
      if (item) item.pinned = !item.pinned;
      renderClipboardItems();
    }

    function clearClipboardHistory() {
      clipboardHistoryList = clipboardHistoryList.filter(i => i.pinned);
      renderClipboardItems();
      showToast('Clipboard History', 'Cleared unpinned clipboard items', 'info');
    }

    // Global Keyboard Shortcuts (Ctrl+Space for ECHO-1 Spotlight, Win+D for Show Desktop, Alt+Tab, Win+V / Alt+V for Clipboard)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        toggleSpotlight();
      } else if ((e.ctrlKey || e.metaKey || e.altKey) && e.code === 'KeyD') {
        e.preventDefault();
        toggleShowDesktop();
      } else if ((e.ctrlKey || e.metaKey || e.altKey) && e.code === 'KeyV') {
        e.preventDefault();
        toggleClipboardHistory();
      } else if (e.altKey && e.code === 'Tab') {
        e.preventDefault();
        if (!isAltTabVisible) {
          openAltTabSwitcher();
        } else {
          cycleAltTab(e.shiftKey ? -1 : 1);
        }
      } else if (e.key === 'Escape') {
        hideContextMenu();
        closeAltTabSwitcher();
        const cc = document.getElementById('control-center-panel');
        if (cc && cc.style.display === 'block') cc.style.display = 'none';
        const clip = document.getElementById('clipboard-panel');
        if (clip && clip.style.display === 'block') clip.style.display = 'none';
        if (isSpotlightOpen) toggleSpotlight();
        else if (isStartOpen) toggleStartMenu();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Alt' && isAltTabVisible) {
        closeAltTabSwitcher();
      }
    });

    // Desktop Right-Click Context Menu Listener
    document.getElementById('oview-root').addEventListener('contextmenu', (e) => {
      if (e.target.closest('.oview-window') || e.target.closest('#oview-taskbar') || e.target.closest('#control-center-panel') || e.target.closest('#clipboard-panel')) {
        return;
      }
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });

    // Dismiss context menu, control center, and clipboard when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#desktop-context-menu')) {
        hideContextMenu();
      }
      if (!e.target.closest('#control-center-panel') && !e.target.closest('#tray-control-btn')) {
        const cc = document.getElementById('control-center-panel');
        if (cc && cc.style.display === 'block') {
          cc.style.display = 'none';
        }
      }
      if (!e.target.closest('#clipboard-panel') && !e.target.closest('#tray-clip-btn')) {
        const clip = document.getElementById('clipboard-panel');
        if (clip && clip.style.display === 'block') {
          clip.style.display = 'none';
        }
      }
    });

    // Close Spotlight on overlay click
    document.getElementById('spotlight-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'spotlight-overlay') toggleSpotlight();
    });

    // Close Start Menu on canvas click
    document.getElementById('oview-canvas').addEventListener('click', () => {
      if (isStartOpen) toggleStartMenu();
    });

    // Initialize clock and default apps
    setInterval(updateClock, 1000);
    updateClock();

    // Auto-launch Oview Notepad on first boot
    launchApp('oview.notepad');

    // Welcome Toast Notification
    setTimeout(() => {
      showToast('Oview OS v1.3.0 Live', '22 Native Apps Loaded • Click any icon or Start to explore', 'success');
    }, 600);
  </script>
</body>
</html>`;
  }

  /**
   * Compiles and writes standalone bundle to disk.
   */
  public static bundleToFile(outputPath: string, options: OviewBundleOptions = {}): string {
    const html = this.bundle(options);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, html, 'utf-8');
    return outputPath;
  }
}
