/**
 * CUBiO AI — ONE LANGUAGE — TASK 03
 * =================================
 * Native Memory API & Tooling Verification Suite
 *
 * Validates STORE, LOAD, REFERENCE, UPDATE, CACHE, PAGE, and EVICT primitives,
 * VDB vector similarity search, Optimistic Concurrency Control (OCC),
 * Native Tool Registry, Tool Adapters, Tool Composition, ToolFastCache,
 * and 100-cycle bit-exact determinism (sigma^2 = 0.0).
 */

import {
  NativeMemoryAPI,
  NativeVDB,
  OCCManager,
  MemoryCache,
  MemoryPageManager,
  NativeToolRegistry,
  ReasoningToolAdapter,
  SimulationToolAdapter,
  KnowledgeToolAdapter,
  MultimodalToolAdapter,
  TrainingToolAdapter,
  MemoryToolAdapter,
  ToolComposer,
  ToolFastCache,
  createInt,
  createFloat,
  createString,
  createBool,
  createArray,
  createRecord,
  NativeExecutionModel,
} from '../../../src/one';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion Failure: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTask03VerificationSuite(): Promise<void> {
  console.log('================================================================================');
  console.log(' 🧠 CUBiO AI — ONE LANGUAGE — TASK 03: NATIVE MEMORY API & TOOLING');
  console.log('================================================================================\n');

  // ===========================================================================
  // Gate 1: Native Memory Primitives (STORE, LOAD, CACHE, EVICT)
  // ===========================================================================
  console.log('[Gate 1] Verifying STORE, LOAD, CACHE, and EVICT Primitives...');
  const mem = new NativeMemoryAPI();

  // 1. STORE
  const payload1 = createRecord({ name: createString('Alpha'), value: createInt(42) });
  const vec1 = [1.0, 0.0, 0.5];
  const info1 = mem.store('record_01', payload1, vec1, 100);
  assert(info1.id === 'record_01', 'Stored record ID matches');
  assert(info1.version === 1, 'Initial record version is 1');
  assert(info1.canonicalAddress === 100, 'Canonical address indexed properly');
  assert(info1.stateHash.startsWith('0xVDB_'), 'Record state hash generated');

  // 2. LOAD (L1 Cache Hit)
  const loaded1 = mem.load('record_01');
  assert(loaded1 !== undefined, 'Record loaded from memory');
  assert((loaded1 as any).value.name.value === 'Alpha', 'Loaded record payload intact');

  // 3. EVICT from L1 Cache & LOAD from L2 VDB (with Auto-Promotion)
  const evicted = mem.evict('record_01');
  assert(evicted === true, 'Record evicted from L1 cache');
  const cacheMetricsAfterEvict = mem.getCache().getMetrics();
  assert(cacheMetricsAfterEvict.size === 0, 'L1 cache entry count is 0 after eviction');

  // Load again -> fallback to VDB -> promotes back to cache
  const loadedFromVDB = mem.load('record_01');
  assert(loadedFromVDB !== undefined, 'Record loaded from L2 VDB fallback');
  assert((loadedFromVDB as any).value.value.value === 42, 'Payload from VDB matches');
  assert(mem.getCache().has('record_01'), 'Record was automatically promoted back to L1 cache');

  // 4. CACHE primitive with Pinned entry
  const cachedVal = createString('PinnedConstant');
  mem.cacheValue('pinned_key', cachedVal, 64, true);
  assert(mem.getCache().has('pinned_key'), 'Pinned value exists in cache');
  let caughtPinError = false;
  try {
    mem.evict('pinned_key');
  } catch (err: any) {
    caughtPinError = true;
    assert(err.message.includes('Cannot evict pinned'), 'Pinned eviction rejected with safety error');
  }
  assert(caughtPinError, 'EVICT on pinned entry safely blocked');

  console.log('  Gate 1 Passed: STORE, LOAD, CACHE, and EVICT primitives verified.\n');

  // ===========================================================================
  // Gate 2: Optimistic Concurrency Control (OCC) & Atomic UPDATE
  // ===========================================================================
  console.log('[Gate 2] Verifying Optimistic Concurrency Control (OCC) & Atomic UPDATE...');

  // 1. Successful UPDATE with version bump
  const newPayload = createRecord({ name: createString('Alpha-Updated'), value: createInt(99) });
  const updateInfo = mem.update('record_01', newPayload, [1.0, 0.2, 0.5], 1);
  assert(updateInfo.version === 2, 'UPDATE bumped record version to 2');
  assert(mem.getOCCManager().getVersion('record_01') === 2, 'OCC manager records version 2');

  // 2. Conflicting UPDATE rejection
  let occConflictCaught = false;
  try {
    // Attempt update with stale version 1
    mem.update('record_01', newPayload, undefined, 1);
  } catch (err: any) {
    occConflictCaught = true;
    assert(err.message.includes('OCC'), 'OCC conflict detected on stale version');
  }
  assert(occConflictCaught, 'Conflicting concurrent update rejected fail-closed');

  // 3. OCC Transaction validation
  const occ = mem.getOCCManager();
  const tx = occ.beginTransaction('tx_test_01');
  occ.recordRead('tx_test_01', 'record_01'); // Reads v2
  occ.stageWrite('tx_test_01', 'record_01', newPayload);
  const validation = occ.validate('tx_test_01');
  assert(validation.valid === true, 'OCC transaction validated with matching version');
  occ.commit('tx_test_01'); // Bumps to v3
  assert(occ.getVersion('record_01') === 3, 'OCC transaction commit bumped version to 3');

  console.log('  Gate 2 Passed: OCC concurrency control & atomic UPDATE verified.\n');

  // ===========================================================================
  // Gate 3: Paged Memory Manager (PAGE Primitive)
  // ===========================================================================
  console.log('[Gate 3] Verifying Paged Memory Manager (PAGE Primitive)...');

  const page = mem.allocatePage([26, 35], false);
  assert(page.pageId === 0, 'First allocated page ID is 0');
  assert(page.pageSizeBytes === 65536, 'Page size is standard 64 KB (65,536 bytes)');
  assert(page.canonicalAddressRange[0] === 26, 'Canonical address range start is 26');

  // Write & Read data into page
  const sampleBytes = new Uint8Array([0x36, 0x09, 0x42, 0xFF, 0xAA]);
  mem.getPageManager().writePage(page.pageId, 1024, sampleBytes);
  const readBack = mem.getPageManager().readPage(page.pageId, 1024, sampleBytes.length);
  assert(readBack[0] === 0x36 && readBack[1] === 0x09, 'Data read back matches written byte pattern');

  // Bounds check violation
  let pageOobCaught = false;
  try {
    mem.getPageManager().writePage(page.pageId, 65530, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  } catch (err: any) {
    pageOobCaught = true;
    assert(err.message.includes('out of bounds'), 'Page out of bounds caught');
  }
  assert(pageOobCaught, 'Page buffer overflow attempt safely rejected');

  console.log('  Gate 3 Passed: Paged memory manager verified.\n');

  // ===========================================================================
  // Gate 4: Vector Similarity Search & Spatial Anchoring (VDB)
  // ===========================================================================
  console.log('[Gate 4] Verifying Vector Similarity Search & Spatial Anchoring (VDB)...');
  const testVDB = new NativeVDB();

  // Insert distinct vectors
  testVDB.insert('target_vec', [1.0, 0.0, 0.0], createString('Target'), 200);
  testVDB.insert('close_vec', [0.95, 0.05, 0.0], createString('CloseNeighbor'));
  testVDB.insert('far_vec', [0.0, 1.0, 0.0], createString('OrthogonalFar'));

  // Search similarity
  const searchResults = testVDB.search([1.0, 0.0, 0.0], 3);
  assert(searchResults.length === 3, 'VDB search returned 3 results');
  assert(searchResults[0].record.id === 'target_vec', 'Nearest neighbor is target vector (similarity 1.0)');
  assert(Math.abs(searchResults[0].similarity - 1.0) < 1e-6, 'Identical vector similarity is 1.0');
  assert(searchResults[1].record.id === 'close_vec', 'Second nearest is close neighbor');
  assert(searchResults[1].similarity > 0.9, 'Close neighbor similarity is > 0.9');
  assert(Math.abs(searchResults[2].similarity - 0.0) < 1e-6, 'Orthogonal vector similarity is 0.0');

  // Lookup by Canonical Address
  const recordByAddr = testVDB.getByAddress(200);
  assert(recordByAddr !== undefined, 'Record retrieved by Canonical Address 200');
  assert(recordByAddr?.id === 'target_vec', 'Address lookup retrieved correct record');

  console.log('  Gate 4 Passed: Vector similarity search & spatial indexing verified.\n');

  // ===========================================================================
  // Gate 5: Native Tool Registry & Existing Engine Adapters
  // ===========================================================================
  console.log('[Gate 5] Verifying Native Tool Registry & Adapters...');
  const registry = NativeToolRegistry.getInstance();
  registry.clear();

  // Register all 6 adapters
  registry.registerTool(new ReasoningToolAdapter());
  registry.registerTool(new SimulationToolAdapter());
  registry.registerTool(new KnowledgeToolAdapter());
  registry.registerTool(new MultimodalToolAdapter());
  registry.registerTool(new TrainingToolAdapter());
  registry.registerTool(new MemoryToolAdapter(mem));

  assert(registry.count() === 6, 'All 6 native tool adapters registered');
  assert(registry.hasTool('cubio:reasoning'), 'cubio:reasoning tool exists');
  assert(registry.hasTool('cubio:simulation'), 'cubio:simulation tool exists');
  assert(registry.hasTool('cubio:multimodal'), 'cubio:multimodal tool exists');
  assert(registry.hasTool('cubio:training'), 'cubio:training tool exists');

  const simTool = registry.getTool('cubio:simulation')!;
  const simResp = simTool.execute(
    { seed: createInt(369), cx: createInt(0), cy: createInt(0), cz: createInt(0) },
    { caller: 'test', timestamp: Date.now(), memoryAPI: mem }
  );
  assert(simResp.success === true, 'Simulation tool executed successfully');
  assert((simResp.result as any).value.cellsCount.value === 343, 'Simulation produced 343 spatial voxel cells');

  const mmTool = registry.getTool('cubio:multimodal')!;
  const mmResp = mmTool.execute(
    { promptTokenCount: createInt(256), maxOutputTokens: createInt(64) },
    { caller: 'test', timestamp: Date.now(), memoryAPI: mem }
  );
  assert(mmResp.success === true, 'Multimodal tool executed successfully');
  assert((mmResp.result as any).value.paramCount.value === 148912, 'Authoritative parameter count verified (148,912)');

  const trainTool = registry.getTool('cubio:training')!;
  const trainResp = trainTool.execute(
    { method: createString('DPO'), beta: createFloat(0.1) },
    { caller: 'test', timestamp: Date.now(), memoryAPI: mem }
  );
  assert(trainResp.success === true, 'Training tool executed successfully');
  assert((trainResp.result as any).value.status.value === 'DPO_ALIGNMENT_CERTIFIED', 'DPO alignment certified');

  console.log('  Gate 5 Passed: Native tool registry & adapters verified.\n');

  // ===========================================================================
  // Gate 6: Tool Composition Pipeline & ToolFastCache
  // ===========================================================================
  console.log('[Gate 6] Verifying Tool Composition Pipeline & Fast Cache...');

  // Sequential composition: Reasoning -> Memory Store
  const reasoningTool = registry.getTool('cubio:reasoning')!;
  const memoryTool = registry.getTool('cubio:memory')!;

  const pipelineResult = ToolComposer.executeSequential(
    [
      { tool: reasoningTool, staticParams: { mode: createString('SPATIAL') } },
      {
        tool: memoryTool,
        parameterMapper: (prev) => ({
          action: createString('STORE'),
          id: createString('deduced_facts'),
          payload: prev,
        }),
      },
    ],
    {},
    { caller: 'test_pipeline', timestamp: Date.now(), memoryAPI: mem }
  );

  assert(pipelineResult.success === true, 'Sequential composition pipeline executed successfully');
  assert(pipelineResult.stepResults.length === 2, '2 steps recorded in pipeline');
  assert(pipelineResult.pipelineStateHash.startsWith('0xHASH_'), 'Pipeline generated cryptographic state hash');

  // Verify record was stored in memory by pipeline
  const storedFacts = mem.load('deduced_facts');
  assert(storedFacts !== undefined, 'Pipeline output successfully persisted into VDB memory');

  // Fast Result Cache
  const fastCache = new ToolFastCache(500);
  const params = { seed: createInt(369), cx: createInt(1), cy: createInt(1), cz: createInt(1) };
  const ctx = { caller: 'cache_test', timestamp: Date.now(), memoryAPI: mem };

  // First run: Cache miss
  const respMiss = fastCache.executeWithCache(simTool, params, ctx);
  assert(respMiss.success === true, 'First invocation succeeded');
  assert(fastCache.getMetrics().misses === 1, 'First call recorded cache miss');

  // Second run: Cache hit (sub-millisecond)
  const respHit = fastCache.executeWithCache(simTool, params, ctx);
  assert(respHit.success === true, 'Cached invocation succeeded');
  assert(fastCache.getMetrics().hits === 1, 'Second call recorded cache hit');
  assert(respHit.latencyMs <= 0.05, 'Cache hit latency is sub-millisecond (<= 0.05 ms)');

  console.log('  Gate 6 Passed: Tool composition & fast cache verified.\n');

  // ===========================================================================
  // Gate 7: 100-Cycle Determinism Replay & Sovereignty Safety Invariants
  // ===========================================================================
  console.log('[Gate 7] Verifying 100-Cycle Determinism & Sovereignty Invariants...');

  assert(mem.is_actuation_blocked === true, 'NativeMemoryAPI actuation lock is permanently fail-closed');
  assert(simTool.isActuationBlocked === true, 'Simulation tool actuation lock is permanently fail-closed');
  assert(mmTool.isActuationBlocked === true, 'Multimodal tool actuation lock is permanently fail-closed');

  // 100-Cycle Deterministic Replay
  const hashes: string[] = [];
  for (let c = 0; c < 100; c++) {
    const replayInfo = mem.store(`replay_key_${c % 10}`, createInt(c % 10), [c % 10, 0, 0]);
    hashes.push(replayInfo.stateHash);
  }

  // Verify first 10 match with cycles 10..19, 20..29, etc.
  let cyclesMatch = true;
  for (let c = 0; c < 90; c++) {
    if (hashes[c] !== hashes[c + 10]) {
      cyclesMatch = false;
      break;
    }
  }
  assert(cyclesMatch, '100 cycles yield bit-for-bit identical state hashes (sigma^2 = 0.0)');

  // Bounded Memory check
  const memUsage = mem.getMemoryUsage();
  assert(memUsage.totalAllocatedBytes < 64 * 1024 * 1024, 'Total memory strictly bounded (< 64 MB)');

  console.log('  Gate 7 Passed: 100-cycle determinism & sovereignty verified.\n');

  console.log('================================================================================');
  console.log(' 🏆 TASK 03 NATIVE MEMORY & TOOLING: 100% CERTIFIED & PASSED');
  console.log(' 📊 Total Gates Passed     : 7 / 7');
  console.log(' 🔒 Sovereignty Invariant  : PERMANENT FAIL-CLOSED ACTUATION LOCK');
  console.log(' ⚡ Determinism            : σ² = 0.0 (BIT-EXACT DETERMINISTIC REPLAY)');
  console.log('================================================================================\n');
}

runTask03VerificationSuite().catch((err) => {
  console.error('\n❌ Task 03 Verification Suite failed with unhandled error:', err);
  process.exit(1);
});
