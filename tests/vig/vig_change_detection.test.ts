/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Test Suite: VIG Phase 4 Change Detection & Selective Invalidation
 * Specification: VIG Phase 4 Acceptance Criteria
 *
 * Validates:
 * 1. Repository-relative file manifest creation, Merkle root sealing, and normalization.
 * 2. Genuine no-op execution on unchanged inputs with measured zero files re-read.
 * 3. Touch-only clean runs (mtime touched but content identical).
 * 4. Private implementation change isolation (isPublicApiBreached = false).
 * 5. Public API signature change cascading invalidation (isPublicApiBreached = true).
 * 6. File additions and deletions handling with clean referential cleanup.
 * 7. Fail-closed handling of missing, corrupt, and tampered manifests.
 * 8. Explicit ignore rules (node_modules, .git, .vig, dist, build, scratch, etc.).
 * 9. Windows-compatible atomic file replacement and temp file cleanup.
 */

import assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  VIGGraphStore,
  VIGManifestManager,
  VIGChangeScanner,
  VIGInvalidator,
  VIGASTExtractor,
  VIGCanonicalizer,
  VIGModel,
  VIGIntegrityError,
  VIGValidationError,
} from '../../src/one/vig';

function assertThrows(fn: () => void, errorType: any, errorMsgSubstring?: string): void {
  let threw = false;
  try {
    fn();
  } catch (err: any) {
    threw = true;
    assert(
      err instanceof errorType,
      `Expected error of type ${errorType.name}, got: ${err?.constructor?.name} (${err.message})`
    );
    if (errorMsgSubstring) {
      assert(
        err.message.includes(errorMsgSubstring),
        `Expected error message to include "${errorMsgSubstring}", got: "${err.message}"`
      );
    }
  }
  assert(threw, `Expected function to throw ${errorType.name}, but it completed without error.`);
}

