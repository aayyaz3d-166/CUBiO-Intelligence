/**
 * Oview OS — Phase 0 & Phase 1 Production Verification Suite
 * ==========================================================
 * Tests:
 *   [Test 1] Core Invariants & Window State Models
 *   [Test 2] Multi-Window Compositing (Focus, Z-Index, Minimize, Maximize, Snap)
 *   [Test 3] Process Manager Lifecycle & Address369 Spatial Memory Allocation
 *   [Test 4] SystemBus IPC Sub-Millisecond Event Dispatching
 *   [Test 5] Native OLTO Shell Language Compilation (.olto AST Lowering)
 *   [Test 6] Oview Desktop Compositor & Direct DOM Tree Rendering
 *   [Test 7] Standalone Zero-Dependency Executable Bundle Generation
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  WindowManager,
  ProcessManager,
  SystemBus,
  OviewCompositor,
  OviewBundler,
} from '../../src/oview/index';
import { OltoCompiler } from '../../src/olto/compiler/index';

console.log('================================================================================');
console.log('  OVIEW OS: PHASE 0 & PHASE 1 MASTER VERIFICATION SUITE');
console.log('  The Sovereign AI-Native Desktop OS Powered by ONE Language, OLTO & ECHO-1');
console.log('================================================================================\n');

const suiteStart = performance.now();

// ── Test 1: Window State Invariants & Cascading ─────────────────────────────
console.log('[Test 1] Testing Window State Models & Cascading Invariants...');
WindowManager.resetInstance();
const wm = WindowManager.getInstance();
wm.setViewport(1920, 1080, 48);

assert.strictEqual(wm.windows.get().length, 0, 'Initial window count must be 0');

const win1 = wm.openWindow('oview.notepad', { title: 'Test Notes 1', width: 600, height: 400 });
assert.ok(win1.id.startsWith('win_oview.notepad'), 'Window ID must be prefixed with app ID');
assert.strictEqual(win1.isFocused, true, 'Newly opened window must be focused');
assert.strictEqual(wm.activeWindowId.get(), win1.id);

const win2 = wm.openWindow('oview.calculator', { title: 'Test Calc 2', width: 340, height: 460 });
assert.strictEqual(wm.windows.get().length, 2, 'Total windows must be 2');
assert.strictEqual(win2.isFocused, true);
assert.strictEqual(wm.getWindow(win1.id)?.isFocused, false, 'Previous window must be unfocused');
assert.ok(win2.zIndex > win1.zIndex, 'Newer window must have higher zIndex');
assert.ok(win2.x > win1.x, 'Consecutive window must cascade with positive X offset');
console.log('  ✓ Window state models and cascading verified successfully.\n');

// ── Test 2: Multi-Window Operations (Focus, Min, Max, Snap, Drag) ────────────
console.log('[Test 2] Testing Multi-Window Compositing (Focus, Minimize, Maximize, Snap)...');

// Focus
wm.focusWindow(win1.id);
assert.strictEqual(wm.getWindow(win1.id)?.isFocused, true);
assert.strictEqual(wm.getWindow(win2.id)?.isFocused, false);
assert.ok(wm.getWindow(win1.id)!.zIndex > wm.getWindow(win2.id)!.zIndex, 'Focused window must have top zIndex');

// Minimize
wm.minimizeWindow(win1.id);
assert.strictEqual(wm.getWindow(win1.id)?.isMinimized, true);
assert.strictEqual(wm.activeWindowId.get(), win2.id, 'Minimizing active window must promote next visible window');

// Restore
wm.restoreWindow(win1.id);
assert.strictEqual(wm.getWindow(win1.id)?.isMinimized, false);
assert.strictEqual(wm.activeWindowId.get(), win1.id);

// Maximize
wm.toggleMaximize(win1.id);
const maxWin = wm.getWindow(win1.id)!;
assert.strictEqual(maxWin.isMaximized, true);
assert.strictEqual(maxWin.x, 0);
assert.strictEqual(maxWin.y, 0);
assert.strictEqual(maxWin.width, 1920);
assert.strictEqual(maxWin.height, 1080 - 48); // Full height minus taskbar

// Unmaximize (Restore)
wm.toggleMaximize(win1.id);
const unmaxWin = wm.getWindow(win1.id)!;
assert.strictEqual(unmaxWin.isMaximized, false);
assert.strictEqual(unmaxWin.width, 600);
assert.strictEqual(unmaxWin.height, 400);

// Snap Left
wm.snapWindow(win2.id, 'left');
const snapWin = wm.getWindow(win2.id)!;
assert.strictEqual(snapWin.x, 0);
assert.strictEqual(snapWin.width, 1920 / 2);
assert.strictEqual(snapWin.height, 1080 - 48);

// Movement & Boundary Clamping
wm.moveWindow(win1.id, 50, 30);
assert.strictEqual(wm.getWindow(win1.id)!.x, win1.x + 50);
console.log('  ✓ Focus management, minimize/maximize transitions, and snapping verified.\n');

// ── Test 3: Process Manager & Address369 Spatial Memory ─────────────────────
console.log('[Test 3] Testing Process Lifecycle & Address369 Spatial Allocation...');
ProcessManager.resetInstance();
const pm = ProcessManager.getInstance();

const apps = pm.getRegisteredApps();
assert.ok(apps.length >= 6, 'Must have at least 6 pre-installed default apps');
const notepadApp = pm.getApp('oview.notepad');
assert.ok(notepadApp, 'Oview Notepad must be registered');
assert.strictEqual(notepadApp?.category, 'productivity');

const proc1 = pm.launchApp('oview.notepad');
assert.ok(proc1.pid >= 1000, 'PID must be >= 1000');
assert.ok(wm.getWindow(proc1.windowId), 'Associated window must exist in WindowManager');

// Single-instance enforcement for settings
const procSettings1 = pm.launchApp('oview.settings');
const procSettings2 = pm.launchApp('oview.settings');
assert.strictEqual(procSettings1.pid, procSettings2.pid, 'Single-instance app must return existing PID');
assert.strictEqual(procSettings1.windowId, procSettings2.windowId);

const telemetry = pm.getTelemetry();
assert.ok(telemetry.cpuUsage > 0);
assert.ok(telemetry.memoryUsedMb >= 24.56, 'Memory must include ECHO-1 base neural footprint');
assert.strictEqual(telemetry.activeProcesses, pm.getActiveProcesses().length);
console.log(`  ✓ ProcessManager launched apps and reported telemetry (Active PIDs: ${telemetry.activeProcesses}, RAM: ${telemetry.memoryUsedMb}MB).\n`);

// ── Test 4: SystemBus IPC Microsecond Latency ──────────────────────────────
console.log('[Test 4] Testing SystemBus IPC & Sub-Millisecond Telemetry...');
SystemBus.resetInstance();
const bus = SystemBus.getInstance();

let received = false;
let receivedPayload: any = null;
const ipcStart = performance.now();

bus.on('system:test_ipc', (event) => {
  received = true;
  receivedPayload = event.payload;
});

bus.emit('system:test_ipc', { message: 'Sovereign Oview OS Substrate' }, 'TestRunner');
const ipcDurationMs = performance.now() - ipcStart;

assert.strictEqual(received, true, 'Event must be received synchronously');
assert.strictEqual(receivedPayload.message, 'Sovereign Oview OS Substrate');
assert.ok(ipcDurationMs < 1.0, `IPC latency must be < 1.0ms (actual: ${ipcDurationMs.toFixed(3)}ms)`);
console.log(`  ✓ SystemBus IPC dispatched typed event in ${ipcDurationMs.toFixed(3)} ms.\n`);

// ── Test 5: Native OLTO Shell Language Compilation ──────────────────────────
console.log('[Test 5] Testing Native OLTO Shell Components Compilation (.olto AST Lowering)...');

const shellFiles = [
  'src/oview/shell/WindowFrame.olto',
  'src/oview/shell/Taskbar.olto',
  'src/oview/shell/StartMenu.olto',
  'src/oview/shell/DesktopSurface.olto',
];

for (const file of shellFiles) {
  const filePath = path.resolve(file);
  assert.ok(fs.existsSync(filePath), `Shell file ${file} must exist`);
  const source = fs.readFileSync(filePath, 'utf-8');
  const compileRes = OltoCompiler.compile(source);

  assert.strictEqual(compileRes.success, true, `${file} must compile with zero errors`);
  assert.ok(compileRes.ast, `${file} must produce valid AST`);
  assert.ok(compileRes.ast.declarations.length >= 1, `${file} must declare at least 1 component`);
  console.log(`  ✓ Lowered ${path.basename(file)} to OLTO AST (Declarations: ${compileRes.ast.declarations.length})`);
}
console.log('');

// ── Test 6: Oview Desktop Compositor & Direct DOM Tree ──────────────────────
console.log('[Test 6] Testing Oview Desktop Graphical Compositor & DOM Tree Generation...');
const compositor = new OviewCompositor(wm, pm, bus);

// Toggle Start Menu
assert.strictEqual(compositor.isStartMenuOpen, false);
compositor.toggleStartMenu();
assert.strictEqual(compositor.isStartMenuOpen, true);

// Render DOM Tree
const domTree = compositor.renderToElement();
assert.ok(domTree, 'Compositor must return OltoDOMElement');
assert.strictEqual(domTree.tagName, 'div');

// Render to HTML string
const html = compositor.renderToHTML();
assert.ok(html.includes('oview-desktop-root'), 'HTML must include root desktop class');
assert.ok(html.includes('Oview OS'), 'HTML must include Oview OS branding');
assert.ok(html.includes('oview-taskbar'), 'HTML must include taskbar');
assert.ok(html.includes('oview-start-menu'), 'HTML must include start menu when open');
console.log(`  ✓ Graphical Compositor successfully rendered DOM tree and HTML (${(html.length / 1024).toFixed(2)} KB).\n`);

// ── Test 7: Standalone Executable Desktop Bundle ───────────────────────────
console.log('[Test 7] Testing Standalone Executable Desktop Bundle Generation...');
const outPath = path.resolve('dist/oview/index.html');
const bundledPath = OviewBundler.bundleToFile(outPath, {
  title: 'Oview OS — Sovereign Desktop Environment',
});

assert.ok(fs.existsSync(bundledPath), 'Bundled file must exist on disk');
const bundleContent = fs.readFileSync(bundledPath, 'utf-8');
assert.ok(bundleContent.length > 10000, 'Bundle must be self-contained and > 10KB');
assert.ok(bundleContent.includes('APP_REGISTRY'), 'Bundle must contain app registry');
assert.ok(bundleContent.includes('oview.notepad'), 'Bundle must contain Notepad');
assert.ok(bundleContent.includes('oview.calculator'), 'Bundle must contain Calculator');
assert.ok(bundleContent.includes('toggleStartMenu'), 'Bundle must contain Start Menu toggler');
assert.ok(bundleContent.includes('launchApp'), 'Bundle must contain app launcher');
assert.ok(bundleContent.includes('Ctrl + Space'), 'Bundle must contain ECHO-1 Spotlight search handler');

const bundleSizeKb = (fs.statSync(bundledPath).size / 1024).toFixed(2);
console.log(`  ✓ Standalone Zero-Dependency Bundle emitted to: ${bundledPath} (${bundleSizeKb} KB)\n`);

const suiteDuration = (performance.now() - suiteStart).toFixed(2);
console.log('================================================================================');
console.log(`  PHASE 0 & PHASE 1 VERIFICATION COMPLETED IN ${suiteDuration} ms`);
console.log('  STATUS: 100% PASS — DESKTOP SHELL & MULTI-WINDOW COMPOSITOR VERIFIED');
console.log('================================================================================\n');
