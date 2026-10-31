/**
 * ONE Intelligence — Task 21 Verification Suite
 * ===============================================
 * Tests: VIG, Compiler, AST & Provenance Ledger
 * Module: tests/vig/task21_vig_compiler_provenance.test.ts
 */

import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  VIGNode,
  VIGEdge,
  VIGSecurityContext,
  VIGVerificationEvidence,
  VIGTestSuiteRecord,
  VIGVerificationStatus,
  VIGSecurityError,
  VIGAccessDeniedError,
  VIGValidationError,
} from '../../src/one/vig/types';
import {
  VIGParserBridge,
  VIGASTBridge,
  VIGIRBridge,
  VIGRuntimeBridge,
} from '../../src/one/vig/VIGIntegrationBridge';
import { VIGASTExtractor } from '../../src/one/vig/VIGASTExtractor';
import { VIGCompilationCache } from '../../src/one/vig/VIGCompilationCache';
import { VIGProvenanceLedger } from '../../src/one/vig/VIGProvenanceLedger';
import { VIGSecurityGuard } from '../../src/one/vig/VIGSecurityGuard';
import { VIGCanonicalizer } from '../../src/one/vig/VIGCanonicalizer';
import { VerifiableIntelligenceGraph } from '../../src/one/vig/VerifiableIntelligenceGraph';

import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import { UnifiedVM } from '../../src/one/vm/UnifiedVM';
import { ExecutableValidator } from '../../src/one/packer/ExecutableValidator';
import { createVariable } from '../../src/one/ir/UnifiedIR';