export function runVIGChangeDetectionTests(): void {
  console.log('\n' + '='.repeat(80));
  console.log('  ONE LANGUAGE — VIG PHASE 4 CHANGE DETECTION & SELECTIVE INVALIDATION');
  console.log('='.repeat(80) + '\n');

  // ============================================================================
  // Suite 1: Repository-Relative Manifest Creation & Deterministic Sealing
  // ============================================================================
  console.log('[Suite 1] Repository-Relative Manifest Creation & Merkle Sealing...');
  {
    const files = {
      'src/math/Add.ts': {
        path: 'src/math/Add.ts',
        mtimeMs: 1000000,
        sizeBytes: 150,
        contentHash: 'a'.repeat(64),
        cid: '1'.repeat(64),
        publicApiHash: '2'.repeat(64),
        isTest: false,
      },
      'src/math/Sub.ts': {
        path: 'src/math/Sub.ts',
        mtimeMs: 1000000,
        sizeBytes: 140,
        contentHash: 'b'.repeat(64),
        cid: '3'.repeat(64),
        publicApiHash: '4'.repeat(64),
        isTest: false,
      },
    };

    const manifest1 = VIGManifestManager.createManifest(files, 123456789);
    assert.strictEqual(manifest1.schemaVersion, 1);
    assert.strictEqual(manifest1.fileCount, 2);
    assert.strictEqual(typeof manifest1.manifestRootSeal, 'string');
    assert.strictEqual(manifest1.manifestRootSeal.length, 64);

    // Consecutive creations must produce 100% bit-identical seals
    const manifest2 = VIGManifestManager.createManifest(files, 123456789);
    assert.strictEqual(
      manifest1.manifestRootSeal,
      manifest2.manifestRootSeal,
      'Consecutive manifest seals must be identical'
    );

    console.log('  ✓ Deterministic manifest creation and Merkle root sealing verified.');
  }

  // ============================================================================
  // Suite 2: Genuine No-Op Execution on Unchanged Inputs (Instrumentation Proved)
  // ============================================================================
  console.log('\n[Suite 2] Genuine No-Op Run with Measured 0 Files Re-Read...');
  {
    const fileAContent = 'export function add(a: number, b: number): number { return a + b; }';
    const fileBContent = 'import { add } from "./Add"; export function calc(x: number): number { return add(x, 1); }';

    const vfs = new Map<string, { content: string; mtimeMs: number; sizeBytes: number }>([
      ['src/Add.ts', { content: fileAContent, mtimeMs: 2000000, sizeBytes: Buffer.byteLength(fileAContent) }],
      ['src/Calc.ts', { content: fileBContent, mtimeMs: 2000000, sizeBytes: Buffer.byteLength(fileBContent) }],
    ]);

    // Initial manifest
    const initScan = VIGChangeScanner.scanInMemory(vfs, null);
    assert.strictEqual(initScan.addedFiles.length, 2);

    const store = new VIGGraphStore();
    const { updatedManifest } = VIGInvalidator.invalidateAndReindex(
      initScan,
      store,
      (p) => vfs.get(p)?.content,
      null
    );

    assert.strictEqual(store.nodeCount >= 2, true);

    // Now execute no-op scan on completely unchanged files
    const noOpScan = VIGChangeScanner.scanInMemory(vfs, updatedManifest);

    // Instrument proof
    assert.strictEqual(noOpScan.isNoOp, true, 'Scan must report isNoOp = true');
    assert.strictEqual(noOpScan.addedFiles.length, 0);
    assert.strictEqual(noOpScan.deletedFiles.length, 0);
    assert.strictEqual(noOpScan.changedFiles.length, 0);
    assert.strictEqual(noOpScan.unchangedFiles.length, 2);
    assert.strictEqual(noOpScan.instrumentation.filesScanned, 2);
    assert.strictEqual(noOpScan.instrumentation.statChecks, 2);
    assert.strictEqual(
      noOpScan.instrumentation.filesReRead,
      0,
      'Measured instrumentation must prove 0 files were re-read on no-op'
    );

    // Invalidator must do 0 work
    const { result: invResult } = VIGInvalidator.invalidateAndReindex(
      noOpScan,
      store,
      (p) => vfs.get(p)?.content,
      updatedManifest
    );

    assert.strictEqual(invResult.isNoOp, true);
    assert.strictEqual(invResult.invalidatedCids.length, 0);
    assert.strictEqual(invResult.reindexedFiles.length, 0);
    assert.strictEqual(invResult.manifestUpdated, false);

    console.log(`  ✓ Genuine no-op verified: 0 files re-read, scan latency = ${noOpScan.instrumentation.scanDurationMs.toFixed(3)}ms.`);
  }

  // ============================================================================
  // Suite 3: Touch-Only Clean Run (mtime touched, content identical)
  // ============================================================================
  console.log('\n[Suite 3] Touch-Only Clean Run (Timestamp Changed, Content Unaltered)...');
  {
    const fileContent = 'export const VERSION = "1.0.0";';
    const vfs = new Map<string, { content: string; mtimeMs: number; sizeBytes: number }>([
      ['src/Version.ts', { content: fileContent, mtimeMs: 3000000, sizeBytes: Buffer.byteLength(fileContent) }],
    ]);

    const initScan = VIGChangeScanner.scanInMemory(vfs, null);
    const store = new VIGGraphStore();
    const { updatedManifest } = VIGInvalidator.invalidateAndReindex(
      initScan,
      store,
      (p) => vfs.get(p)?.content,
      null
    );

    // Touch file: mtime updated from 3000000 -> 3500000, but content is identical!
    vfs.set('src/Version.ts', {
      content: fileContent,
      mtimeMs: 3500000,
      sizeBytes: Buffer.byteLength(fileContent),
    });

    const touchScan = VIGChangeScanner.scanInMemory(vfs, updatedManifest);
    assert.strictEqual(touchScan.isNoOp, true, 'Touch scan must report isNoOp = true');
    assert.strictEqual(touchScan.touchOnlyFiles.length, 1);
    assert.strictEqual(touchScan.touchOnlyFiles[0], 'src/Version.ts');
    assert.strictEqual(touchScan.changedFiles.length, 0);
    assert.strictEqual(touchScan.instrumentation.filesReRead, 1, 'File was re-read once to verify content hash');

    // Invalidator confirms zero graph changes
    const { result: touchInv } = VIGInvalidator.invalidateAndReindex(
      touchScan,
      store,
      (p) => vfs.get(p)?.content,
      updatedManifest
    );
    assert.strictEqual(touchInv.isNoOp, true);
    assert.strictEqual(touchInv.invalidatedCids.length, 0);

    console.log('  ✓ Touch-only clean run verified without unnecessary graph invalidation.');
  }

  // ============================================================================
  // Suite 4: Single-File Private Implementation Change
  // ============================================================================
  console.log('\n[Suite 4] Private Implementation Change vs Downstream Isolation...');
  {
    // Module A with public signature: add(a: number, b: number): number
    // Module B imports A and uses add.
    // Test A tests A.
    const fileAOriginal = `
      function internalHelper(x: number): number { return x * 1; }
      export function add(a: number, b: number): number { return internalHelper(a) + b; }
    `;
    const fileBContent = `
      import { add } from './Add';
      export function run() { return add(1, 2); }
    `;
    const testAContent = `
      import { add } from '../src/Add';
    `;

    const vfs = new Map<string, { content: string; mtimeMs: number }>([
      ['src/Add.ts', { content: fileAOriginal, mtimeMs: 4000000 }],
      ['src/Run.ts', { content: fileBContent, mtimeMs: 4000000 }],
      ['tests/Add.test.ts', { content: testAContent, mtimeMs: 4000000 }],
    ]);

    const initScan = VIGChangeScanner.scanInMemory(vfs, null);
    const store = new VIGGraphStore();
    const { updatedManifest } = VIGInvalidator.invalidateAndReindex(
      initScan,
      store,
      (p) => vfs.get(p)?.content,
      null
    );

    // Private change in Add.ts: refactor internal helper, but export add(a: number, b: number): number is identical!
    const fileAPrivateChange = `
      function internalHelper(x: number): number { const y = x * 1; return y; }
      export function add(a: number, b: number): number { return internalHelper(a) + b; }
    `;
    vfs.set('src/Add.ts', { content: fileAPrivateChange, mtimeMs: 4100000 });

    const scan = VIGChangeScanner.scanInMemory(vfs, updatedManifest);
    assert.strictEqual(scan.isNoOp, false);
    assert.strictEqual(scan.changedFiles.length, 1);
    assert.strictEqual(scan.changedFiles[0].classification, 'PRIVATE_IMPLEMENTATION_CHANGE');
    assert.strictEqual(scan.isPublicApiBreached, false, 'Private change must not breach public API');

    const { result: invResult } = VIGInvalidator.invalidateAndReindex(
      scan,
      store,
      (p) => vfs.get(p)?.content,
      updatedManifest
    );

    assert.strictEqual(invResult.isPublicApiBreached, false);
    assert.strictEqual(invResult.reindexedFiles.length, 1);
    assert.strictEqual(invResult.reindexedFiles[0], 'src/Add.ts');
    assert.strictEqual(
      invResult.affectedDownstreamNodes.length,
      0,
      'Downstream consumers must NOT be invalidated on private implementation changes'
    );

    console.log('  ✓ Private implementation change correctly classified and isolated from downstream consumers.');
  }

  // ============================================================================
  // Suite 5: Single-File Public API Signature Change Cascading Invalidation
  // ============================================================================
  console.log('\n[Suite 5] Public API Signature Change & Cascading Invalidation...');
  {
    const fileAOriginal = `
      export function compute(val: number): number { return val * 2; }
    `;
    const fileBContent = `
      import { compute } from './Service';
      export function app() { return compute(10); }
    `;
    const testServiceContent = `
      import { compute } from '../src/Service';
    `;

    const vfs = new Map<string, { content: string; mtimeMs: number }>([
      ['src/Service.ts', { content: fileAOriginal, mtimeMs: 5000000 }],
      ['src/App.ts', { content: fileBContent, mtimeMs: 5000000 }],
      ['tests/Service.test.ts', { content: testServiceContent, mtimeMs: 5000000 }],
    ]);

    const initScan = VIGChangeScanner.scanInMemory(vfs, null);
    const store = new VIGGraphStore();
    const { updatedManifest } = VIGInvalidator.invalidateAndReindex(
      initScan,
      store,
      (p) => vfs.get(p)?.content,
      null
    );

    // Public API change in Service.ts: change return type or parameter signature!
    const fileAPublicChange = `
      export function compute(val: number, multiplier: number = 1): number { return val * multiplier; }
    `;
    vfs.set('src/Service.ts', { content: fileAPublicChange, mtimeMs: 5100000 });

    const scan = VIGChangeScanner.scanInMemory(vfs, updatedManifest);
    assert.strictEqual(scan.isNoOp, false);
    assert.strictEqual(scan.changedFiles.length, 1);
    assert.strictEqual(scan.changedFiles[0].classification, 'PUBLIC_API_SIGNATURE_CHANGE');
    assert.strictEqual(scan.isPublicApiBreached, true, 'Public signature change must flag public API breach');

    const { result: invResult } = VIGInvalidator.invalidateAndReindex(
      scan,
      store,
      (p) => vfs.get(p)?.content,
      updatedManifest
    );

    assert.strictEqual(invResult.isPublicApiBreached, true);
    assert.strictEqual(invResult.reindexedFiles[0], 'src/Service.ts');
    assert(invResult.affectedDownstreamNodes.length >= 1, 'Downstream consumers must be marked affected');

    console.log('  ✓ Public API signature change correctly detected and propagated downstream.');
  }

  // ============================================================================
  // Suite 6: File Additions & File Deletions Handling
  // ============================================================================
  console.log('\n[Suite 6] File Additions and Deletions Handling...');
  {
    const vfs = new Map<string, { content: string; mtimeMs: number }>([
      ['src/Mod1.ts', { content: 'export const M1 = 1;', mtimeMs: 6000000 }],
      ['src/Mod2.ts', { content: 'export const M2 = 2;', mtimeMs: 6000000 }],
    ]);

    const initScan = VIGChangeScanner.scanInMemory(vfs, null);
    const store = new VIGGraphStore();
    let { updatedManifest } = VIGInvalidator.invalidateAndReindex(
      initScan,
      store,
      (p) => vfs.get(p)?.content,
      null
    );
    assert.strictEqual(store.getNodesByPath('src/Mod1.ts').length >= 1, true);
    assert.strictEqual(store.getNodesByPath('src/Mod2.ts').length >= 1, true);

    // 1. Delete Mod2.ts
    vfs.delete('src/Mod2.ts');
    const deleteScan = VIGChangeScanner.scanInMemory(vfs, updatedManifest);
    assert.strictEqual(deleteScan.deletedFiles.length, 1);
    assert.strictEqual(deleteScan.deletedFiles[0], 'src/Mod2.ts');

    const delRes = VIGInvalidator.invalidateAndReindex(
      deleteScan,
      store,
      (p) => vfs.get(p)?.content,
      updatedManifest
    );
    assert.strictEqual(delRes.result.removedCids.length >= 1, true);
    assert.strictEqual(store.getNodesByPath('src/Mod2.ts').length, 0, 'Deleted file nodes must be cleanly removed');
    assert.strictEqual(delRes.updatedManifest.fileCount, 1);
    updatedManifest = delRes.updatedManifest;

    // 2. Add Mod3.ts
    vfs.set('src/Mod3.ts', { content: 'export const M3 = 3;', mtimeMs: 6100000 });
    const addScan = VIGChangeScanner.scanInMemory(vfs, updatedManifest);
    assert.strictEqual(addScan.addedFiles.length, 1);
    assert.strictEqual(addScan.addedFiles[0], 'src/Mod3.ts');

    const addRes = VIGInvalidator.invalidateAndReindex(
      addScan,
      store,
      (p) => vfs.get(p)?.content,
      updatedManifest
    );
    assert.strictEqual(addRes.result.reindexedFiles.length, 1);
    assert.strictEqual(store.getNodesByPath('src/Mod3.ts').length >= 1, true);
    assert.strictEqual(addRes.updatedManifest.fileCount, 2);

    console.log('  ✓ Additions and deletions handled cleanly with zero orphaned graph records.');
  }

  // ============================================================================
  // Suite 7: Fail-Closed Manifest Recovery (Missing, Corrupted, Tampered)
  // ============================================================================
  console.log('\n[Suite 7] Fail-Closed Manifest Recovery...');
  {
    const tmpDir = path.join(process.cwd(), '.vig_test_tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const nonExistentPath = path.join(tmpDir, 'nonexistent.json');
    const corruptJsonPath = path.join(tmpDir, 'corrupt.json');
    const tamperedSealPath = path.join(tmpDir, 'tampered.json');

    try {
      // 1. Missing Manifest returns null
      assert.strictEqual(VIGManifestManager.loadManifest(nonExistentPath), null);

      // 2. Corrupt JSON throws VIGIntegrityError
      fs.writeFileSync(corruptJsonPath, '{ invalid json: [missing bracket', 'utf8');
      assertThrows(
        () => VIGManifestManager.loadManifest(corruptJsonPath),
        VIGIntegrityError,
        'Failed to parse manifest JSON'
      );

      // 3. Tampered Merkle Root Seal throws VIGIntegrityError
      const validFiles = {
        'src/A.ts': {
          path: 'src/A.ts',
          mtimeMs: 1000,
          sizeBytes: 10,
          contentHash: 'a'.repeat(64),
          cid: 'b'.repeat(64),
          publicApiHash: 'c'.repeat(64),
          isTest: false,
        },
      };
      const validManifest = VIGManifestManager.createManifest(validFiles);
      const tamperedManifest = { ...validManifest, manifestRootSeal: '0'.repeat(64) };
      fs.writeFileSync(tamperedSealPath, JSON.stringify(tamperedManifest), 'utf8');

      assertThrows(
        () => VIGManifestManager.loadManifest(tamperedSealPath),
        VIGIntegrityError,
        'Cryptographic manifest root seal mismatch'
      );

      console.log('  ✓ Missing, corrupt, and tampered manifests rejected fail-closed.');
    } finally {
      // Clean up test files
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  // ============================================================================
  // Suite 8: Explicit Ignore Rules and Extension Filters
  // ============================================================================
  console.log('\n[Suite 8] Explicit Ignore Rules & Extension Filtering...');
  {
    // Must be ignored:
    assert.strictEqual(VIGChangeScanner.isIgnored('node_modules/package/index.js'), true);
    assert.strictEqual(VIGChangeScanner.isIgnored('.git/config'), true);
    assert.strictEqual(VIGChangeScanner.isIgnored('.vig/manifest.json'), true);
    assert.strictEqual(VIGChangeScanner.isIgnored('dist/bundle.js'), true);
    assert.strictEqual(VIGChangeScanner.isIgnored('build/out.js'), true);
    assert.strictEqual(VIGChangeScanner.isIgnored('coverage/lcov.info'), true);
    assert.strictEqual(VIGChangeScanner.isIgnored('tmp/scratch.ts'), true);
    assert.strictEqual(VIGChangeScanner.isIgnored('scratch/temp.ts'), true);
    assert.strictEqual(VIGChangeScanner.isIgnored('src/image.png'), true);
    assert.strictEqual(VIGChangeScanner.isIgnored('src/index.js.map'), true);

    // Must be allowed:
    assert.strictEqual(VIGChangeScanner.isIgnored('src/one/tensor/Tensor.ts'), false);
    assert.strictEqual(VIGChangeScanner.isIgnored('tests/vig/vig_native_core.test.ts'), false);
    assert.strictEqual(VIGChangeScanner.isIgnored('src/one/programs/spatial_engine.one'), false);
    assert.strictEqual(VIGChangeScanner.isIgnored('package.json'), false);

    console.log('  ✓ Explicit ignore rules and extension filters verified.');
  }

  // ============================================================================
  // Suite 9: Windows Atomic File Replacement & Temp File Cleanup
  // ============================================================================
  console.log('\n[Suite 9] Windows Atomic Replacement & Temp Cleanup...');
  {
    const testDir = path.join(process.cwd(), '.vig_atomic_test');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    const manifestTarget = path.join(testDir, 'manifest.json');
    const staleTemp = path.join(testDir, 'manifest.tmp.1234.10000.abc');

    try {
      // Create a stale temp file
      fs.writeFileSync(staleTemp, 'stale content', 'utf8');
      // Set its mtime to 120 seconds in the past
      const pastTime = (Date.now() - 120000) / 1000;
      fs.utimesSync(staleTemp, pastTime, pastTime);

      const manifest = VIGManifestManager.createManifest({
        'src/Test.ts': {
          path: 'src/Test.ts',
          mtimeMs: 1000,
          sizeBytes: 100,
          contentHash: 'f'.repeat(64),
          cid: 'e'.repeat(64),
          publicApiHash: 'd'.repeat(64),
          isTest: false,
        },
      });

      // Save atomically
      VIGManifestManager.saveManifest(manifest, manifestTarget);

      // Verify file exists and is valid
      const loaded = VIGManifestManager.loadManifest(manifestTarget);
      assert(loaded !== null);
      assert.strictEqual(loaded.manifestRootSeal, manifest.manifestRootSeal);

      // Verify stale temp file was cleaned up
      assert.strictEqual(fs.existsSync(staleTemp), false, 'Stale temp file must be purged');

      console.log('  ✓ Windows atomic replacement and stale temp cleanup verified.');
    } finally {
      try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
    }
  }

  // ============================================================================
  // Suite 10: BUG-B01 Regression — Same-Size / Same-mtime Edit Detection
  // ============================================================================
  console.log('\n[Suite 10] BUG-B01 Regression: Same-Size / Same-mtime Edit Detection...');
  {
    // Part A: In-memory simulation with forceFullHash
    const origContent = 'export const FLAG = false;'; // 26 bytes
    const editContent = 'export const FLAG = true; '; // 26 bytes exactly
    assert.strictEqual(Buffer.byteLength(origContent), Buffer.byteLength(editContent));

    const vfs = new Map<string, { content: string; mtimeMs: number; ctimeMs?: number; sizeBytes: number }>([
      ['src/Config.ts', {
        content: origContent,
        mtimeMs: 5000000,
        ctimeMs: 5000000,
        sizeBytes: Buffer.byteLength(origContent),
      }],
    ]);

    const initScan = VIGChangeScanner.scanInMemory(vfs, null);
    const store = new VIGGraphStore();
    const { updatedManifest } = VIGInvalidator.invalidateAndReindex(
      initScan,
      store,
      (p) => vfs.get(p)?.content,
      null
    );

    // Edit content with identical byte count and identical mtime
    vfs.set('src/Config.ts', {
      content: editContent,
      mtimeMs: 5000000, // Identical mtimeMs
      ctimeMs: 5000000, // Identical ctimeMs
      sizeBytes: Buffer.byteLength(editContent), // Identical byte length (26 bytes)
    });

    // In standard mode with forceFullHash: true, change MUST be detected
    const fullHashScan = VIGChangeScanner.scanInMemory(vfs, updatedManifest, { forceFullHash: true });
    assert.strictEqual(fullHashScan.isNoOp, false, 'forceFullHash must detect same-size same-mtime edit');
    assert.strictEqual(fullHashScan.changedFiles.length, 1);
    assert.strictEqual(fullHashScan.changedFiles[0].path, 'src/Config.ts');
    assert.strictEqual(fullHashScan.instrumentation.filesReRead, 1);

    // Part B: ctime-based detection (simulating disk behavior where write/utimes updates ctime)
    vfs.set('src/Config.ts', {
      content: editContent,
      mtimeMs: 5000000, // Identical mtimeMs
      ctimeMs: 5000050, // ctime changed on disk write
      sizeBytes: Buffer.byteLength(editContent),
    });

    // In standard incremental mode without forceFullHash, ctime difference triggers re-read and detection
    const ctimeScan = VIGChangeScanner.scanInMemory(vfs, updatedManifest);
    assert.strictEqual(ctimeScan.isNoOp, false, 'ctime divergence must trigger re-read and change detection');
    assert.strictEqual(ctimeScan.changedFiles.length, 1);
    assert.strictEqual(ctimeScan.changedFiles[0].path, 'src/Config.ts');

    // Part C: Untouched files must remain genuine 0-read no-op
    vfs.set('src/Config.ts', {
      content: origContent,
      mtimeMs: 5000000,
      ctimeMs: 5000000,
      sizeBytes: Buffer.byteLength(origContent),
    });
    const genuineNoOp = VIGChangeScanner.scanInMemory(vfs, updatedManifest);
    assert.strictEqual(genuineNoOp.isNoOp, true);
    assert.strictEqual(genuineNoOp.instrumentation.filesReRead, 0, 'Untouched files must read 0 bytes');

    // Part D: Physical filesystem reproduction
    const physDir = path.join(process.cwd(), '.vig_b01_phys_test');
    try {
      if (!fs.existsSync(physDir)) fs.mkdirSync(physDir, { recursive: true });
      const testFile = path.join(physDir, 'Config.ts');
      fs.writeFileSync(testFile, origContent, 'utf8');

      const initialPhysScan = VIGChangeScanner.scanRepository(physDir, null);
      const manifest1 = VIGManifestManager.createManifest({
        'Config.ts': initialPhysScan.changedFiles[0].newEntry!,
      });

      // Same-size edit on disk with restored mtime
      const statBefore = fs.statSync(testFile);
      fs.writeFileSync(testFile, editContent, 'utf8');
      fs.utimesSync(testFile, statBefore.atime, statBefore.mtime);

      // Standard scan: ctime difference catches the edit
      const physScan = VIGChangeScanner.scanRepository(physDir, manifest1);
      assert.strictEqual(physScan.isNoOp, false, 'Filesystem ctime tracking must catch same-size edit');
      assert.strictEqual(physScan.changedFiles.length, 1);

      // forceFullHash scan: cryptographically catches the edit
      const physFullScan = VIGChangeScanner.scanRepository(physDir, manifest1, { forceFullHash: true });
      assert.strictEqual(physFullScan.isNoOp, false, 'forceFullHash must catch same-size edit on disk');
      assert.strictEqual(physFullScan.changedFiles.length, 1);

      console.log('  ✓ BUG-B01 regression verified: Same-size/same-mtime edits reliably detected.');
    } finally {
      try { fs.rmSync(physDir, { recursive: true, force: true }); } catch {}
    }
  }

  // ============================================================================
  // Suite 11: BUG-C03 Regression — Syntax-Error Fallback & False Breach Avoidance
  // ============================================================================
  console.log('\n[Suite 11] BUG-C03: Syntax-Error Fallback & False Breach Avoidance...');
  {
    // Part A: Explicit parse status and sentinel hash on syntax error
    const brokenTS = `
      export function badSyntax(a: number, {
        return a;
      // Missing closing delimiter
    `;

    const brokenTSApi = VIGASTExtractor.extractPublicApi(brokenTS, 'src/broken.ts');
    assert.strictEqual(brokenTSApi.status, 'INVALID', 'Syntax-errored TS must return INVALID');
    assert.strictEqual(brokenTSApi.publicApiHash, 'INVALID_PARSE_ERROR', 'Hash must be sentinel');
    assert(brokenTSApi.error !== undefined, 'Error message must be present');

    const brokenOne = `
      module BrokenOne {
        struct Vector { x: Int32;
      // Missing brace
    `;
    const brokenOneApi = VIGASTExtractor.extractPublicApi(brokenOne, 'src/broken.one');
    assert.strictEqual(brokenOneApi.status, 'INVALID', 'Syntax-errored ONE must return INVALID');
    assert.strictEqual(brokenOneApi.publicApiHash, 'INVALID_PARSE_ERROR', 'Hash must be sentinel');

    // Part B: Valid empty file vs invalid file
    const validEmpty = `// Just comments and whitespace\n`;
    const validEmptyApi = VIGASTExtractor.extractPublicApi(validEmpty, 'src/empty.ts');
    assert.strictEqual(validEmptyApi.status, 'VALID', 'Empty/comment-only valid file must be VALID');
    assert.notStrictEqual(validEmptyApi.publicApiHash, 'INVALID_PARSE_ERROR', 'Valid empty file must not have error hash');

    // Part C: Editing comments in syntax-broken file does NOT trigger public API breach
    const vfs = new Map<string, { content: string; mtimeMs: number; sizeBytes: number }>([
      ['src/broken.ts', {
        content: brokenTS,
        mtimeMs: 1000,
        sizeBytes: Buffer.byteLength(brokenTS),
      }],
    ]);

    const initialScan = VIGChangeScanner.scanInMemory(vfs, null);
    assert.strictEqual(initialScan.changedFiles[0].newEntry?.publicApiHash, 'INVALID_PARSE_ERROR');

    const manifest0 = VIGManifestManager.createManifest({
      'src/broken.ts': initialScan.changedFiles[0].newEntry!,
    });

    // Edit a comment in the broken file: content changes, but file is still broken
    const brokenWithCommentEdit = '// Updated developer note\n' + brokenTS;
    vfs.set('src/broken.ts', {
      content: brokenWithCommentEdit,
      mtimeMs: 2000,
      sizeBytes: Buffer.byteLength(brokenWithCommentEdit),
    });

    const commentEditScan = VIGChangeScanner.scanInMemory(vfs, manifest0);
    assert.strictEqual(commentEditScan.isNoOp, false, 'Content change must be detected');
    assert.strictEqual(commentEditScan.changedFiles.length, 1);
    const changeRecord = commentEditScan.changedFiles[0];

    // CRITICAL: Must be PRIVATE_IMPLEMENTATION_CHANGE, NOT PUBLIC_API_SIGNATURE_CHANGE!
    assert.strictEqual(
      changeRecord.classification,
      'PRIVATE_IMPLEMENTATION_CHANGE',
      'Editing comments in broken file must NOT classify as PUBLIC_API_SIGNATURE_CHANGE'
    );
    assert.strictEqual(
      changeRecord.isPublicApiBreached,
      false,
      'Editing comments in broken file must NOT breach public API'
    );
    assert.strictEqual(
      commentEditScan.isPublicApiBreached,
      false,
      'Overall scan must NOT flag public API breach for comment edits in broken file'
    );

    // Part D: Fixing the syntax error DOES transition to PUBLIC_API_SIGNATURE_CHANGE
    const fixedTS = `
      export function badSyntax(a: number): number {
        return a;
      }
    `;
    vfs.set('src/broken.ts', {
      content: fixedTS,
      mtimeMs: 3000,
      sizeBytes: Buffer.byteLength(fixedTS),
    });

    const fixedScan = VIGChangeScanner.scanInMemory(vfs, manifest0);
    assert.strictEqual(fixedScan.changedFiles[0].classification, 'PUBLIC_API_SIGNATURE_CHANGE');
    assert.strictEqual(fixedScan.changedFiles[0].isPublicApiBreached, true);
    assert.strictEqual(fixedScan.isPublicApiBreached, true);

    console.log('  ✓ BUG-C03: Syntax-error fallback and public API non-breach verified.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ALL VIG PHASE 4 CHANGE DETECTION SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

// Auto-execute when run as direct script
runVIGChangeDetectionTests();
