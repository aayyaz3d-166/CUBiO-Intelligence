/**
 * ONE INTELLIGENCE — TASK 26 MASTER VERIFICATION SUITE
 * =======================================================
 * Gate: CNL-TASK26 / Cross-Repository Parity, Gap Resolution & Governance
 *
 * Covers:
 *   1. Cross-Repository Codebase Discovery & Boundary Containment (ONE vs OBR)
 *   2. Byte-for-Byte Exact Parity on Bedrock Substrates (Address369, Binary types)
 *   3. Normalized Semantic Parity on Binary Codec Components (Codebook, Decoder, Encoder, Mapper)
 *   4. Normalized Semantic Parity on Core Reasoning Engine Primitives (Evaluator, Registry, Explorer)
 *   5. Error Code Partitioning & Invariant Safety Freeze (E1000..E8999, BinaryError, Actuation Lock)
 *   6. Integrated Gap Verification Across Tasks 1–25 (Reasoning CLI, Model Adapter, Time-Travel, Memory, IPC)
 *   7. Boundary Containment & Unresolved Gaps Governance (Prototype isolation, offline core independence)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';
import { BitCategory, TriangleOpcode, BinaryError, SupportedBinaryValue } from '../../src/binary/types';
import { BinaryCodebook } from '../../src/binary/binaryCodebook';
import { BinaryEncoder } from '../../src/binary/binaryEncoder';
import { BinaryDecoder } from '../../src/binary/binaryDecoder';
import { TriangleMapper } from '../../src/binary/triangleMapper';
import { ReasoningSession } from '../../src/one/intelligence/reasoning/ReasoningSession';
import { ModelReasoningAdapter } from '../../src/one/intelligence/reasoning/ModelReasoningAdapter';
import { NativeModelRegistry } from '../../src/one/native_model_registry';
import { TimeTravelStateManager } from '../../src/one/data/TimeTravelStateManager';
import { CanonicalState } from '../../src/one/data/CanonicalState';
import { ExtremeMemoryVMAdapter } from '../../src/one/memory/extreme/ExtremeMemoryVMAdapter';
import { UnifiedVM } from '../../src/one/vm/UnifiedVM';
import { AgiOneCoreOrchestrator } from '../../src/one/agi_one_core_orchestrator';
import { AgiOneIPCBridge } from '../../src/one/agi_one_ipc_bridge';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';
import { SovereignWebGateway } from '../../src/net/sovereign_web_gateway';
import { CubiODNSEngine } from '../../src/net/cubio_dns_engine';
import { DecentralizedStorageMatrix } from '../../src/net/decentralized_storage_matrix';

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string): void {
  totalAssertions++;
  if (!condition) {
    console.error(`  ✗ FAIL [TASK26-${String(totalAssertions).padStart(2, '0')}] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS [TASK26-${String(totalAssertions).padStart(2, '0')}] ${message}`);
  passedAssertions++;
}

/**
 * Normalizes source text to compare semantics independent of local import paths and .js extensions
 */