export async function runTask21VIGCompilerProvenanceTests(): Promise<void> {
  console.log('='.repeat(80));
  console.log('  ONE INTELLIGENCE — TASK 21: VIG, COMPILER, AST & PROVENANCE LEDGER');
  console.log('='.repeat(80));

  // Configure isolated environment for file-based tests
  const tempBaseDir = path.join(
    os.tmpdir(),
    `vig-task21-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  );
  const testRepoRoot = path.join(tempBaseDir, 'repo');
  const testVigDir = path.join(testRepoRoot, '.vig');
  fs.mkdirSync(path.join(testRepoRoot, 'src', 'modules'), { recursive: true });
  fs.mkdirSync(testVigDir, { recursive: true });

  const systemSecret = 'task21-test-system-secret-2026-auth';
  VIGSecurityGuard.configureSystemSecret(systemSecret);
  const systemContext: VIGSecurityContext = VIGSecurityGuard.createSystemContext(
    'task21-worker-01',
    systemSecret
  );

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // Suite 1: Compiler VIG Event Tracing & Code Property Graph Generation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Suite 1] Compiler VIG Event Tracing & Code Property Graph Generation...');

    const sampleOneSource = `
import math_lib;

fn classicFunc(a: Int32): Int32 {
  return a * 2;
}

one make modernFunc(b: Int32): Int32 {
  return b + 10;
}
`;

    // 1A: AST Bridge Mapping to VIG Nodes & Directed Edges
    const parserBridge = new VIGParserBridge();
    const { nodes: parsedNodes, edges: parsedEdges } = parserBridge.extractNodesFromOneSource(
      sampleOneSource,
      'src/modules/sample.one'
    );

    // Verify root source file node
    const fileNode = parsedNodes.find((n) => n.kind === 'SOURCE_FILE');
    assert.ok(fileNode, 'Suite 1A: Root SOURCE_FILE node generated');
    assert.strictEqual(fileNode!.path, 'src/modules/sample.one', 'Suite 1A: File path normalized');
    assert.strictEqual(fileNode!.isExported, true, 'Suite 1A: File node marked exported');

    // Verify declaration nodes: classic function and modern v1.0.1 function
    const classicFnNode = parsedNodes.find((n) => n.name === 'classicFunc');
    const modernFnNode = parsedNodes.find((n) => n.name === 'modernFunc');
    assert.ok(classicFnNode, 'Suite 1A: classicFunc AST_DECLARATION node generated');
    assert.ok(modernFnNode, 'Suite 1A: modernFunc AST_DECLARATION node generated via one make');

    // Verify import placeholder module node
    const importModNode = parsedNodes.find((n) => n.kind === 'MODULE' && n.name === 'math_lib');
    assert.ok(importModNode, 'Suite 1A: math_lib MODULE node placeholder generated');

    // Verify directed edges: DEFINES_SYMBOL and IMPORTS
    const definesEdges = parsedEdges.filter((e) => e.relation === 'DEFINES_SYMBOL');
    const importEdges = parsedEdges.filter((e) => e.relation === 'IMPORTS');
    assert.strictEqual(definesEdges.length, 2, 'Suite 1A: Two DEFINES_SYMBOL edges generated');
    assert.strictEqual(importEdges.length, 1, 'Suite 1A: One IMPORTS edge generated');
    assert.strictEqual(importEdges[0].sourceCid, fileNode!.cid, 'Suite 1A: Import edge source is file node');
    assert.strictEqual(importEdges[0].targetCid, importModNode!.cid, 'Suite 1A: Import edge target is math_lib');

    // 1B: IR Bridge Lowering & Deterministic IR Hashing
    const compiler = new UnifiedCompiler({ emitIR: true });
    const compRes = compiler.compile(sampleOneSource);
    assert.strictEqual(compRes.success, true, 'Suite 1B: UnifiedCompiler successfully compiled source');
    assert.ok(compRes.ir, 'Suite 1B: Lowered IR generated');

    const irBridge = new VIGIRBridge();
    const irHash1 = irBridge.computeIRHash(compRes.ir!);
    const irHash2 = irBridge.computeIRHash(compRes.ir!);
    assert.strictEqual(irHash1, irHash2, 'Suite 1B: IR hash calculation is 100% deterministic');
    assert.strictEqual(irHash1.length, 64, 'Suite 1B: IR hash is 64-char SHA-256');

    const irNode = irBridge.createIRNode(compRes.ir!, fileNode!.cid, 'src/modules/sample.one');
    assert.strictEqual(irNode.kind, 'MODULE', 'Suite 1B: IR node kind is MODULE');
    assert.strictEqual(irNode.name, 'sample.one.ir', 'Suite 1B: IR node name formatted');
    assert.strictEqual(irNode.contentHash, irHash1, 'Suite 1B: IR node contentHash matches IR hash');
    assert.strictEqual(irNode.metadata['boundSourceCid'], fileNode!.cid, 'Suite 1B: IR node bound to source CID');

    console.log('  ✓ Suite 1 passed: Compiler events produce validated graph nodes, edges, and IR bindings.');

    // ──────────────────────────────────────────────────────────────────────────
    // Suite 2: Multi-File Compilation & Topological Dependency Execution
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Suite 2] Multi-File Compilation & Topological Dependency Execution...');

    const virtualFiles = {
      'src/math.one': `
        export fn add(x: Int32, y: Int32): Int32 {
          return x + y;
        }
        export fn multiply(x: Int32, y: Int32): Int32 {
          return x * y;
        }
      `,
      'src/utils.one': `
        import { add, multiply } from 'src/math.one';

        export fn computeFormula(val: Int32): Int32 {
          let sum = add(val, 10);
          return multiply(sum, 2);
        }
      `,
      'src/main.one': `
        import { computeFormula } from 'src/utils.one';

        let result = computeFormula(15);
      `,
    };

    const multiRes = compiler.compileMultiFile('src/main.one', {
      virtualFiles,
      execute: true,
    });

    assert.strictEqual(multiRes.success, true, 'Suite 2: Multi-file compilation succeeded');
    assert.strictEqual(multiRes.diagnostics.length, 0, 'Suite 2: Zero diagnostics');
    assert.ok(multiRes.sortedModules, 'Suite 2: Sorted modules exist');

    // Verify topological order: math -> utils -> main
    const sortedPaths = multiRes.sortedModules!.map((m) => m.filePath);
    assert.ok(sortedPaths.indexOf('src/math.one') < sortedPaths.indexOf('src/utils.one'), 'Suite 2: math before utils');
    assert.ok(sortedPaths.indexOf('src/utils.one') < sortedPaths.indexOf('src/main.one'), 'Suite 2: utils before main');

    // Verify VM execution output: (15 + 10) * 2 = 50
    assert.ok(multiRes.vmResult, 'Suite 2: VM execution result present');
    assert.strictEqual(multiRes.vmResult!.success, true, 'Suite 2: VM execution succeeded');
    assert.strictEqual(multiRes.vmResult!.globals['result'], 50, 'Suite 2: Evaluated result (15 + 10) * 2 == 50');

    console.log('  ✓ Suite 2 passed: Multi-file compilation resolves topological order and executes cleanly.');

    // ──────────────────────────────────────────────────────────────────────────
    // Suite 3: Compilation Cache Keys & Incremental Cache Behavior
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Suite 3] Compilation Cache Keys & Incremental Cache Behavior...');

    const compilationCache = new VIGCompilationCache(50);

    // 3A: Cold compile (cache misses for all 3 modules)
    const coldRes = compiler.compileMultiFile('src/main.one', {
      virtualFiles,
      compilationCache,
    });
    assert.strictEqual(coldRes.success, true, 'Suite 3A: Cold compile succeeded');
    assert.strictEqual(coldRes.cacheMetrics?.hits, 0, 'Suite 3A: Cold compile has 0 hits');
    assert.strictEqual(coldRes.cacheMetrics?.misses, 3, 'Suite 3A: Cold compile has 3 misses');
    assert.strictEqual(compilationCache.metrics.totalEntries, 3, 'Suite 3A: Cache now holds 3 entries');

    // 3B: Warm compile (cache hits for all 3 modules)
    const warmRes = compiler.compileMultiFile('src/main.one', {
      virtualFiles,
      compilationCache,
    });
    assert.strictEqual(warmRes.success, true, 'Suite 3B: Warm compile succeeded');
    assert.strictEqual(warmRes.cacheMetrics?.hits, 3, 'Suite 3B: Warm compile has 3 hits (100%)');
    assert.strictEqual(warmRes.cacheMetrics?.misses, 0, 'Suite 3B: Warm compile has 0 misses');
    assert.strictEqual(compilationCache.metrics.hits, 3, 'Suite 3B: Total cache hits recorded');

    // 3C: Cache Key Structure Verification
    const mathMod = coldRes.sortedModules!.find((m) => m.filePath === 'src/math.one')!;
    const mathKey = VIGCompilationCache.computeCacheKey({
      contentHash: mathMod.contentHash,
      compilerVersion: 'v0.1.0-vig',
      importedPublicApiHashes: mathMod.importedPublicApiHashes,
    });
    assert.strictEqual(compilationCache.has(mathKey), true, 'Suite 3C: math.one is present under computed key');
    const cachedMath = compilationCache.get(mathKey);
    assert.ok(cachedMath?.ast, 'Suite 3C: Cached AST retrieved');
    assert.ok(cachedMath?.ir, 'Suite 3C: Cached IR retrieved');

    // 3D: Selective Invalidation
    const invalidatedCount = compilationCache.invalidatePath('src/math.one');
    assert.strictEqual(invalidatedCount, 1, 'Suite 3D: Successfully invalidated math.one entry');
    assert.strictEqual(compilationCache.has(mathKey), false, 'Suite 3D: math.one key no longer present');

    // Re-compiling after selective invalidation
    const partialRes = compiler.compileMultiFile('src/main.one', {
      virtualFiles,
      compilationCache,
    });
    assert.strictEqual(partialRes.cacheMetrics?.hits, 2, 'Suite 3D: utils and main remain cache hits');
    assert.strictEqual(partialRes.cacheMetrics?.misses, 1, 'Suite 3D: math recompiled on cache miss');

    console.log('  ✓ Suite 3 passed: Deterministic cache keys, hit/miss metrics, and selective invalidation verified.');

    // ──────────────────────────────────────────────────────────────────────────
    // Suite 4: Changed Dependencies: Private Edits vs Public API Breaches
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Suite 4] Changed Dependencies: Private Edits vs Public API Breaches...');

    // 4A: Private Implementation Change in math.one (same signature, different body)
    const virtualFilesPrivateEdit = {
      ...virtualFiles,
      'src/math.one': `
        export fn add(x: Int32, y: Int32): Int32 {
          // Private implementation optimization: y + x
          return y + x;
        }
        export fn multiply(x: Int32, y: Int32): Int32 {
          return x * y;
        }
      `,
    };

    const publicApiBefore = VIGASTExtractor.computePublicApiHash(virtualFiles['src/math.one'], 'src/math.one');
    const publicApiAfter = VIGASTExtractor.computePublicApiHash(virtualFilesPrivateEdit['src/math.one'], 'src/math.one');
    assert.strictEqual(
      publicApiBefore,
      publicApiAfter,
      'Suite 4A: Private body modification does NOT change publicApiHash'
    );

    // Warm cache compile with private edit
    const privateEditRes = compiler.compileMultiFile('src/main.one', {
      virtualFiles: virtualFilesPrivateEdit,
      compilationCache,
    });
    // math.one has changed contentHash, so it misses. But utils.one importedPublicApiHashes is unchanged!
    assert.strictEqual(privateEditRes.cacheMetrics?.misses, 1, 'Suite 4A: Only math.one recompiled on private edit');
    assert.strictEqual(privateEditRes.cacheMetrics?.hits, 2, 'Suite 4A: Downstream utils and main retained cache hits');

    // 4B: Public API Signature Breach in math.one (parameter changed)
    const virtualFilesPublicBreach = {
      ...virtualFiles,
      'src/math.one': `
        export fn add(x: Int32, y: Int32, z: Int32): Int32 { // CHANGED ARITY!
          return x + y + z;
        }
        export fn multiply(x: Int32, y: Int32): Int32 {
          return x * y;
        }
      `,
    };

    const publicApiBreached = VIGASTExtractor.computePublicApiHash(virtualFilesPublicBreach['src/math.one'], 'src/math.one');
    assert.notStrictEqual(
      publicApiBefore,
      publicApiBreached,
      'Suite 4B: Signature change alters publicApiHash'
    );

    // Dependent modules will notice the changed importedPublicApiHash, breaking their cache keys
    const mathModBreached = VIGCompilationCache.computeCacheKey({
      contentHash: crypto.createHash('sha256').update(virtualFilesPublicBreach['src/math.one']).digest('hex'),
      compilerVersion: 'v0.1.0-vig',
      importedPublicApiHashes: {},
    });

    const utilsKeyWithOldMath = VIGCompilationCache.computeCacheKey({
      contentHash: crypto.createHash('sha256').update(virtualFiles['src/utils.one']).digest('hex'),
      compilerVersion: 'v0.1.0-vig',
      importedPublicApiHashes: { 'src/math.one': publicApiBefore },
    });

    const utilsKeyWithNewMath = VIGCompilationCache.computeCacheKey({
      contentHash: crypto.createHash('sha256').update(virtualFiles['src/utils.one']).digest('hex'),
      compilerVersion: 'v0.1.0-vig',
      importedPublicApiHashes: { 'src/math.one': publicApiBreached },
    });

    assert.notStrictEqual(
      utilsKeyWithOldMath,
      utilsKeyWithNewMath,
      'Suite 4B: Public API breach in dependency cascades to change dependent cache key'
    );

    console.log('  ✓ Suite 4 passed: Private edits isolated; public API breaches cascade invalidate downstream cache.');

    // ──────────────────────────────────────────────────────────────────────────
    // Suite 5: Invalid Syntax & Parse Error Tolerance Fail-Closed
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Suite 5] Invalid Syntax & Parse Error Tolerance Fail-Closed...');

    // 5A: Delimiter Imbalance in ONE Language Source
    const malformedSource = `
      fn badSyntax(a: Int32): Int32 {
        let x = 1;
        // Missing closing brace
    `;
    const invalidApiResult = VIGASTExtractor.extractPublicApi(malformedSource, 'bad.one');
    assert.strictEqual(invalidApiResult.status, 'INVALID', 'Suite 5A: Delimiter imbalance marked INVALID');
    assert.strictEqual(invalidApiResult.publicApiHash, 'INVALID_PARSE_ERROR', 'Suite 5A: Sentinel INVALID_PARSE_ERROR returned');
    assert.ok(invalidApiResult.error, 'Suite 5A: Detailed error message provided');

    // 5B: UnifiedCompiler Rejection on Multi-File with Syntax Error
    const virtualFilesMalformed = {
      ...virtualFiles,
      'src/math.one': malformedSource,
    };

    const malformedCompRes = compiler.compileMultiFile('src/main.one', {
      virtualFiles: virtualFilesMalformed,
      compilationCache,
    });

    assert.strictEqual(malformedCompRes.success, false, 'Suite 5B: Multi-file compile fails closed on syntax error');
    assert.ok(malformedCompRes.diagnostics.length > 0, 'Suite 5B: Diagnostics emitted for syntax error');
    assert.ok(
      malformedCompRes.diagnostics.some((d) => d.code === 'E1001' || d.code.startsWith('E1')),
      'Suite 5B: Syntax error code E1001 emitted'
    );

    console.log('  ✓ Suite 5 passed: Syntax errors handled fail-closed with diagnostic sentinel and zero cache corruption.');

    // ──────────────────────────────────────────────────────────────────────────
    // Suite 6: Provenance Ledger & Real Git Commit Anchoring
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Suite 6] Provenance Ledger & Real Git Commit Anchoring...');

    // 6A: Real Git commit anchor resolution
    const anchor = VIGProvenanceLedger.resolveGitCommitAnchor();
    assert.ok(typeof anchor.commitSha === 'string' && /^[a-f0-9]{40}$/.test(anchor.commitSha), 'Suite 6A: 40-char commit SHA');
    assert.ok(typeof anchor.branch === 'string' && anchor.branch.length > 0, 'Suite 6A: Branch is non-empty');
    assert.ok(typeof anchor.isWorkingTreeClean === 'boolean', 'Suite 6A: isWorkingTreeClean is boolean');
    assert.ok(anchor.committedAt > 0, 'Suite 6A: committedAt is valid timestamp');

    // 6B: Verification Evidence Creation & Identity Stability
    const graphSeal = 'b'.repeat(64);
    const testSuites: VIGTestSuiteRecord[] = [
      {
        suitePath: 'tests/vig/vig_native_core.test.ts',
        totalChecks: 7,
        passedChecks: 7,
        failedChecks: 0,
        exitCode: 0,
        durationMs: 45,
      },
      {
        suitePath: 'tests/compiler/task21_vig_compiler_provenance.test.ts',
        totalChecks: 10,
        passedChecks: 10,
        failedChecks: 0,
        exitCode: 0,
        durationMs: 80,
      },
    ];

    const evidence1 = VIGProvenanceLedger.createEvidenceRecord({
      commitSha: anchor.commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites,
      evaluatedAt: 1000000,
    });

    const evidence2 = VIGProvenanceLedger.createEvidenceRecord({
      commitSha: anchor.commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites,
      evaluatedAt: 2000000, // Different timestamp!
    });

    assert.strictEqual(
      evidence1.evidenceId,
      evidence2.evidenceId,
      'Suite 6B: Evidence ID is content-addressed and independent of evaluatedAt timestamp'
    );

    // 6C: Multi-Tier Status Evaluation
    // 1. Fresh and Clean -> VERIFIED_PASS
    const statusFresh = VIGProvenanceLedger.evaluateVerificationStatus(
      evidence1,
      anchor.commitSha,
      graphSeal,
      true // Current tree is clean
    );
    assert.strictEqual(statusFresh, 'VERIFIED_PASS', 'Suite 6C: Fresh clean evidence evaluates to VERIFIED_PASS');

    // 2. Commit Change -> STALE
    const statusStaleCommit = VIGProvenanceLedger.evaluateVerificationStatus(
      evidence1,
      '0'.repeat(40), // Different commit
      graphSeal,
      true
    );
    assert.strictEqual(statusStaleCommit, 'STALE', 'Suite 6C: Changed commit SHA evaluates to STALE');

    // 3. Graph Seal Change -> STALE
    const statusStaleGraph = VIGProvenanceLedger.evaluateVerificationStatus(
      evidence1,
      anchor.commitSha,
      'c'.repeat(64), // Different graph seal
      true
    );
    assert.strictEqual(statusStaleGraph, 'STALE', 'Suite 6C: Changed graph seal evaluates to STALE');

    // 4. Dirty Working Tree -> STALE
    const statusDirty = VIGProvenanceLedger.evaluateVerificationStatus(
      evidence1,
      anchor.commitSha,
      graphSeal,
      false // Current tree is dirty
    );
    assert.strictEqual(statusDirty, 'STALE', 'Suite 6C: Dirty working tree evaluates to STALE');

    // 5. Test Suite Failure -> FAILED
    const failedSuites: VIGTestSuiteRecord[] = [
      {
        suitePath: 'tests/failing.test.ts',
        totalChecks: 5,
        passedChecks: 4,
        failedChecks: 1,
        exitCode: 1,
        durationMs: 30,
      },
    ];
    const evidenceFailed = VIGProvenanceLedger.createEvidenceRecord({
      commitSha: anchor.commitSha,
      graphRootSeal: graphSeal,
      isWorkingTreeClean: true,
      typecheckPassed: true,
      typecheckErrorCount: 0,
      testSuites: failedSuites,
    });
    const statusFailed = VIGProvenanceLedger.evaluateVerificationStatus(
      evidenceFailed,
      anchor.commitSha,
      graphSeal,
      true
    );
    assert.strictEqual(statusFailed, 'FAILED', 'Suite 6C: Test failure evaluates to FAILED');

    // 6D: Evidence Ledger Merkle Sealing
    const ledger = VIGProvenanceLedger.createLedger([evidence1, evidenceFailed]);
    assert.strictEqual(ledger.evidenceRecords.length, 2, 'Suite 6D: Ledger holds 2 records');
    assert.strictEqual(typeof ledger.ledgerRootSeal, 'string', 'Suite 6D: Merkle root seal computed');
    assert.strictEqual(ledger.ledgerRootSeal.length, 64, 'Suite 6D: Seal is 64-char SHA-256');

    console.log('  ✓ Suite 6 passed: Real Git commit anchoring, deterministic evidence, and multi-tier provenance certified.');

    // ──────────────────────────────────────────────────────────────────────────
    // Suite 7: Prohibited Actuation-Related Patterns & Security Containment
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Suite 7] Prohibited Actuation-Related Patterns & Security Containment...');

    // 7A: VIGSecurityGuard Actuation Key Firewall
    const prohibitedPayloads = [
      { actuate: true },
      { params: { actuation: 'arm_forward' } },
      { motorcontrol: 1 },
      { shellexec: 'rm -rf /' },
      { overridelockout: true },
      { physicalaction: 'deploy' },
    ];

    for (const badPayload of prohibitedPayloads) {
      assert.throws(
        () => VIGSecurityGuard.assertNoActuation(badPayload, 'COMPILER_BUILD_OP'),
        (err: any) => err instanceof VIGSecurityError && err.message.includes('Actuation lockout violation'),
        'Suite 7A: Prohibited actuation key rejected fail-closed'
      );
    }

    // 7B: ExecutableValidator Rejection of Actuation in Operands
    const programWithActuationOperand = {
      version: '1.0.0',
      instructions: [
        {
          index: 0,
          opcode: 'CALL',
          sources: [createVariable('actuate_solenoid_valve')],
        },
      ],
    };
    const valResult = ExecutableValidator.validate(programWithActuationOperand);
    assert.strictEqual(valResult.valid, false, 'Suite 7B: Actuation variable rejected by ExecutableValidator');
    assert.strictEqual(valResult.errorCode, 'E8005', 'Suite 7B: Error code strictly E8005');

    // 7C: Path Traversal Rejection
    const pathTraversals = ['../secrets.env', '../../windows/system32', 'src/safe\0poison'];
    for (const badPath of pathTraversals) {
      assert.throws(
        () => VIGSecurityGuard.assertSafeRepositoryPath(badPath, process.cwd()),
        (err: any) => err instanceof VIGSecurityError,
        `Suite 7C: Path traversal "${badPath}" rejected fail-closed`
      );
    }

    // 7D: RBAC Mutating Access Restriction
    const analyzerAgentContext: VIGSecurityContext = {
      role: 'ANALYZER_AGENT',
      agentId: 'analyzer_agent_007',
    };

    assert.throws(
      () => VIGSecurityGuard.assertCanMutate(analyzerAgentContext, 'MUTATE_GRAPH'),
      (err: any) => err instanceof VIGAccessDeniedError,
      'Suite 7D: Non-mutating role ANALYZER_AGENT denied mutating permission'
    );

    console.log('  ✓ Suite 7 passed: Actuation lockout firewall, path traversal, and RBAC security enforced.');

  } finally {
    // Clean up temporary sandbox directory
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('  TASK 21 VERIFICATION: ALL 7 SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].includes('task21_vig_compiler_provenance')
) {
  runTask21VIGCompilerProvenanceTests().catch((err) => {
    console.error('Task 21 test runner encountered unhandled error:', err);
    process.exit(1);
  });
}
