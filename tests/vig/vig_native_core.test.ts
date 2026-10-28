/**
 * ONE Language — VIG Phase 2 Native Core Pilot Test Suite
 * Module: Verifiable Intelligence Graph Core Verification
 * Path: tests/vig/vig_native_core.test.ts
 */

import {
  VIGCanonicalizer,
  VIGModel,
  VIGGraphStore,
  VIGValidationError,
  VIGConflictError,
  VIGIntegrityError,
  VIGNode,
  VIGEdge,
} from '../../src/one/vig';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

function assertThrows(fn: () => void, expectedErrorType: any, errorMsgSubstring?: string): void {
  let threw = false;
  try {
    fn();
  } catch (err: any) {
    threw = true;
    if (expectedErrorType && !(err instanceof expectedErrorType)) {
      throw new Error(`Expected error instance of ${expectedErrorType.name}, got ${err.constructor.name}: ${err.message}`);
    }
    if (errorMsgSubstring && !err.message.includes(errorMsgSubstring)) {
      throw new Error(`Expected error message to include "${errorMsgSubstring}", got: "${err.message}"`);
    }
  }
  if (!threw) {
    throw new Error(`Expected function to throw, but it returned normally.`);
  }
}

export function runVIGNativeCoreTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE LANGUAGE — VIG PHASE 2 NATIVE CORE PILOT VERIFICATION');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Canonicalization & SHA-256 Deterministic Identity
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Canonicalization & SHA-256 Deterministic Identity...');

  // 1. CRLF vs LF invariance
  const contentLF = 'export function add(a: number, b: number): number {\n  return a + b;\n}\n';
  const contentCRLF = 'export function add(a: number, b: number): number {\r\n  return a + b;\r\n}\r\n';
  const hashLF = VIGCanonicalizer.computeContentHash(contentLF);
  const hashCRLF = VIGCanonicalizer.computeContentHash(contentCRLF);
  assert(hashLF === hashCRLF, 'CRLF and LF must produce bit-identical contentHash');
  assert(VIGCanonicalizer.isValidCID(hashLF), 'Content hash must be valid 64-char hex');

  // 2. Windows vs POSIX path normalization
  const pathWin = 'F:\\ONE language\\src\\one\\tensor\\Tensor.ts';
  const pathPosix = 'src/one/tensor/Tensor.ts';
  const normWin = VIGCanonicalizer.normalizePath(pathWin, 'F:/ONE language');
  const normPosix = VIGCanonicalizer.normalizePath(pathPosix);
  assert(normWin === 'src/one/tensor/Tensor.ts', `Windows path must normalize to src/one/tensor/Tensor.ts, got: ${normWin}`);
  assert(normPosix === 'src/one/tensor/Tensor.ts', 'POSIX path must normalize cleanly');
  assert(normWin === normPosix, 'Windows and POSIX paths must collapse to identical canonical path');

  // 3. Metadata key sorting invariance
  const metaA = { z: 100, b: 'beta', a: { y: 2, x: 1 } };
  const metaB = { a: { x: 1, y: 2 }, z: 100, b: 'beta' };
  assert(
    VIGCanonicalizer.canonicalizeMetadata(metaA) === VIGCanonicalizer.canonicalizeMetadata(metaB),
    'Permuted metadata keys must serialize to identical canonical JSON'
  );

  // 4. Deterministic Node CID & Edge ID computation
  const cid1 = VIGCanonicalizer.computeNodeCID('SOURCE_FILE', 'src/one/tensor/Tensor.ts', 'Tensor.ts', hashLF);
  const cid2 = VIGCanonicalizer.computeNodeCID('SOURCE_FILE', 'src/one/tensor/Tensor.ts', 'Tensor.ts', hashCRLF);
  assert(cid1 === cid2, 'Node CID must be 100% deterministic regardless of CRLF or platform');
  assert(VIGCanonicalizer.isValidCID(cid1), 'Node CID must be 64-character lowercase hex');

  const edgeId1 = VIGCanonicalizer.computeEdgeId(cid1, 'IMPORTS', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  const edgeId2 = VIGCanonicalizer.computeEdgeId(cid1, 'IMPORTS', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  assert(edgeId1 === edgeId2, 'Edge ID must be 100% deterministic');
  assert(VIGCanonicalizer.isValidCID(edgeId1), 'Edge ID must be 64-character lowercase hex');

  console.log('  ✓ Deterministic canonicalization and SHA-256 identity verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Malformed Inputs & Fail-Closed Validation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Malformed Inputs & Fail-Closed Validation...');

  // Invalid kind
  assertThrows(
    () => VIGModel.createNode({ kind: 'INVALID_KIND' as any, path: 'src/a.ts', name: 'A', contentHash: hashLF }),
    VIGValidationError,
    'Invalid or unsupported node kind'
  );

  // Empty name
  assertThrows(
    () => VIGModel.createNode({ kind: 'SOURCE_FILE', path: 'src/a.ts', name: '   ', contentHash: hashLF }),
    VIGValidationError,
    'Node name must be a non-empty string'
  );

  // Malformed contentHash (non-hex / wrong length)
  assertThrows(
    () => VIGModel.createNode({ kind: 'SOURCE_FILE', path: 'src/a.ts', name: 'A', contentHash: 'not-a-valid-hash' }),
    VIGValidationError,
    'contentHash must be a 64-character lowercase hexadecimal string'
  );

  // Spatial address out-of-bounds (> 368)
  assertThrows(
    () => VIGModel.createNode({ kind: 'SPATIAL_ANCHOR', path: 'src/spatial.ts', name: 'Cell', contentHash: hashLF, spatialAddress: 369 }),
    VIGValidationError,
    'outside valid CanonicalAddress369 range [0..368]'
  );

  // Spatial address out-of-bounds (< 0)
  assertThrows(
    () => VIGModel.createNode({ kind: 'SPATIAL_ANCHOR', path: 'src/spatial.ts', name: 'Cell', contentHash: hashLF, spatialAddress: -1 }),
    VIGValidationError,
    'outside valid CanonicalAddress369 range [0..368]'
  );

  // Valid spatial address [0..368] boundary verification
  const nodeSym = VIGModel.createNode({ kind: 'SPATIAL_ANCHOR', path: 'src/spatial.ts', name: 'Reg0', contentHash: hashLF, spatialAddress: 0 });
  const nodeSpatial = VIGModel.createNode({ kind: 'SPATIAL_ANCHOR', path: 'src/spatial.ts', name: 'Voxel368', contentHash: hashLF, spatialAddress: 368 });
  assert(nodeSym.spatialAddress === 0, 'Symbolic register address 0 must be accepted');
  assert(nodeSpatial.spatialAddress === 368, 'Spatial voxel corner address 368 must be accepted');

  // Supplied CID mismatch
  assertThrows(
    () => VIGModel.createNode({
      cid: '0000000000000000000000000000000000000000000000000000000000000000',
      kind: 'SOURCE_FILE',
      path: 'src/a.ts',
      name: 'A',
      contentHash: hashLF
    }),
    VIGValidationError,
    'does not match computed deterministic CID'
  );

  // Edge malformed source CID
  assertThrows(
    () => VIGModel.createEdge({ sourceCid: 'bad-cid', targetCid: cid1, relation: 'IMPORTS' }),
    VIGValidationError,
    'sourceCid must be a 64-character lowercase hex string'
  );

  // Edge invalid relation
  assertThrows(
    () => VIGModel.createEdge({ sourceCid: cid1, targetCid: cid2, relation: 'NON_EXISTENT_RELATION' as any }),
    VIGValidationError,
    'Invalid or unsupported edge relation'
  );

  console.log('  ✓ Fail-closed input validation and boundary enforcement verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Duplicate Nodes & Collision Detection
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Duplicate Nodes & Collision Detection...');

  const store = new VIGGraphStore();
  const nodeA1 = VIGModel.createNode({
    kind: 'SOURCE_FILE',
    path: 'src/one/tensor/Tensor.ts',
    name: 'Tensor.ts',
    contentHash: hashLF,
    isExported: true,
  });

  const nodeA2 = VIGModel.createNode({
    kind: 'SOURCE_FILE',
    path: 'src/one/tensor/Tensor.ts',
    name: 'Tensor.ts',
    contentHash: hashLF,
    isExported: true,
  });

  // Idempotent duplicate addition
  const res1 = store.addNode(nodeA1);
  const res2 = store.addNode(nodeA2);
  assert(res1 === res2, 'Adding identical node must return existing node idempotently');
  assert(store.nodeCount === 1, 'Graph store must contain exactly 1 node after duplicate addition');

  // Conflict detection: Attempting to insert differing attributes with forged/same CID
  // Mock conflict by creating node with identical CID fields but different isExported
  const conflictingNode: VIGNode = Object.freeze({
    ...nodeA1,
    isExported: false, // Conflicting attribute
  });

  assertThrows(
    () => store.addNode(conflictingNode),
    VIGConflictError,
    'Node CID collision with conflicting attributes'
  );
  assert(store.nodeCount === 1, 'Conflict must reject insertion without corrupting store');

  console.log('  ✓ Idempotent duplicate addition and conflict rejection verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Referential Integrity Enforcement
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Referential Integrity Enforcement...');

  const dummyTargetCid = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  const edgeMissingTarget = VIGModel.createEdge({
    sourceCid: nodeA1.cid,
    targetCid: dummyTargetCid,
    relation: 'IMPORTS',
  });

  // Adding edge with missing target node must fail closed
  assertThrows(
    () => store.addEdge(edgeMissingTarget),
    VIGValidationError,
    'Target node CID "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" does not exist in graph store'
  );

  const dummySourceCid = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const edgeMissingSource = VIGModel.createEdge({
    sourceCid: dummySourceCid,
    targetCid: nodeA1.cid,
    relation: 'IMPORTS',
  });

  // Adding edge with missing source node must fail closed
  assertThrows(
    () => store.addEdge(edgeMissingSource),
    VIGValidationError,
    'Source node CID "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" does not exist in graph store'
  );
  assert(store.edgeCount === 0, 'No edges must be stored on referential failure');

  console.log('  ✓ Referential integrity fail-closed enforcement verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Dual Adjacency Directionality & Multi-Node Graph
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Dual Adjacency Directionality & Multi-Node Graph...');

  const nodeB = VIGModel.createNode({
    kind: 'AST_DECLARATION',
    path: 'src/one/tensor/Tensor.ts',
    name: 'Tensor.matmul',
    contentHash: VIGCanonicalizer.computeContentHash('public matmul(other: Tensor): Tensor'),
    isExported: true,
  });

  const nodeTest = VIGModel.createNode({
    kind: 'TEST_SUITE',
    path: 'tests/esm/esm_runtime_verification.test.ts',
    name: 'runESMRuntimeTests',
    contentHash: VIGCanonicalizer.computeContentHash('export function runESMRuntimeTests()'),
    isExported: false,
  });

  store.addNode(nodeB);
  store.addNode(nodeTest);
  assert(store.nodeCount === 3, 'Store must contain exactly 3 nodes');

  // Edge 1: Tensor.ts DEFINES_SYMBOL Tensor.matmul (source: Tensor.ts, target: Tensor.matmul)
  const edgeDefines = VIGModel.createEdge({
    sourceCid: nodeA1.cid,
    targetCid: nodeB.cid,
    relation: 'DEFINES_SYMBOL',
    isPublicApi: true,
  });

  // Edge 2: esm_runtime.test.ts TESTS_MODULE Tensor.ts (source: test, target: Tensor.ts)
  const edgeTests = VIGModel.createEdge({
    sourceCid: nodeTest.cid,
    targetCid: nodeA1.cid,
    relation: 'TESTS_MODULE',
    isPublicApi: false,
  });

  store.addEdge(edgeDefines);
  store.addEdge(edgeTests);
  assert(store.edgeCount === 2, 'Store must contain exactly 2 edges');

  // Duplicate edge addition is idempotent
  const edgeDefinesDup = store.addEdge(edgeDefines);
  assert(edgeDefinesDup === edgeDefines, 'Adding duplicate edge must be idempotent');
  assert(store.edgeCount === 2, 'Duplicate edge must not duplicate count');

  // Verify Forward Adjacency: Tensor.ts depends on / defines Tensor.matmul
  const outA = store.getOutgoingEdges(nodeA1.cid);
  assert(outA.length === 1 && outA[0].edgeId === edgeDefines.edgeId, 'Tensor.ts outgoing must contain edgeDefines');

  // Verify Reverse Adjacency: Tensor.ts is depended upon / tested by esm_runtime.test.ts
  const inA = store.getIncomingEdges(nodeA1.cid);
  assert(inA.length === 1 && inA[0].edgeId === edgeTests.edgeId, 'Tensor.ts incoming must contain edgeTests');

  // Target of DEFINES_SYMBOL has incoming edge from Tensor.ts
  const inB = store.getIncomingEdges(nodeB.cid);
  assert(inB.length === 1 && inB[0].sourceCid === nodeA1.cid, 'Tensor.matmul incoming must originate from Tensor.ts');

  // Query nodes by path
  const nodesInTensorFile = store.getNodesByPath('src/one/tensor/Tensor.ts');
  assert(nodesInTensorFile.length === 2, 'Path query for Tensor.ts must return both file and declaration nodes');

  console.log('  ✓ Dual adjacency directionality and query indices verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Stable Deterministic Serialization & Merkle Root Roundtrip
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Deterministic Serialization & Merkle Root Roundtrip...');

  // 1. Generate serialization
  const serialized = store.serialize();
  assert(serialized.schemaVersion === 1, 'Serialized schemaVersion must be 1');
  assert(serialized.nodeCount === 3, 'Serialized nodeCount must be 3');
  assert(serialized.edgeCount === 2, 'Serialized edgeCount must be 2');
  assert(VIGCanonicalizer.isValidCID(serialized.graphRootSeal), 'graphRootSeal must be valid 64-char hex');

  // 2. Deterministic sort verification (nodes sorted by CID, edges by edgeId)
  for (let i = 1; i < serialized.nodes.length; i++) {
    assert(
      serialized.nodes[i - 1].cid.localeCompare(serialized.nodes[i].cid) < 0,
      'Nodes must be sorted in strictly ascending lexicographical order by CID'
    );
  }
  for (let i = 1; i < serialized.edges.length; i++) {
    assert(
      serialized.edges[i - 1].edgeId.localeCompare(serialized.edges[i].edgeId) < 0,
      'Edges must be sorted in strictly ascending lexicographical order by edgeId'
    );
  }

  // 3. Bit-identical serialization repeatability and millisecond-boundary behavior
  const str1 = store.serializeToString();
  const str2 = store.serializeToString();
  assert(str1 === str2, 'Consecutive serializations must be 100% bit-identical');

  const canonStr = store.serializeCanonical();
  assert(str1 === canonStr, 'serializeCanonical must be identical to serializeToString');

  const hash1 = store.computeCanonicalHash();
  assert(VIGCanonicalizer.isValidCID(hash1), 'Canonical hash must be valid 64-character hex');

  // Guarantee crossing millisecond boundaries (simulate delayed repeated serialization)
  const msStart = Date.now();
  while (Date.now() - msStart < 20);

  const str3 = store.serializeToString();
  const hash3 = store.computeCanonicalHash();
  assert(str1 === str3, 'Serialization across millisecond boundaries must remain 100% bit-identical');
  assert(hash1 === hash3, 'Canonical hash across millisecond boundaries must remain 100% stable');

  // 4. Runtime metadata options & backwards compatibility
  const defaultRecord = store.serialize();
  assert(defaultRecord.serializedAt === undefined, 'Default serialize() must not inject runtime serializedAt');

  const withExplicitTs = store.serialize({ serializedAt: 123456789 });
  assert(withExplicitTs.serializedAt === 123456789, 'serialize({ serializedAt }) must bind explicitly provided timestamp');

  const withAutoTs = store.serialize({ includeTimestamp: true });
  assert(typeof withAutoTs.serializedAt === 'number' && withAutoTs.serializedAt > 0, 'serialize({ includeTimestamp: true }) must inject valid timestamp');

  // Deserialization gracefully accepts legacy records containing serializedAt
  const legacyPayload = { ...defaultRecord, serializedAt: 999999999 };
  const legacyRestored = VIGGraphStore.deserialize(JSON.stringify(legacyPayload));
  assert(legacyRestored.nodeCount === store.nodeCount, 'Legacy deserialization with serializedAt must succeed cleanly');

  // 5. Property ordering invariance across equivalent states
  const storeAlpha = new VIGGraphStore();
  const storeBeta = new VIGGraphStore();
  const nodeAlpha = VIGModel.createNode({
    kind: 'MODULE',
    path: 'src/canonical/OrderTest.ts',
    name: 'OrderTest',
    contentHash: hashLF,
    metadata: { beta: 2, alpha: 1, nested: { z: 10, a: 20 } },
    indexedAt: 7777,
  });
  const nodeBeta = VIGModel.createNode({
    name: 'OrderTest',
    path: 'src/canonical/OrderTest.ts',
    kind: 'MODULE',
    contentHash: hashLF,
    metadata: { nested: { a: 20, z: 10 }, alpha: 1, beta: 2 },
    indexedAt: 7777,
  });
  storeAlpha.addNode(nodeAlpha);
  storeBeta.addNode(nodeBeta);

  const alphaStr = storeAlpha.serializeToString();
  const betaStr = storeBeta.serializeToString();
  assert(alphaStr === betaStr, 'Equivalent graph states with permuted property ordering must produce bit-identical canonical serialization');
  assert(storeAlpha.computeCanonicalHash() === storeBeta.computeCanonicalHash(), 'Equivalent graph states with permuted property ordering must produce identical hashes');

  // 6. Deserialization into fresh store & round-trip idempotence
  const restoredStore = VIGGraphStore.deserialize(str1);
  assert(restoredStore.nodeCount === 3, 'Restored store nodeCount must equal 3');
  assert(restoredStore.edgeCount === 2, 'Restored store edgeCount must equal 2');
  assert(restoredStore.hasNode(nodeA1.cid), 'Restored store must contain nodeA1');
  assert(restoredStore.hasNode(nodeB.cid), 'Restored store must contain nodeB');
  assert(restoredStore.hasNode(nodeTest.cid), 'Restored store must contain nodeTest');
  assert(restoredStore.hasEdge(edgeDefines.edgeId), 'Restored store must contain edgeDefines');
  assert(restoredStore.hasEdge(edgeTests.edgeId), 'Restored store must contain edgeTests');
  assert(restoredStore.computeRootSeal() === serialized.graphRootSeal, 'Restored store root seal must match exactly');

  // Re-serializing restored store must produce bit-identical canonical output
  const restoredStr = restoredStore.serializeToString();
  assert(restoredStr === str1, 'Re-serializing restored store must produce bit-identical canonical output');
  assert(restoredStore.computeCanonicalHash() === hash1, 'Restored store canonical hash must match original');

  // 7. Tampering Detection A: Modify node content (CID mismatch)
  const tamperedJson = JSON.parse(str1);
  tamperedJson.nodes[0] = { ...tamperedJson.nodes[0], name: 'TamperedName' };
  const tamperedStr = JSON.stringify(tamperedJson);

  assertThrows(
    () => VIGGraphStore.deserialize(tamperedStr),
    VIGIntegrityError,
    'Serialized graph contains corrupted or invalid entities'
  );

  // 8. Tampering Detection B: Corrupt cryptographic root seal
  const tamperedSealJson = JSON.parse(str1);
  tamperedSealJson.graphRootSeal = '0'.repeat(64);
  const tamperedSealStr = JSON.stringify(tamperedSealJson);

  assertThrows(
    () => VIGGraphStore.deserialize(tamperedSealStr),
    VIGIntegrityError,
    'Cryptographic graph root seal mismatch'
  );

  // 9. Fail-Closed Malformed Input Validation
  assertThrows(() => VIGGraphStore.deserialize(null as any), VIGIntegrityError, 'Unsupported graph schema version');
  assertThrows(() => VIGGraphStore.deserialize(undefined as any), VIGIntegrityError, 'Unsupported graph schema version');
  assertThrows(() => VIGGraphStore.deserialize(''), VIGIntegrityError, 'Failed to parse serialized graph JSON');
  assertThrows(() => VIGGraphStore.deserialize('{ "invalid": true }'), VIGIntegrityError, 'Unsupported graph schema version');
  assertThrows(() => VIGGraphStore.deserialize('{ "schemaVersion": 2, "nodes": [], "edges": [] }'), VIGIntegrityError, 'Unsupported graph schema version');
  assertThrows(() => VIGGraphStore.deserialize('{ "schemaVersion": 1, "nodes": "not-array", "edges": [] }'), VIGIntegrityError, 'Serialized graph is missing valid nodes or edges');
  assertThrows(() => VIGGraphStore.deserialize('{ "schemaVersion": 1, "nodes": [], "edges": "not-array" }'), VIGIntegrityError, 'Serialized graph is missing valid nodes or edges');

  // 10. Fail-Closed Referential Integrity Enforcement in Deserialization
  const missingTargetCid = 'e'.repeat(64);
  const brokenRefJson = JSON.parse(str1);
  brokenRefJson.edges.push({
    edgeId: VIGCanonicalizer.computeEdgeId(nodeA1.cid, 'IMPORTS', missingTargetCid),
    sourceCid: nodeA1.cid,
    targetCid: missingTargetCid, // missing CID in nodes array
    relation: 'IMPORTS',
    isPublicApi: false,
  });
  // Recompute seal so payload passes Merkle check and fails referential integrity
  brokenRefJson.graphRootSeal = VIGCanonicalizer.computeGraphSeal(brokenRefJson.nodes, brokenRefJson.edges);
  assertThrows(
    () => VIGGraphStore.deserialize(JSON.stringify(brokenRefJson)),
    VIGIntegrityError,
    'Referential integrity failure'
  );

  console.log('  ✓ Deterministic serialization, Merkle root seal, and tampering rejection verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: BUG-B02 Regression: Path Traversal Resolution & Windows Case Folding
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] BUG-B02 Regression: Path Normalization, Traversal & Case Folding...');

  // 1. Parent and relative segment resolution
  const p1 = VIGCanonicalizer.normalizePath('src/one/vig/../vig/types.ts');
  assert(p1 === 'src/one/vig/types.ts', 'Parent .. segment must be collapsed');

  const p2 = VIGCanonicalizer.normalizePath('src/./one/./vig/./types.ts');
  assert(p2 === 'src/one/vig/types.ts', 'Current . segments must be collapsed');

  const p3 = VIGCanonicalizer.normalizePath('src/one/ir/../../one/ast/UnifiedAST.ts');
  assert(p3 === 'src/one/ast/UnifiedAST.ts', 'Multi-level .. traversal must collapse cleanly');

  // 2. Root escape prevention (fail-closed)
  assertThrows(
    () => VIGCanonicalizer.normalizePath('../../outside.txt'),
    VIGValidationError,
    'Path attempts to escape repository root'
  );

  assertThrows(
    () => VIGCanonicalizer.normalizePath('src/../../outside.ts'),
    VIGValidationError,
    'Path attempts to escape repository root'
  );

  // 3. Windows Case Folding & Physical Disk Aliasing
  if (process.platform === 'win32') {
    const canonicalCasing = VIGCanonicalizer.normalizePath('src/one/vig/types.ts');
    const aliasedCasing = VIGCanonicalizer.normalizePath('src/one/vig/Types.ts');
    assert(
      aliasedCasing === canonicalCasing,
      'Windows case-insensitive path alias must resolve to true on-disk canonical casing'
    );

    // Identical node CIDs
    const dummyHash = 'a'.repeat(64);
    const nodeA = VIGModel.createNode({
      kind: 'SOURCE_FILE',
      path: canonicalCasing,
      name: 'types.ts',
      contentHash: dummyHash,
    });
    const nodeB = VIGModel.createNode({
      kind: 'SOURCE_FILE',
      path: aliasedCasing,
      name: 'types.ts',
      contentHash: dummyHash,
    });
    assert(nodeA.cid === nodeB.cid, 'Aliased paths must produce bit-identical CIDs');

    // Graph store case-insensitive lookup
    const gStore = new VIGGraphStore();
    gStore.addNode(nodeA);
    const foundDirect = gStore.getNodesByPath('src/one/vig/types.ts');
    const foundAliased = gStore.getNodesByPath('src/one/vig/Types.ts');
    const foundTraversal = gStore.getNodesByPath('src/one/../one/vig/Types.ts');

    assert(foundDirect.length === 1, 'foundDirect length must be 1');
    assert(foundAliased.length === 1, 'foundAliased length must be 1');
    assert(foundTraversal.length === 1, 'foundTraversal length must be 1');
    assert(foundDirect[0].cid === foundAliased[0].cid, 'CIDs must match between direct and aliased');
    assert(foundDirect[0].cid === foundTraversal[0].cid, 'CIDs must match between direct and traversal');

    // Virtual in-memory path case-insensitivity on Windows
    const virtNode = VIGModel.createNode({
      kind: 'SOURCE_FILE',
      path: 'src/virtual/SpatialEngine.ts',
      name: 'SpatialEngine.ts',
      contentHash: dummyHash,
    });
    gStore.addNode(virtNode);
    const foundVirtAliased = gStore.getNodesByPath('src/virtual/spatialengine.ts');
    assert(foundVirtAliased.length === 1, 'Virtual in-memory path lookup must be case-insensitive on Windows');
    assert(foundVirtAliased[0].cid === virtNode.cid, 'Found virtual node CID must match');
  }

  console.log('  ✓ BUG-B02 regression verified: Traversal resolution, root escape prevention & Windows case folding.');

  console.log('\n' + '='.repeat(80));
  console.log('  ALL VIG PHASE 2 NATIVE CORE SUITES PASSED (100%)');
  console.log('='.repeat(80));
}

// Auto-execute when run as direct script
runVIGNativeCoreTests();