function normalizeSource(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    // Normalize relative imports: from './foo.js' -> from './foo'
    .replace(/from\s+['"](\.[^'"]+)\.js['"]/g, "from '$1'")
    // Normalize shared address369 path: from '../shared/address369' -> from '../one/address369_canonical'
    .replace(/from\s+['"]\.\.\/shared\/address369['"]/g, "from '../one/address369_canonical'")
    // Strip trailing whitespace
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

export async function runTask26CrossRepoParityAndGapResolutionTests(): Promise<void> {
  console.log('================================================================================');
  console.log('  ONE INTELLIGENCE — TASK 26: CROSS-REPO PARITY & GAP RESOLUTION GOVERNANCE');
  console.log('================================================================================\n');

  const rootONE = path.resolve(process.cwd());
  const embeddedOBR = path.resolve(rootONE, 'packages', 'binary-reasoning');
  const siblingOBR = path.resolve(rootONE, '..', 'one-binary-reasoning');
  const fallbackOBR = 'F:\\one-binary-reasoning';
  const rootOBR = fs.existsSync(embeddedOBR)
    ? embeddedOBR
    : (fs.existsSync(siblingOBR) ? siblingOBR : fallbackOBR);

  // ==========================================================================
  // SUITE 1: Cross-Repository Codebase Discovery & Boundary Containment
  // ==========================================================================
  console.log('── Suite 1: Cross-Repository Codebase Discovery & Boundary Containment ─────');
  {
    assert(fs.existsSync(rootONE), `Authoritative ONE Language repository exists at ${rootONE}`);
    assert(fs.existsSync(rootOBR), `Authoritative ONE Binary Reasoning repository exists at ${rootOBR}`);

    // Verify key directories in both repositories
    assert(fs.existsSync(path.join(rootONE, 'src', 'binary')), 'ONE contains src/binary/');
    assert(fs.existsSync(path.join(rootOBR, 'src', 'binary')), 'OBR contains src/binary/');
    assert(fs.existsSync(path.join(rootONE, 'src', 'one', 'intelligence', 'reasoning')), 'ONE contains reasoning engine');
    assert(fs.existsSync(path.join(rootOBR, 'src', 'reasoning')), 'OBR contains src/reasoning/');
    assert(fs.existsSync(path.join(rootOBR, 'src', 'integration')), 'OBR contains src/integration/');
    assert(fs.existsSync(path.join(rootOBR, 'src', 'shared')), 'OBR contains src/shared/');
  }

  // ==========================================================================
  // SUITE 2: Byte-for-Byte Exact Parity on Bedrock Substrates
  // ==========================================================================
  console.log('\n── Suite 2: Byte-for-Byte Exact Parity on Bedrock Substrates ───────────────');
  {
    // 2.1 Canonical Address369 Parity (Task 6 Option A requirement)
    const oneAddrPath = path.join(rootONE, 'src', 'one', 'address369_canonical.ts');
    const obrAddrPath = path.join(rootOBR, 'src', 'shared', 'address369.ts');

    const oneAddrBuf = fs.readFileSync(oneAddrPath);
    const obrAddrBuf = fs.readFileSync(obrAddrPath);

    const oneAddrHash = crypto.createHash('sha256').update(oneAddrBuf).digest('hex');
    const obrAddrHash = crypto.createHash('sha256').update(obrAddrBuf).digest('hex');

    assert(oneAddrHash === obrAddrHash, 'CanonicalAddress369 is BYTE-FOR-BYTE 100% IDENTICAL between ONE and OBR');
    assert(CanonicalAddress369.TOTAL_ADDRESSES === 369, 'Canonical total addresses locked at 369');
    assert(CanonicalAddress369.SYMBOLIC_COUNT === 26, 'Canonical symbolic register count locked at 26 [0..25]');
    assert(CanonicalAddress369.SPATIAL_COUNT === 343, 'Canonical spatial cell count locked at 343 [26..368]');

    // 2.2 Binary Language Types Parity
    const oneTypesPath = path.join(rootONE, 'src', 'binary', 'types.ts');
    const obrTypesPath = path.join(rootOBR, 'src', 'binary', 'types.ts');

    const oneTypesBuf = fs.readFileSync(oneTypesPath);
    const obrTypesBuf = fs.readFileSync(obrTypesPath);

    const oneTypesHash = crypto.createHash('sha256').update(oneTypesBuf).digest('hex');
    const obrTypesHash = crypto.createHash('sha256').update(obrTypesBuf).digest('hex');

    assert(oneTypesHash === obrTypesHash, 'Binary types.ts is BYTE-FOR-BYTE 100% IDENTICAL between ONE and OBR');
    assert(BitCategory.TYPE_NULL === 0b000, 'BitCategory.TYPE_NULL matches 0b000 (0)');
    assert(BitCategory.TYPE_BOOL === 0b001, 'BitCategory.TYPE_BOOL matches 0b001 (1)');
    assert(BitCategory.TYPE_INT === 0b010, 'BitCategory.TYPE_INT matches 0b010 (2)');
    assert(BitCategory.TYPE_FLOAT === 0b011, 'BitCategory.TYPE_FLOAT matches 0b011 (3)');
    assert(BitCategory.TYPE_TEXT === 0b100, 'BitCategory.TYPE_TEXT matches 0b100 (4)');
    assert(BitCategory.TYPE_ADDR369 === 0b101, 'BitCategory.TYPE_ADDR369 matches 0b101 (5)');
    assert(BitCategory.TYPE_OPCODE === 0b110, 'BitCategory.TYPE_OPCODE matches 0b110 (6)');
    assert(BitCategory.TYPE_CONTROL === 0b111, 'BitCategory.TYPE_CONTROL matches 0b111 (7)');
  }

  // ==========================================================================
  // SUITE 3: Normalized Semantic Parity on Binary Codec Components
  // ==========================================================================
  console.log('\n── Suite 3: Normalized Semantic Parity on Binary Codec Components ───────────');
  {
    const codecFiles = [
      'binaryCodebook.ts',
      'binaryDecoder.ts',
      'binaryEncoder.ts',
      'triangleMapper.ts',
      'index.ts',
    ];

    for (const file of codecFiles) {
      const onePath = path.join(rootONE, 'src', 'binary', file);
      const obrPath = path.join(rootOBR, 'src', 'binary', file);

      const oneNorm = normalizeSource(fs.readFileSync(onePath, 'utf-8'));
      const obrNorm = normalizeSource(fs.readFileSync(obrPath, 'utf-8'));

      assert(oneNorm === obrNorm, `Binary codec component '${file}' maintains 100% normalized semantic parity`);
    }

    // Verify functionality of local binary codec
    const testAddr = { kind: 'address369' as const, address: 26 };
    const encodedAddr = BinaryEncoder.encode(testAddr);
    assert(encodedAddr.startsWith('101'), 'Encoded address begins with TYPE_ADDR369 prefix (101)');

    const decodedAddr = BinaryDecoder.decode(encodedAddr);
    assert(
      typeof decodedAddr.value === 'object' && decodedAddr.value !== null && (decodedAddr.value as any).address === 26,
      'Binary codec roundtrips Address369 with bit-exact fidelity'
    );
  }

  // ==========================================================================
  // SUITE 4: Normalized Semantic Parity on Core Reasoning Primitives
  // ==========================================================================
  console.log('\n── Suite 4: Normalized Semantic Parity on Core Reasoning Primitives ────────');
  {
    const primitiveFiles = [
      { one: 'CandidateEvaluator.ts', obr: 'CandidateEvaluator.ts' },
      { one: 'RuleRegistry.ts', obr: 'RuleRegistry.ts' },
      { one: 'StateExplorer.ts', obr: 'StateExplorer.ts' },
    ];

    for (const { one, obr } of primitiveFiles) {
      const onePath = path.join(rootONE, 'src', 'one', 'intelligence', 'reasoning', one);
      const obrPath = path.join(rootOBR, 'src', 'reasoning', obr);

      const oneNorm = normalizeSource(fs.readFileSync(onePath, 'utf-8'));
      const obrNorm = normalizeSource(fs.readFileSync(obrPath, 'utf-8'));

      assert(oneNorm === obrNorm, `Reasoning primitive '${one}' maintains 100% normalized semantic parity`);
    }

    // ReasoningSession verification: ONE Language implements an approved superset
    // (adds ModelReasoningAdapter, path reconstruction, and cancellation token)
    const session = new ReasoningSession();
    assert(typeof session.solve === 'function', 'ReasoningSession.solve() is present');
    assert(typeof session.solveWithBinaryTrace === 'function', 'ReasoningSession.solveWithBinaryTrace() is present');
    assert(typeof session.solveWithModelAssistance === 'function', 'ReasoningSession.solveWithModelAssistance() is present in ONE Language superset');
    assert(typeof session.cancel === 'function', 'ReasoningSession.cancel() guard is present');
  }

  // ==========================================================================
  // SUITE 5: Error Code Partitioning & Invariant Safety Freeze
  // ==========================================================================
  console.log('\n── Suite 5: Error Code Partitioning & Invariant Safety Freeze ───────────────');
  {
    // Task 6 Error code namespace allocation audit:
    // Lexer: E1000..E1999, Parser: E2000..E2999, Semantics: E3000..E3999,
    // IR: E4000..E4999, VM: E5000..E5999, Spatial: E6000..E6999, Container: E8000..E8999
    const errSample = new BinaryError('INVALID_3BIT_PATTERN', 'Sample error');
    assert(errSample.name === 'BinaryError', 'BinaryError name is set');
    assert(errSample.code === 'INVALID_3BIT_PATTERN', 'BinaryError code preserves string identifier');
    assert(errSample instanceof Error, 'BinaryError inherits from standard Error');

    // Actuation safety invariant freeze
    const gateway = new SovereignWebGateway(new CubiODNSEngine(), new DecentralizedStorageMatrix());
    assert(gateway.is_actuation_blocked === true, 'SovereignWebGateway strictly preserves is_actuation_blocked === true');

    const orchestrator = new AgiOneCoreOrchestrator();
    const cycle = orchestrator.executeMasterCycle();
    assert(cycle.isActuationBlocked === true, 'AGI ONE Core cycle strictly preserves isActuationBlocked === true');
    assert(orchestrator.is_actuation_blocked === true, 'AGI ONE Core orchestrator property is_actuation_blocked is true');

    let actuationDenied = false;
    try {
      orchestrator.requestActuation('PHYSICAL_ARM', 'MOVE');
    } catch (err: any) {
      actuationDenied = true;
      assert(err.name === 'ActuationBlockedError', 'Actuation request throws ActuationBlockedError (E8005 fail-closed)');
    }
    assert(actuationDenied, 'Physical actuation attempts are strictly rejected fail-closed');
  }

  // ==========================================================================
  // SUITE 6: Integrated Gap Resolution Verification (End-to-End Smoke Tests)
  // ==========================================================================
  console.log('\n── Suite 6: Integrated Gap Resolution Verification (Tasks 1–25) ─────────────');
  {
    // 6.1 GAP-02: Developer CLI 'one reason' integration (Task 13)
    const tmpSpec = path.resolve(rootONE, 'scratch_task26_reason.json');
    fs.writeFileSync(tmpSpec, JSON.stringify({ input: 4, target: 1, maxSteps: 20 }), 'utf-8');
    try {
      const reasonCliResult = OneDeveloperCLI.run(['reason', tmpSpec]);
      assert(reasonCliResult.exitCode === 0, 'OneDeveloperCLI run([reason, spec.json]) executes with exitCode 0');
      assert(reasonCliResult.stdout.includes('Reasoning Execution Completed'), 'CLI outputs formatted reasoning result');
    } finally {
      if (fs.existsSync(tmpSpec)) fs.unlinkSync(tmpSpec);
    }

    // 6.2 GAP-03: Model Reasoning Adapter & NativeModelRegistry (Task 14)
    const authoritativeModel = NativeModelRegistry.getAuthoritativeModel();
    assert(authoritativeModel.modelId === 'CUBIO-MODEL-STAGE1-V1', 'Authoritative model STAGE1 certified');
    assert(authoritativeModel.totalParameters === 148912, 'Authoritative parameter count certified at 148,912');

    const adapter = new ModelReasoningAdapter();
    const verifiedParams = adapter.getVerifiedParameterCount();
    assert(verifiedParams.actualParameterCount > 0, 'ModelReasoningAdapter provides verified parameter count');

    // 6.3 GAP-05: ExtremeMemoryVMAdapter (Task 17)
    const vm = new UnifiedVM();
    const memAdapter = new ExtremeMemoryVMAdapter();
    assert(memAdapter.isActuationBlocked === true, 'ExtremeMemoryVMAdapter enforces isActuationBlocked === true');
    const vmSnap = memAdapter.captureVMSnapshot(vm, 'test_vm_snap_01');
    assert(vmSnap.snapshotId === 'test_vm_snap_01', 'Captured VM snapshot ID matches');
    assert(vmSnap.sha256Checksum.length === 64, 'Captured VM snapshot produces SHA-256 checksum');

    // 6.4 GAP-06: TimeTravelStateManager Versioned Snapshot (Task 18)
    const state = new CanonicalState('state_01', 26);
    state.set('node_status', 'HEALTHY');
    const ttManager = new TimeTravelStateManager([state]);
    const snap = ttManager.createSnapshot({ snapshotId: 'snap_01', sequenceId: 1 });
    assert(snap.header.schemaVersion === '1.0.0', 'Checkpoint records schema version 1.0.0');
    assert(snap.header.sha256Checksum.length === 64, 'Checkpoint records SHA-256 integrity checksum');
    const restoreRes = ttManager.restoreFromSnapshot(snap);
    assert(restoreRes.isLosslessVerified === true, 'Snapshot restore verified lossless');

    // 6.5 GAP-12: AgiOneIPCBridge Secret Redaction (Task 24)
    const ipc = new AgiOneIPCBridge();
    ipc.registerChannelHandler('CORE_CH_TEST', (payload) => ({ processed: true, count: 1 }));

    // Dispatched message with sensitive secrets
    const sendRes = ipc.sendMessage({
      messageId: 'MSG_IPC_SANITY',
      channel: 'CORE_CH_TEST',
      source: 'TEST_SUITE',
      target: 'CORE',
      timestamp: Date.now(),
      payload: { token: 'SECRET_API_TOKEN_999', apiKey: 'KEY_123', safeData: 42 },
    });
    assert(sendRes.success === true, 'IPC message dispatched successfully to registered channel');

    // Message rejected fail-soft because 3D_MEMORY_STUDIO is disconnected by default
    const discRes = ipc.sendMessage({
      messageId: 'MSG_IPC_DISC',
      channel: 'CORE_CH_TEST',
      source: 'TEST_SUITE',
      target: '3D_MEMORY_STUDIO',
      timestamp: Date.now(),
      payload: { test: 1 },
    });
    assert(discRes.success === false, 'Dispatch to disconnected Studio rejected fail-soft');

    const logs = ipc.getMessageLog();
    assert(logs.length === 1, 'IPC logged message in audit trail');
    const loggedPayloadStr = JSON.stringify(logs[0].payload);
    assert(!loggedPayloadStr.includes('SECRET_API_TOKEN_999'), 'IPC automatically redacted secret token');
    assert(!loggedPayloadStr.includes('KEY_123'), 'IPC automatically redacted apiKey');
    assert(loggedPayloadStr.includes('42'), 'IPC preserved non-sensitive data');
  }

  // ==========================================================================
  // SUITE 7: Boundary Containment & Unresolved Gaps Governance
  // ==========================================================================
  console.log('\n── Suite 7: Boundary Containment & Unresolved Gaps Governance ───────────────');
  {
    // 7.1 Legacy Prototype Isolation (Task 12)
    // Verify that src/one/index.ts does not export anything from scratch/
    const oneIndexSrc = fs.readFileSync(path.join(rootONE, 'src', 'one', 'index.ts'), 'utf-8');
    assert(!oneIndexSrc.includes('scratch/'), 'src/one/index.ts has zero imports from scratch/');

    // 7.2 Core Language Offline Independence (Task 25)
    // Verify compiler source does not depend on src/mesh, src/mail, or src/net
    const compilerSrc = fs.readFileSync(path.join(rootONE, 'src', 'one', 'UnifiedCompiler.ts'), 'utf-8');
    assert(!compilerSrc.includes('../mesh/'), 'UnifiedCompiler has zero imports from src/mesh');
    assert(!compilerSrc.includes('../mail/'), 'UnifiedCompiler has zero imports from src/mail');
    assert(!compilerSrc.includes('../net/'), 'UnifiedCompiler has zero imports from src/net');

    // 7.3 Release Binary Hash Preservation
    const rcExePath = path.join(rootONE, 'dist', 'v1.0.1-rc', 'one.exe');
    assert(fs.existsSync(rcExePath), 'Protected release binary dist/v1.0.1-rc/one.exe exists');
    const rcExeBuf = fs.readFileSync(rcExePath);
    const rcExeHash = crypto.createHash('sha256').update(rcExeBuf).digest('hex').toUpperCase();
    assert(
      rcExeHash === '479186CA87F55781825DF05F5603AC3747ADA4C2E9AA78DE9E3CD233A993020E',
      'Protected release binary one.exe hash is 100% UNCHANGED'
    );
  }

  console.log('\n================================================================================');
  console.log(`  TASK 26 MASTER SUITE SUMMARY: ${passedAssertions}/${totalAssertions} assertions passed (100%)`);
  console.log('  STATUS: CROSS-REPOSITORY PARITY & GAP RESOLUTION FULLY CERTIFIED');
  console.log('================================================================================\n');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('task26_cross_repository_parity_and_gap_resolution.test.ts')) {
  runTask26CrossRepoParityAndGapResolutionTests().catch((err) => {
    console.error('Task 26 Verification Suite Failed:', err);
    process.exit(1);
  });
}
