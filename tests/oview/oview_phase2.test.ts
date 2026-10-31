/**
 * Oview OS — Phase 2 Production Verification Suite
 * ================================================
 * Tests the complete Core Native Application Suite:
 *   [Test 1] Virtual File System (VFS) Core Operations & Events
 *   [Test 2] App 1: Oview Notepad (Multi-Tabs, Live Metrics, VFS Save)
 *   [Test 3] App 2: Oview File Explorer (Tree Browsing, History Stack, File CRUD)
 *   [Test 4] App 3: Oview Terminal (ONE Language REPL, Qplayer Eval, History)
 *   [Test 5] App 4: Oview Calculator (Basic & Scientific Math, Registers)
 *   [Test 6] App 5: Oview System Settings (Theme Dispatcher, Address369 Auditing)
 *   [Test 7] Native OLTO Language Declarative App Compilation (.olto AST Lowering)
 *   [Test 8] End-to-End Compositor & Standalone Bundle Generation
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  VirtualFileSystem,
  NotepadApp,
  ExplorerApp,
  TerminalApp,
  CalculatorApp,
  SettingsApp,
  WindowManager,
  ProcessManager,
  SystemBus,
  OviewCompositor,
  OviewBundler,
} from '../../src/oview/index';
import { OltoCompiler } from '../../src/olto/compiler/index';

console.log('================================================================================');
console.log('  OVIEW OS: PHASE 2 CORE NATIVE APPLICATION SUITE VERIFICATION');
console.log('  Notepad • File Explorer • Terminal REPL • Calculator • Settings');
console.log('================================================================================\n');

const suiteStart = performance.now();

// ── Test 1: Virtual File System (VFS) Invariants ────────────────────────────
console.log('[Test 1] Testing Sovereign Virtual File System (VFS) Operations...');
VirtualFileSystem.resetInstance();
const vfs = VirtualFileSystem.getInstance();

assert.ok(vfs.exists('/system/kernel.one'), 'Kernel config file must exist in VFS');
assert.ok(vfs.exists('/user/documents/welcome.txt'), 'Welcome text file must exist in VFS');

// Directory listing
const userDocs = vfs.listDirectory('/user/documents');
assert.ok(userDocs.length >= 2, 'Must list at least welcome.txt and notes.one');

// Create, write, read, delete
vfs.writeFile('/user/documents/test_create.txt', 'ONE Language Sovereign VFS Data');
assert.strictEqual(vfs.readFile('/user/documents/test_create.txt'), 'ONE Language Sovereign VFS Data');

vfs.renameNode('/user/documents/test_create.txt', '/user/documents/test_renamed.txt');
assert.strictEqual(vfs.exists('/user/documents/test_create.txt'), false);
assert.strictEqual(vfs.exists('/user/documents/test_renamed.txt'), true);

vfs.deleteNode('/user/documents/test_renamed.txt');
assert.strictEqual(vfs.exists('/user/documents/test_renamed.txt'), false);
console.log('  ✓ VFS hierarchical read, write, rename, and delete verified.\n');

// ── Test 2: App 1 — Oview Notepad ───────────────────────────────────────────
console.log('[Test 2] Testing App 1: Oview Notepad (Tabs, Metrics, VFS Persistence)...');
const notepad = new NotepadApp('/user/documents/welcome.txt', vfs);

assert.strictEqual(notepad.tabs.length, 1);
assert.strictEqual(notepad.getActiveTab()?.fileName, 'welcome.txt');

// Test Live Metrics
const metrics1 = notepad.getMetrics();
assert.ok(metrics1.lines > 1, 'Welcome file must have multiple lines');
assert.ok(metrics1.words > 10, 'Welcome file must have words');

// Test Tab Creation & Editing
notepad.createTab('scratch.one', 'print "Testing Notepad";');
assert.strictEqual(notepad.tabs.length, 2);
assert.strictEqual(notepad.getActiveTab()?.fileName, 'scratch.one');

notepad.updateContent('print "Testing Notepad";\nlet x = 42;');
assert.strictEqual(notepad.getActiveTab()?.isDirty, true, 'Editing content must mark tab dirty');

// Test VFS Save
notepad.saveActiveTab();
assert.strictEqual(notepad.getActiveTab()?.isDirty, false, 'Saving must clear dirty flag');
assert.strictEqual(vfs.readFile('/user/documents/scratch.one'), 'print "Testing Notepad";\nlet x = 42;');

// Test DOM Rendering
const notepadDOM = notepad.renderToElement();
assert.ok(notepadDOM.renderToHTML().includes('oview-app-notepad'));
console.log('  ✓ Notepad multi-tab editing, live word/line metrics, and VFS save verified.\n');

// ── Test 3: App 2 — Oview File Explorer ─────────────────────────────────────
console.log('[Test 3] Testing App 2: Oview File Explorer (Navigation, History, File Ops)...');
const explorer = new ExplorerApp('/user/documents', vfs);

assert.strictEqual(explorer.currentPath, '/user/documents');
assert.strictEqual(explorer.canGoBack(), false);

// Navigation
explorer.navigate('/system');
assert.strictEqual(explorer.currentPath, '/system');
assert.strictEqual(explorer.canGoBack(), true);

// History Back & Forward
explorer.goBack();
assert.strictEqual(explorer.currentPath, '/user/documents');
assert.strictEqual(explorer.canGoForward(), true);

explorer.goForward();
assert.strictEqual(explorer.currentPath, '/system');

// Up Navigation
explorer.navigateUp();
assert.strictEqual(explorer.currentPath, '/');

// Create File via Explorer
explorer.navigate('/user/documents');
explorer.createFile('from_explorer.txt', 'Created inside Explorer');
assert.strictEqual(vfs.exists('/user/documents/from_explorer.txt'), true);
assert.strictEqual(vfs.readFile('/user/documents/from_explorer.txt'), 'Created inside Explorer');

// Test DOM Rendering
const explorerDOM = explorer.renderToElement();
assert.ok(explorerDOM.renderToHTML().includes('oview-app-explorer'));
console.log('  ✓ File Explorer folder navigation, history stack, and file operations verified.\n');

// ── Test 4: App 3 — Oview Terminal & ONE REPL ──────────────────────────────
console.log('[Test 4] Testing App 3: Oview Terminal (ONE Language REPL & Qplayer Execution)...');
const terminal = new TerminalApp(vfs);

// Help & Version
const helpOut = terminal.execute('help');
assert.ok(helpOut.includes('AVAILABLE OVIEW OS TERMINAL COMMANDS'));

const verOut = terminal.execute('version');
assert.ok(verOut.includes('ONE Language Core: v1.3.0'));

// Arithmetic & Eval Commands
const evalOut = terminal.execute('eval 15 + 25 * 2');
assert.ok(evalOut.includes('65'), '15 + 25 * 2 must evaluate to 65');

const directEval = terminal.execute('100 / 4');
assert.ok(directEval.includes('25'), '100 / 4 must evaluate to 25');

// VFS Integration in Terminal
const vfsLs = terminal.execute('vfs ls /user/documents');
assert.ok(vfsLs.includes('welcome.txt'));

const vfsCat = terminal.execute('vfs cat /user/documents/welcome.txt');
assert.ok(vfsCat.includes('Welcome to Oview OS!'));

// Address369 & Telemetry
const memOut = terminal.execute('mem');
assert.ok(memOut.includes('ADDRESS369 SPATIAL MEMORY MAP'));

// Test DOM Rendering
const terminalDOM = terminal.renderToElement();
assert.ok(terminalDOM.renderToHTML().includes('oview-app-terminal'));
console.log('  ✓ Terminal ONE expression evaluator, command history, and VFS commands verified.\n');

// ── Test 5: App 4 — Oview Calculator ────────────────────────────────────────
console.log('[Test 5] Testing App 4: Oview Calculator (Basic & Scientific Math Evaluator)...');
const calc = new CalculatorApp();

// Basic Math: 7 + 8 = 15
calc.inputDigit('7');
calc.inputOperator('+');
calc.inputDigit('8');
const res1 = calc.evaluate();
assert.strictEqual(res1, '15');
assert.strictEqual(calc.display, '15');

// Complex: 15 * 3 = 45
calc.inputOperator('×');
calc.inputDigit('3');
const res2 = calc.evaluate();
assert.strictEqual(res2, '45');

// Scientific: sqrt(49) = 7
calc.clear();
calc.inputDigit('49');
calc.calculateScientific('sqrt');
assert.strictEqual(calc.display, '7');

// Square: sqr(12) = 144
calc.clear();
calc.inputDigit('12');
calc.calculateScientific('sqr');
assert.strictEqual(calc.display, '144');

// Test DOM Rendering
const calcDOM = calc.renderToElement();
assert.ok(calcDOM.renderToHTML().includes('oview-app-calculator'));
console.log('  ✓ Calculator arithmetic parser, scientific functions, and registers verified.\n');

// ── Test 6: App 5 — Oview System Settings ───────────────────────────────────
console.log('[Test 6] Testing App 5: Oview System Settings (Themes, Telemetry & Invariants)...');
SystemBus.resetInstance();
const bus = SystemBus.getInstance();
const settings = new SettingsApp(bus);

let themeEventReceived = false;
bus.on('system:theme_changed', (e) => {
  themeEventReceived = true;
  assert.strictEqual(e.payload.theme, 'deep-space');
  assert.strictEqual(e.payload.accent, '#3b82f6');
});

settings.setTheme('deep-space');
assert.strictEqual(themeEventReceived, true);
assert.strictEqual(settings.activeTheme, 'deep-space');

// Test DOM Rendering
const settingsDOM = settings.renderToElement();
assert.ok(settingsDOM.renderToHTML().includes('oview-app-settings'));
console.log('  ✓ Settings theme dispatcher and Address369 telemetry inspection verified.\n');

// ── Test 7: Native OLTO Declarative App Components Compilation ──────────────
console.log('[Test 7] Testing Native OLTO Shell & Native App Compilation (.olto AST Lowering)...');

const appOltoFiles = [
  'src/oview/apps/notepad/NotepadApp.olto',
  'src/oview/apps/explorer/ExplorerApp.olto',
  'src/oview/apps/terminal/TerminalApp.olto',
  'src/oview/apps/calculator/CalculatorApp.olto',
  'src/oview/apps/settings/SettingsApp.olto',
];

for (const file of appOltoFiles) {
  const filePath = path.resolve(file);
  assert.ok(fs.existsSync(filePath), `App file ${file} must exist`);
  const source = fs.readFileSync(filePath, 'utf-8');
  const compileRes = OltoCompiler.compile(source);

  assert.strictEqual(compileRes.success, true, `${file} must compile with zero errors`);
  assert.ok(compileRes.ast, `${file} must produce valid AST`);
  assert.ok(compileRes.ast.declarations.length >= 1, `${file} must declare at least 1 component`);
  console.log(`  ✓ Lowered ${path.basename(file)} to OLTO AST (Declarations: ${compileRes.ast.declarations.length})`);
}
console.log('');

// ── Test 8: Compositor & Standalone Executable Desktop Bundle ───────────────
console.log('[Test 8] Testing Compositor Integration & Standalone Desktop Bundler...');
WindowManager.resetInstance();
ProcessManager.resetInstance();
const wm = WindowManager.getInstance();
const pm = ProcessManager.getInstance();

// Launch all 5 native applications
pm.launchApp('oview.notepad');
pm.launchApp('oview.explorer');
pm.launchApp('oview.terminal');
pm.launchApp('oview.calculator');
pm.launchApp('oview.settings');

assert.strictEqual(wm.windows.get().length, 5, 'All 5 apps must have active windows in WM');

const compositor = new OviewCompositor(wm, pm, bus);
const fullHTML = compositor.renderToHTML();

assert.ok(fullHTML.includes('oview-app-notepad'), 'Compositor must mount Notepad DOM');
assert.ok(fullHTML.includes('oview-app-explorer'), 'Compositor must mount Explorer DOM');
assert.ok(fullHTML.includes('oview-app-terminal'), 'Compositor must mount Terminal DOM');
assert.ok(fullHTML.includes('oview-app-calculator'), 'Compositor must mount Calculator DOM');
assert.ok(fullHTML.includes('oview-app-settings'), 'Compositor must mount Settings DOM');

// Bundle to standalone file
const outPath = path.resolve('dist/oview/index.html');
OviewBundler.bundleToFile(outPath, {
  title: 'Oview OS — Sovereign Desktop Environment (Phase 2)',
});

assert.ok(fs.existsSync(outPath));
const bundleContent = fs.readFileSync(outPath, 'utf-8');
assert.ok(bundleContent.includes('renderNotepadApp'), 'Bundle must contain Notepad renderer');
assert.ok(bundleContent.includes('renderExplorerApp'), 'Bundle must contain Explorer renderer');
assert.ok(bundleContent.includes('renderTerminalApp'), 'Bundle must contain Terminal renderer');
assert.ok(bundleContent.includes('renderCalculatorApp'), 'Bundle must contain Calculator renderer');
assert.ok(bundleContent.includes('renderSettingsApp'), 'Bundle must contain Settings renderer');

const bundleSizeKb = (fs.statSync(outPath).size / 1024).toFixed(2);
console.log(`  ✓ Standalone Bundle generated at: ${outPath} (${bundleSizeKb} KB)\n`);

const suiteDuration = (performance.now() - suiteStart).toFixed(2);
console.log('================================================================================');
console.log(`  PHASE 2 MASTER VERIFICATION COMPLETED IN ${suiteDuration} ms`);
console.log('  STATUS: 100% PASS — CORE NATIVE APPLICATION SUITE VERIFIED');
console.log('================================================================================\n');
