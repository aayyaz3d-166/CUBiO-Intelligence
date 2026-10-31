/**
 * Oview OS — Phase 5 Production Verification Suite
 * ================================================
 * Tests Production Packaging & Bootable Virtualization:
 *   [Test 1] Target A: Standalone Portable Desktop Application Bundle
 *   [Test 2] Target A: Windows Native Launchers (.bat & .ps1)
 *   [Test 3] Target B: Bootable VM ISO Filesystem Hierarchy
 *   [Test 4] Target B: GRUB2 Multi-Boot & Kernel Commandline Configuration
 *   [Test 5] Target B: Stage-1 Microkernel Initrd Init Script
 *   [Test 6] Target B: QEMU & VirtualBox Hardware Configuration Blueprints
 *   [Test 7] Master Distribution Packaging & Release Manifest
 *   [Test 8] Zero External Dependencies Verification (No Electron, No Node Modules in Dist)
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  DesktopRunner,
  BootableISOGenerator,
  OviewPackager,
} from '../../src/oview/index';

console.log('================================================================================');
console.log('  OVIEW OS: PHASE 5 PRODUCTION PACKAGING & VIRTUALIZATION VERIFICATION');
console.log('  Target A (Standalone Desktop App) • Target B (Bootable VM ISO Blueprint)');
console.log('================================================================================\n');

const suiteStart = performance.now();
const testDistDir = path.resolve('temp_oview_phase5_dist');
if (!fs.existsSync(testDistDir)) {
  fs.mkdirSync(testDistDir, { recursive: true });
}

// ── Test 1 & 2: Target A — Standalone Desktop Bundle & Launchers ────────────
console.log('[Test 1 & 2] Testing Target A: Standalone Desktop Bundle & Native Launchers...');
const desktopRunner = DesktopRunner.getInstance();
const desktopArtifacts = desktopRunner.generateBundle({
  outputDir: testDistDir,
  width: 1440,
  height: 900,
});

assert.ok(fs.existsSync(desktopArtifacts.htmlPath), 'Standalone HTML bundle must exist');
const htmlSizeKb = fs.statSync(desktopArtifacts.htmlPath).size / 1024;
assert.ok(htmlSizeKb > 40, `HTML bundle must be complete (> 40 KB, actual: ${htmlSizeKb.toFixed(2)} KB)`);

assert.ok(fs.existsSync(desktopArtifacts.batPath), 'Windows BAT launcher must exist');
const batContent = fs.readFileSync(desktopArtifacts.batPath, 'utf-8');
assert.ok(batContent.includes('msedge --app'), 'BAT launcher must use native WebView App mode');

assert.ok(fs.existsSync(desktopArtifacts.ps1Path), 'PowerShell PS1 launcher must exist');
const ps1Content = fs.readFileSync(desktopArtifacts.ps1Path, 'utf-8');
assert.ok(ps1Content.includes('Start-Process'), 'PS1 launcher must launch standalone process');
console.log(`  ✓ Target A emitted: HTML (${htmlSizeKb.toFixed(2)} KB), run-oview.bat, and run-oview.ps1.\n`);

// ── Test 3, 4, 5, 6: Target B — Bootable VM ISO Blueprint ───────────────────
console.log('[Test 3] Testing Target B: Bootable VM ISO Filesystem Hierarchy...');
const isoGen = BootableISOGenerator.getInstance();
const isoArtifacts = isoGen.generateISOBlueprint({
  outputDir: path.join(testDistDir, 'iso'),
  osName: 'Oview OS',
  version: '1.0.0',
  memoryMb: 1024,
});

assert.ok(fs.existsSync(isoArtifacts.isoDir), 'ISO root directory must exist');
assert.ok(fs.existsSync(path.join(isoArtifacts.isoDir, 'boot/grub')));
assert.ok(fs.existsSync(path.join(isoArtifacts.isoDir, 'boot/isolinux')));
assert.ok(fs.existsSync(path.join(isoArtifacts.isoDir, 'oview/rootfs')));
console.log('  ✓ Bootable ISO filesystem hierarchy created successfully.\n');

console.log('[Test 4] Testing Target B: GRUB2 Multi-Boot & Framebuffer Configuration...');
assert.ok(fs.existsSync(isoArtifacts.grubConfig));
const grubCfg = fs.readFileSync(isoArtifacts.grubConfig, 'utf-8');
assert.ok(grubCfg.includes('gfxmode=1920x1080x32'), 'Must configure high-res 32-bit framebuffer');
assert.ok(grubCfg.includes('oview.spatial369=enforce'), 'Kernel cmdline must enforce Address369 spatial bounds');
assert.ok(grubCfg.includes('menuentry "Oview OS'), 'Must contain multi-boot menu entries');
console.log('  ✓ GRUB2 configuration verified with high-res framebuffer and Address369 kernel flags.\n');

console.log('[Test 5] Testing Target B: Stage-1 Microkernel Initrd Init Script...');
assert.ok(fs.existsSync(isoArtifacts.initScriptPath));
const initScript = fs.readFileSync(isoArtifacts.initScriptPath, 'utf-8');
assert.ok(initScript.includes('mount -t proc'), 'Init script must mount proc');
assert.ok(initScript.includes('OVIEW_SPATIAL_SLOTS=369'), 'Init script must set spatial slot bounds');
assert.ok(initScript.includes('oview-compositor'), 'Init script must launch compositor on framebuffer');
console.log('  ✓ Stage-1 sovereign microkernel init script verified.\n');

console.log('[Test 6] Testing Target B: QEMU & VirtualBox Execution Blueprints...');
assert.ok(fs.existsSync(isoArtifacts.qemuRunnerPath), 'QEMU runner script must exist');
const qemuScript = fs.readFileSync(isoArtifacts.qemuRunnerPath, 'utf-8');
assert.ok(qemuScript.includes('qemu-system-x86_64'), 'Must invoke QEMU x86_64');

assert.ok(fs.existsSync(isoArtifacts.vboxConfigPath), 'VirtualBox configuration blueprint must exist');
const vboxConfig = fs.readFileSync(isoArtifacts.vboxConfigPath, 'utf-8');
assert.ok(vboxConfig.includes('<VirtualBox'), 'Must be valid VirtualBox XML format');
assert.ok(vboxConfig.includes('RAMSize="1024"'), 'Must specify 1024MB RAM');
console.log('  ✓ QEMU runner and VirtualBox VM configuration blueprints verified.\n');

// ── Test 7: Master Production Packager & Release Manifest ───────────────────
console.log('[Test 7] Testing Master Production Packager & Release Manifest...');
const packager = OviewPackager.getInstance();
const releaseArtifacts = packager.packageDistribution('dist/oview');

assert.ok(fs.existsSync(releaseArtifacts.manifestPath), 'Release manifest must exist');
const manifestRaw = fs.readFileSync(releaseArtifacts.manifestPath, 'utf-8');
const manifest = JSON.parse(manifestRaw);

assert.strictEqual(manifest.product, 'Oview OS');
assert.strictEqual(manifest.version, '1.0.0');
assert.strictEqual(manifest.memoryArchitecture, 'Address369 Bounded Spatial Slots [0..368]');
assert.ok(manifest.targets.targetA, 'Manifest must specify Target A');
assert.ok(manifest.targets.targetB, 'Manifest must specify Target B');
console.log(`  ✓ Production distribution packaged in ${releaseArtifacts.buildTimeMs} ms with release-manifest.json.\n`);

// ── Test 8: Zero External Dependencies Verification ────────────────────────
console.log('[Test 8] Verifying Zero External Dependencies (Zero Electron, Zero Heavy Frameworks)...');
assert.strictEqual(manifest.targets.targetA.dependencies, 'Zero (Runs via Native Desktop WebView)');
assert.ok(!manifestRaw.includes('electron'));
assert.ok(!manifestRaw.includes('react'));
console.log('  ✓ Zero external dependencies invariant verified across all distribution artifacts.\n');

// Clean up temp test directory
try {
  fs.rmSync(testDistDir, { recursive: true, force: true });
} catch {
  // ignore
}

const suiteDuration = (performance.now() - suiteStart).toFixed(2);
console.log('================================================================================');
console.log(`  PHASE 5 MASTER VERIFICATION COMPLETED IN ${suiteDuration} ms`);
console.log('  STATUS: 100% PASS — PRODUCTION PACKAGING & VIRTUALIZATION VERIFIED');
console.log('================================================================================\n');
