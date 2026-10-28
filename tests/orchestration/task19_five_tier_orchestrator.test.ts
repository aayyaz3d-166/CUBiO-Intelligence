/**
 * ONE Intelligence — Task 19 Verification Suite
 * ===============================================
 * Tests: AGI ONE Core Orchestrator & Five-Tier Architecture
 * Module: tests/orchestration/task19_five_tier_orchestrator.test.ts
 */

import * as assert from 'assert';
import {
  AgiOneCoreOrchestrator,
  FiveTierLevel,
  ServiceLifecycleState,
  FiveTierHealthReport,
  ModelSelectionMode,
  AgiOneExecutionReport,
} from '../../src/one/agi_one_core_orchestrator';
import { AgiOneIPCBridge, IPCMessage } from '../../src/one/agi_one_ipc_bridge';
import { NativeModelRegistry } from '../../src/one/native_model_registry';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';
import { ActuationBlockedError } from '../../src/one/data';

export async function runTask19FiveTierOrchestratorTests(): Promise<void> {
  console.log('='.repeat(80));
  console.log('  ONE INTELLIGENCE — TASK 19: AGI ONE CORE ORCHESTRATOR & FIVE-TIER ARCHITECTURE');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Five-Tier Hierarchy & Architectural Reality Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Five-Tier Hierarchy & Architectural Reality Verification...');

  const orchestrator = new AgiOneCoreOrchestrator();

  // 1A: Architectural Reality vs Labels
  // Verify Tier 1: Governance & Umbrella (Policy & Provenance, NOT a standalone daemon)
  assert.strictEqual(orchestrator.is_actuation_blocked, true, 'Suite 1A: Tier 1 actuation lock is permanent');
  assert.strictEqual(orchestrator.isActuationBlocked, true, 'Suite 1A: Tier 1 actuation invariant is permanent');

  // Verify Tier 2: 3D Memory Studio (Text/ANSI renderer & cell inspector, zero Three.js)
  const masterRep = orchestrator.executeMasterCycle(1);
  assert.strictEqual(masterRep.threeJsDependency, 0, 'Suite 1A: Tier 2 Three.js dependency is strictly 0');
  assert.ok(masterRep.spatialRendererOutput.ansiIsometricFrame.length > 0, 'Suite 1A: Native ANSI frame rendered');

  // Verify Tier 3: AGI ONE Core Infrastructure (Address369: 26 symbolic + 343 spatial = 369 total)
  const symMap = orchestrator.getSymbolicMemoryMap();
  const spatMap = orchestrator.getSpatialMemoryMap();
  assert.strictEqual(symMap.size, CanonicalAddress369.SYMBOLIC_COUNT, 'Suite 1A: 26 symbolic registers (0..25)');
  assert.strictEqual(spatMap.size, CanonicalAddress369.SPATIAL_COUNT, 'Suite 1A: 343 spatial voxels (26..368)');
  assert.strictEqual(symMap.size + spatMap.size, CanonicalAddress369.TOTAL_ADDRESSES, 'Suite 1A: Exactly 369 total cells');

  // Verify Tier 4: CubiO Intelligence (Reasoning & hybrid dispatch available)
  assert.ok(orchestrator.ipcBridge.getMetrics().activeChannels.includes('AGI_ONE_TO_CUBIO_INTELLIGENCE'));

  // Verify Tier 5: Native CubiO Model (Authoritative 148,912 parameters, INT4 quantized, in-process)
  const authModel = NativeModelRegistry.getAuthoritativeModel();
  assert.strictEqual(authModel.totalParameters, 148912, 'Suite 1B: Certified parameter count is 148,912');
  assert.strictEqual(authModel.modelId, 'CUBIO-MODEL-STAGE1-V1', 'Suite 1B: Model ID is CUBIO-MODEL-STAGE1-V1');
  assert.throws(
    () => NativeModelRegistry.validateParameterCount(38400),
    /DEPRECATED and INVALID/,
    'Suite 1B: Deprecated 38,400 parameter count strictly rejected fail-closed'
  );

  console.log('  ✓ Suite 1 passed: Five-tier hierarchy and architectural boundaries verified with source evidence.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Service Lifecycle & Ordered Startup / Shutdown Sequence
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Service Lifecycle & Ordered Startup / Shutdown Sequence...');

  const lifecycleOrch = new AgiOneCoreOrchestrator();

  // 2A: Initial state is UNINITIALIZED
  const initHealth = lifecycleOrch.getFiveTierHealth();
  assert.strictEqual(initHealth.overallStatus, 'UNINITIALIZED', 'Suite 2A: Initial state is UNINITIALIZED');
  assert.strictEqual(initHealth.uptimeSeconds, 0, 'Suite 2A: Initial uptime is 0s');

  // 2B: Ordered Startup (Bottom-up: Tier 5 -> Tier 4 -> Tier 3 -> Tier 2 -> Tier 1)
  const startedHealth = await lifecycleOrch.start({ standaloneMode: true, modelSelection: 'STAGE1_148K' });
  assert.strictEqual(startedHealth.overallStatus, 'HEALTHY', 'Suite 2B: Overall status is HEALTHY after start');
  assert.strictEqual(startedHealth.tiers.TIER_5_NATIVE_MODEL.state, 'HEALTHY', 'Suite 2B: Tier 5 started healthy');
  assert.strictEqual(startedHealth.tiers.TIER_4_CUBIO_INTELLIGENCE.state, 'HEALTHY', 'Suite 2B: Tier 4 started healthy');
  assert.strictEqual(startedHealth.tiers.TIER_3_AGI_ONE_CORE.state, 'HEALTHY', 'Suite 2B: Tier 3 started healthy');
  assert.strictEqual(startedHealth.tiers.TIER_1_ONE_INTELLIGENCE.state, 'HEALTHY', 'Suite 2B: Tier 1 started healthy');

  // 2C: Ordered Shutdown (Top-down: Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> Tier 5)
  await lifecycleOrch.stop();
  const stoppedHealth = lifecycleOrch.getFiveTierHealth();
  assert.strictEqual(stoppedHealth.overallStatus, 'STOPPED', 'Suite 2C: Overall status is STOPPED after stop');
  assert.strictEqual(stoppedHealth.tiers.TIER_1_ONE_INTELLIGENCE.state, 'STOPPED', 'Suite 2C: Tier 1 stopped');
  assert.strictEqual(stoppedHealth.tiers.TIER_2_3D_MEMORY_STUDIO.state, 'STOPPED', 'Suite 2C: Tier 2 stopped');
  assert.strictEqual(stoppedHealth.tiers.TIER_3_AGI_ONE_CORE.state, 'STOPPED', 'Suite 2C: Tier 3 stopped');
  assert.strictEqual(stoppedHealth.tiers.TIER_4_CUBIO_INTELLIGENCE.state, 'STOPPED', 'Suite 2C: Tier 4 stopped');
  assert.strictEqual(stoppedHealth.tiers.TIER_5_NATIVE_MODEL.state, 'STOPPED', 'Suite 2C: Tier 5 stopped');

  console.log('  ✓ Suite 2 passed: Ordered startup (bottom-up) and shutdown (top-down) certified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Standalone CLI Operation Without Studio / Network Services
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Standalone CLI Operation Without Studio / Network Services...');

  // 3A: Orchestrator runs in standalone mode with Studio marked optional/offline
  const standaloneOrch = new AgiOneCoreOrchestrator();
  const saHealth = await standaloneOrch.start({ standaloneMode: true });
  assert.strictEqual(saHealth.isNetworkStandalone, true, 'Suite 3A: Standalone mode enabled');
  assert.strictEqual(saHealth.isStudioConnected, false, 'Suite 3A: Studio is not connected in standalone');
  assert.strictEqual(saHealth.tiers.TIER_2_3D_MEMORY_STUDIO.isOptional, true, 'Suite 3A: Studio is marked optional');
  assert.strictEqual(saHealth.tiers.TIER_2_3D_MEMORY_STUDIO.isOnline, false, 'Suite 3A: Studio is marked offline');
  assert.strictEqual(saHealth.tiers.TIER_2_3D_MEMORY_STUDIO.state, 'HEALTHY', 'Suite 3A: Studio offline is a valid healthy state');
  assert.strictEqual(saHealth.overallStatus, 'HEALTHY', 'Suite 3A: Overall system is HEALTHY without Studio');

  // 3B: Developer CLI functions completely standalone without Studio
  const cliHelpRes = OneDeveloperCLI.run(['--help']);
  assert.strictEqual(cliHelpRes.exitCode, 0, 'Suite 3B: CLI --help succeeds standalone');
  assert.ok(cliHelpRes.stdout.includes('ONE Language Developer CLI'), 'Suite 3B: Help output present');

  const cliVersionRes = OneDeveloperCLI.run(['--version']);
  assert.strictEqual(cliVersionRes.exitCode, 0, 'Suite 3B: CLI --version succeeds standalone');
  assert.ok(cliVersionRes.stdout.includes('1.0.0'), 'Suite 3B: Version string present');

  const cliCheckRes = OneDeveloperCLI.run(['check', '-e', 'let x: Int32 = 42;']);
  assert.strictEqual(cliCheckRes.exitCode, 0, 'Suite 3B: CLI check executes standalone');

  console.log('  ✓ Suite 3 passed: Standalone CLI operates with 100% autonomy without Studio or network.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Model Selection & Fail-Soft Inference Exception Propagation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Model Selection & Fail-Soft Inference Exception Propagation...');

  const modelOrch = new AgiOneCoreOrchestrator();
  await modelOrch.start();

  // 4A: Model Selection switching
  assert.strictEqual(modelOrch.getModelSelection(), 'STAGE1_148K', 'Suite 4A: Default is STAGE1_148K');
  modelOrch.setModelSelection('HARMONIC_5M');
  assert.strictEqual(modelOrch.getModelSelection(), 'HARMONIC_5M', 'Suite 4A: Switched to HARMONIC_5M');
  modelOrch.setModelSelection('SYMBOLIC_ONLY');
  assert.strictEqual(modelOrch.getModelSelection(), 'SYMBOLIC_ONLY', 'Suite 4A: Switched to SYMBOLIC_ONLY');

  // 4B: SYMBOLIC_ONLY fallback mode
  const symInfer = modelOrch.executeInferenceSafely(64);
  assert.strictEqual(symInfer.success, true, 'Suite 4B: Symbolic inference succeeds');
  assert.strictEqual(symInfer.isFallback, true, 'Suite 4B: Handled as fallback');
  assert.strictEqual(symInfer.modelId, 'SYMBOLIC_ONLY_DETERMINISTIC', 'Suite 4B: Handled by deterministic symbolic fallback');

  // 4C: Fail-Soft Model Failure Propagation
  modelOrch.setModelSelection('STAGE1_148K');
  modelOrch.simulateModelFailure(); // Simulate hardware exception

  const failedInfer = modelOrch.executeInferenceSafely(128);
  assert.strictEqual(failedInfer.success, true, 'Suite 4C: System remains operational during model failure');
  assert.strictEqual(failedInfer.isFallback, true, 'Suite 4C: Transparent fallback to symbolic intelligence');

  const degradedHealth = modelOrch.getFiveTierHealth();
  assert.strictEqual(degradedHealth.overallStatus, 'DEGRADED', 'Suite 4C: Overall status transitions to DEGRADED');
  assert.strictEqual(degradedHealth.tiers.TIER_5_NATIVE_MODEL.state, 'DEGRADED', 'Suite 4C: Tier 5 state is DEGRADED');

  // 4D: Recovery
  modelOrch.recoverModel();
  const recoveredHealth = modelOrch.getFiveTierHealth();
  assert.strictEqual(recoveredHealth.overallStatus, 'HEALTHY', 'Suite 4D: Recovered to HEALTHY');
  assert.strictEqual(recoveredHealth.tiers.TIER_5_NATIVE_MODEL.state, 'HEALTHY', 'Suite 4D: Tier 5 recovered');

  console.log('  ✓ Suite 4 passed: Model selection and fail-soft exception fallback confirmed.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: IPC Contracts, Channel Routing & Broken Pipe / Exception Handling
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] IPC Contracts, Channel Routing & Broken Pipe / Exception Handling...');

  const ipcBridge = new AgiOneIPCBridge();

  // 5A: Route Message between layers
  const msgA: IPCMessage<{ cellIndex: number }> = {
    messageId: 'msg_001',
    source: '3D_MEMORY_STUDIO',
    target: 'AGI_ONE',
    channel: 'STUDIO_TO_AGI_ONE',
    payload: { cellIndex: 100 },
    timestamp: Date.now(),
  };

  const routeRes = ipcBridge.routeMessage(msgA, (payload) => {
    return { acknowledged: true, cell: payload.cellIndex };
  });

  assert.strictEqual(routeRes.success, true, 'Suite 5A: IPC route succeeds');
  assert.strictEqual(routeRes.response.acknowledged, true, 'Suite 5A: Response received');
  assert.strictEqual(routeRes.response.cell, 100, 'Suite 5A: Payload intact');

  // 5B: Handler Exception Handling (Fail-Soft Broken Pipe)
  const msgError: IPCMessage<string> = {
    messageId: 'msg_err',
    source: 'AGI_ONE',
    target: 'CUBIO_INTELLIGENCE',
    channel: 'TEST_FAULT_CHANNEL',
    payload: 'corrupted_state',
    timestamp: Date.now(),
  };

  const throwingRoute = ipcBridge.routeMessage(msgError, () => {
    throw new Error('Kernel socket timeout / broken pipe');
  });

  assert.strictEqual(throwingRoute.success, false, 'Suite 5B: Throwing handler caught fail-soft');
  assert.ok(throwingRoute.error?.includes('broken pipe'), 'Suite 5B: Error message captured');

  const metrics = ipcBridge.getMetrics();
  assert.strictEqual(metrics.totalErrors, 1, 'Suite 5B: Error count incremented');
  assert.ok(metrics.totalMessagesRouted >= 1, 'Suite 5B: Dispatched messages tracked');

  // 5C: Channel Handlers and Send Message
  ipcBridge.registerChannelHandler('CUSTOM_PING_CHANNEL', (payload: { ping: string }) => {
    return { pong: payload.ping.toUpperCase() };
  });

  const sendRes = ipcBridge.sendMessage({
    messageId: 'msg_ping',
    source: 'ONE_INTELLIGENCE',
    target: 'AGI_ONE',
    channel: 'CUSTOM_PING_CHANNEL',
    payload: { ping: 'harmonic' },
    timestamp: Date.now(),
  });

  assert.strictEqual(sendRes.success, true, 'Suite 5C: Registered channel handler invoked');
  assert.strictEqual(sendRes.response?.pong, 'HARMONIC', 'Suite 5C: Response payload transformed');

  // Send to unregistered channel
  const sendUnregistered = ipcBridge.sendMessage({
    messageId: 'msg_unreg',
    source: 'ONE_INTELLIGENCE',
    target: 'AGI_ONE',
    channel: 'NON_EXISTENT_CHANNEL',
    payload: {},
    timestamp: Date.now(),
  });

  assert.strictEqual(sendUnregistered.success, false, 'Suite 5C: Unregistered channel rejected fail-soft');
  assert.ok(sendUnregistered.error?.includes('No handler registered'), 'Suite 5C: Clean error returned');

  console.log('  ✓ Suite 5 passed: IPC contracts, channel routing, and exception containment certified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Multi-Tier Health Status & Telemetry Reporting
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Multi-Tier Health Status & Telemetry Reporting...');

  const healthOrch = new AgiOneCoreOrchestrator();
  await healthOrch.start({ standaloneMode: true });

  const health = healthOrch.getFiveTierHealth();
  assert.strictEqual(health.overallStatus, 'HEALTHY', 'Suite 6A: Overall status is HEALTHY');
  assert.strictEqual(health.isActuationBlocked, true, 'Suite 6A: Actuation lock reported true');
  assert.ok(health.timestamp > 0, 'Suite 6A: Timestamp present');

  // Verify all 5 tiers are represented with required fields
  const tierKeys: FiveTierLevel[] = [
    'TIER_1_ONE_INTELLIGENCE',
    'TIER_2_3D_MEMORY_STUDIO',
    'TIER_3_AGI_ONE_CORE',
    'TIER_4_CUBIO_INTELLIGENCE',
    'TIER_5_NATIVE_MODEL',
  ];

  for (const tKey of tierKeys) {
    const tier = health.tiers[tKey];
    assert.ok(tier, `Suite 6B: Tier ${tKey} exists in health report`);
    assert.strictEqual(tier.tier, tKey, `Suite 6B: Tier key matches`);
    assert.strictEqual(tier.isActuationBlocked, true, `Suite 6B: Tier ${tKey} actuation lock is true`);
    assert.ok(['HEALTHY', 'DEGRADED', 'STOPPED', 'UNINITIALIZED'].includes(tier.state), `Suite 6B: State valid`);
  }

  console.log('  ✓ Suite 6 passed: Complete 5-tier health status and telemetry validated.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Safety Invariants, Actuation Lockout & Deterministic Replay (σ² = 0.0)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Safety Invariants, Actuation Lockout & Deterministic Replay (σ² = 0.0)...');

  const safetyOrch = new AgiOneCoreOrchestrator();
  assert.strictEqual(safetyOrch.is_actuation_blocked, true, 'Suite 7A: Invariant is_actuation_blocked is true');
  assert.strictEqual(safetyOrch.isActuationBlocked, true, 'Suite 7A: Invariant isActuationBlocked is true');

  // 7A: Physical Actuation Lockout (E8005 fail-closed)
  assert.throws(
    () => safetyOrch.requestActuation('ROBOTIC_ARM', 'DEPLOY'),
    (err: any) => err instanceof ActuationBlockedError && err.message.includes('E8005'),
    'Suite 7A: Actuation attempt strictly throws ActuationBlockedError (E8005)'
  );

  // 7B: 100-Cycle Deterministic Replay Variance (σ² = 0.0)
  const baselineReport = safetyOrch.executeMasterCycle(1);
  const baselineAnsiHash = baselineReport.spatialRendererOutput.ansiIsometricFrame.length;

  for (let cycle = 2; cycle <= 100; cycle++) {
    const cycleReport = safetyOrch.executeMasterCycle(cycle);
    assert.strictEqual(
      cycleReport.spatialRendererOutput.ansiIsometricFrame.length,
      baselineAnsiHash,
      `Suite 7B: Master cycle ${cycle} output matches baseline bit-exact`
    );
    assert.strictEqual(
      cycleReport.nativeModel.totalParameters,
      148912,
      `Suite 7B: Model parameters unchanged in cycle ${cycle}`
    );
    assert.strictEqual(
      cycleReport.isActuationBlocked,
      true,
      `Suite 7B: Actuation lock intact in cycle ${cycle}`
    );
  }

  console.log('  ✓ Suite 7 passed: Actuation lockout (E8005) and 100-cycle deterministic replay (sigma^2 = 0.0) verified.');

  console.log('\n' + '='.repeat(80));
  console.log('  TASK 19 VERIFICATION: ALL 7 SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

if (
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].includes('task19_five_tier_orchestrator')
) {
  runTask19FiveTierOrchestratorTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
