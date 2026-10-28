/**
 * CUBiO AI — ONE LANGUAGE — VERIFIABLE INTELLIGENCE GRAPH (VIG)
 * ==============================================================
 * Test Suite: VIG Phase 3 Dependency Graph & Impact Tracking
 * Specification: VIG Phase 3 Acceptance Criteria
 *
 * Validates:
 * 1. Directed edges: IMPORTS, CALLS, EXTENDS_OR_IMPLEMENTS, DEFINES_SYMBOL, TESTS_MODULE.
 * 2. Deterministic forward/reverse adjacency indexes and query APIs.
 * 3. Cycle-safe BFS and DFS impact traversals with depth limits.
 * 4. Circular dependency detection and cycle path reporting.
 * 5. Public API contract breach vs private change isolation.
 * 6. Automated required-test discovery.
 * 7. Duplicate edge idempotency and conflict detection.
 * 8. Real AST extraction, unresolved imports handling, and syntax error tolerance.
 * 9. Spatial Memory [0..368] boundary isolation.
 */

import assert from 'assert';
import {
  VIGNode,
  VIGEdge,
  VIGModel,
  VIGGraphStore,
  VIGImpactTracker,
  VIGASTExtractor,
  VIGConflictError,
  VIGValidationError,
  VIGIntegrityError,
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

export function runVIGDependencyGraphTests(): void {
  console.log('\n' + '='.repeat(80));
  console.log('  ONE LANGUAGE — VIG PHASE 3 DEPENDENCY GRAPH & IMPACT TRACKING');
  console.log('='.repeat(80) + '\n');

  // ============================================================================
  // Suite 1: Directed Edge Relationships & Referential Integrity
  // ============================================================================
  console.log('[Suite 1] Directed Edge Relationships (IMPORTS, CALLS, EXTENDS, DEFINES, TESTS)...');
  {
    const store = new VIGGraphStore();

    const fileA = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/math/Calculator.ts',
        name: 'Calculator.ts',
        contentHash: 'a'.repeat(64),
        isExported: true,
      })
    );

    const symAdd = store.addNode(
      VIGModel.createNode({
        kind: 'AST_DECLARATION',
        path: 'src/math/Calculator.ts',
        name: 'add',
        contentHash: 'b'.repeat(64),
        isExported: true,
      })
    );

    const symMultiply = store.addNode(
      VIGModel.createNode({
        kind: 'AST_DECLARATION',
        path: 'src/math/Calculator.ts',
        name: 'multiply',
        contentHash: 'c'.repeat(64),
        isExported: true,
      })
    );

    const classBase = store.addNode(
      VIGModel.createNode({
        kind: 'AST_DECLARATION',
        path: 'src/math/Calculator.ts',
        name: 'BaseCalc',
        contentHash: 'd'.repeat(64),
        isExported: true,
      })
    );

    const classAdv = store.addNode(
      VIGModel.createNode({
        kind: 'AST_DECLARATION',
        path: 'src/math/Calculator.ts',
        name: 'AdvCalc',
        contentHash: 'e'.repeat(64),
        isExported: true,
      })
    );

    const consumerFile = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/app/App.ts',
        name: 'App.ts',
        contentHash: 'f'.repeat(64),
        isExported: true,
      })
    );

    const testFile = store.addNode(
      VIGModel.createNode({
        kind: 'TEST_SUITE',
        path: 'tests/math/Calculator.test.ts',
        name: 'Calculator.test.ts',
        contentHash: '1'.repeat(64),
        isExported: true,
      })
    );

    // 1. DEFINES_SYMBOL
    const edgeDefines1 = store.addEdge(
      VIGModel.createEdge({
        sourceCid: fileA.cid,
        targetCid: symAdd.cid,
        relation: 'DEFINES_SYMBOL',
        isPublicApi: true,
      })
    );
    assert.strictEqual(edgeDefines1.relation, 'DEFINES_SYMBOL');

    // 2. CALLS (multiply calls add)
    const edgeCalls = store.addEdge(
      VIGModel.createEdge({
        sourceCid: symMultiply.cid,
        targetCid: symAdd.cid,
        relation: 'CALLS',
        isPublicApi: false,
      })
    );
    assert.strictEqual(edgeCalls.relation, 'CALLS');

    // 3. EXTENDS_OR_IMPLEMENTS (AdvCalc extends BaseCalc)
    const edgeExtends = store.addEdge(
      VIGModel.createEdge({
        sourceCid: classAdv.cid,
        targetCid: classBase.cid,
        relation: 'EXTENDS_OR_IMPLEMENTS',
        isPublicApi: true,
      })
    );
    assert.strictEqual(edgeExtends.relation, 'EXTENDS_OR_IMPLEMENTS');

    // 4. IMPORTS (App imports Calculator)
    const edgeImports = store.addEdge(
      VIGModel.createEdge({
        sourceCid: consumerFile.cid,
        targetCid: fileA.cid,
        relation: 'IMPORTS',
        isPublicApi: false,
      })
    );
    assert.strictEqual(edgeImports.relation, 'IMPORTS');

    // 5. TESTS_MODULE (Calculator.test.ts tests Calculator.ts)
    const edgeTests = store.addEdge(
      VIGModel.createEdge({
        sourceCid: testFile.cid,
        targetCid: fileA.cid,
        relation: 'TESTS_MODULE',
        isPublicApi: false,
      })
    );
    assert.strictEqual(edgeTests.relation, 'TESTS_MODULE');

    assert.strictEqual(store.nodeCount, 7);
    assert.strictEqual(store.edgeCount, 5);
    console.log('  ✓ All 5 directed edge relations successfully validated.');
  }

  // ============================================================================
  // Suite 2: Forward and Reverse Adjacency Index Querying
  // ============================================================================
  console.log('\n[Suite 2] Deterministic Forward and Reverse Adjacency Queries...');
  {
    const store = new VIGGraphStore();
    const nodeA = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/A.ts',
        name: 'A.ts',
        contentHash: '1'.repeat(64),
        isExported: true,
      })
    );
    const nodeB = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/B.ts',
        name: 'B.ts',
        contentHash: '2'.repeat(64),
        isExported: true,
      })
    );
    const nodeC = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/C.ts',
        name: 'C.ts',
        contentHash: '3'.repeat(64),
        isExported: true,
      })
    );

    // B -> A (B depends on A)
    const edgeBA = store.addEdge(
      VIGModel.createEdge({
        sourceCid: nodeB.cid,
        targetCid: nodeA.cid,
        relation: 'IMPORTS',
        isPublicApi: false,
      })
    );
    // C -> A (C depends on A)
    const edgeCA = store.addEdge(
      VIGModel.createEdge({
        sourceCid: nodeC.cid,
        targetCid: nodeA.cid,
        relation: 'IMPORTS',
        isPublicApi: true,
      })
    );
    // C -> B (C depends on B)
    const edgeCB = store.addEdge(
      VIGModel.createEdge({
        sourceCid: nodeC.cid,
        targetCid: nodeB.cid,
        relation: 'IMPORTS',
        isPublicApi: false,
      })
    );

    // 1. Outgoing from C (dependencies of C)
    const outC = store.getOutgoingEdges(nodeC.cid);
    assert.strictEqual(outC.length, 2);
    const depsC = store.getDependencies(nodeC.cid);
    assert.strictEqual(depsC.length, 2);
    assert.deepStrictEqual(
      depsC.map((n) => n.path).sort(),
      ['src/A.ts', 'src/B.ts']
    );

    // 2. Incoming to A (dependents of A)
    const inA = store.getIncomingEdges(nodeA.cid);
    assert.strictEqual(inA.length, 2);
    const dependentsA = store.getDependents(nodeA.cid);
    assert.strictEqual(dependentsA.length, 2);
    assert.deepStrictEqual(
      dependentsA.map((n) => n.path).sort(),
      ['src/B.ts', 'src/C.ts']
    );

    // 3. Removal cascade
    assert.strictEqual(store.removeEdge(edgeCB.edgeId), true);
    assert.strictEqual(store.getOutgoingEdges(nodeC.cid).length, 1);
    assert.strictEqual(store.getIncomingEdges(nodeB.cid).length, 0);

    // Re-add edgeCB
    store.addEdge(edgeCB);
    assert.strictEqual(store.removeNode(nodeB.cid), true);
    assert.strictEqual(store.hasNode(nodeB.cid), false);
    assert.strictEqual(store.hasEdge(edgeBA.edgeId), false);
    assert.strictEqual(store.hasEdge(edgeCB.edgeId), false);
    assert.strictEqual(store.getOutgoingEdges(nodeC.cid).length, 1); // only C -> A remains

    console.log('  ✓ Forward and reverse adjacency indexes and cascades verified.');
  }

  // ============================================================================
  // Suite 3: Multi-Hop Transitive Impact Traversal
  // ============================================================================
  console.log('\n[Suite 3] Transitive Downstream Impact Traversal (Multi-Hop)...');
  {
    // Topology: Core -> Service -> Controller -> UI
    //           Core -> CoreTest
    //           Controller -> ControllerTest
    const store = new VIGGraphStore();
    const core = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/Core.ts',
        name: 'Core.ts',
        contentHash: '1'.repeat(64),
        isExported: true,
      })
    );
    const service = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/Service.ts',
        name: 'Service.ts',
        contentHash: '2'.repeat(64),
        isExported: true,
      })
    );
    const controller = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/Controller.ts',
        name: 'Controller.ts',
        contentHash: '3'.repeat(64),
        isExported: true,
      })
    );
    const ui = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/UI.ts',
        name: 'UI.ts',
        contentHash: '4'.repeat(64),
        isExported: true,
      })
    );
    const coreTest = store.addNode(
      VIGModel.createNode({
        kind: 'TEST_SUITE',
        path: 'tests/Core.test.ts',
        name: 'Core.test.ts',
        contentHash: '5'.repeat(64),
        isExported: true,
      })
    );
    const ctrlTest = store.addNode(
      VIGModel.createNode({
        kind: 'TEST_SUITE',
        path: 'tests/Controller.test.ts',
        name: 'Controller.test.ts',
        contentHash: '6'.repeat(64),
        isExported: true,
      })
    );

    // Dependencies: Consumer -> Provider
    store.addEdge(VIGModel.createEdge({ sourceCid: service.cid, targetCid: core.cid, relation: 'IMPORTS', isPublicApi: false }));
    store.addEdge(VIGModel.createEdge({ sourceCid: controller.cid, targetCid: service.cid, relation: 'IMPORTS', isPublicApi: false }));
    store.addEdge(VIGModel.createEdge({ sourceCid: ui.cid, targetCid: controller.cid, relation: 'IMPORTS', isPublicApi: false }));
    store.addEdge(VIGModel.createEdge({ sourceCid: coreTest.cid, targetCid: core.cid, relation: 'TESTS_MODULE', isPublicApi: false }));
    store.addEdge(VIGModel.createEdge({ sourceCid: ctrlTest.cid, targetCid: controller.cid, relation: 'TESTS_MODULE', isPublicApi: false }));

    // 1. Changing Core.ts: impact must reach Service, Controller, UI, and both tests!
    const reportBFS = VIGImpactTracker.computeDownstreamImpact([core.cid], store, { mode: 'BFS' });
    assert.strictEqual(reportBFS.rootCids[0], core.cid);
    assert.strictEqual(reportBFS.affectedNodes.length, 5); // Service, Controller, UI, CoreTest, CtrlTest
    assert.strictEqual(reportBFS.requiredTestSuites.length, 2);
    assert.strictEqual(reportBFS.cycleDetected, false);
    assert.deepStrictEqual(
      reportBFS.requiredTestSuites.map((t) => t.path).sort(),
      ['tests/Controller.test.ts', 'tests/Core.test.ts']
    );

    // 2. DFS mode returns the identical set of affected nodes and tests
    const reportDFS = VIGImpactTracker.computeDownstreamImpact([core.cid], store, { mode: 'DFS' });
    assert.strictEqual(reportDFS.affectedNodes.length, 5);
    assert.strictEqual(reportDFS.requiredTestSuites.length, 2);

    // 3. Changing Controller.ts: impact must reach only UI and ControllerTest
    const ctrlReport = VIGImpactTracker.computeDownstreamImpact([controller.cid], store);
    assert.strictEqual(ctrlReport.affectedNodes.length, 2);
    assert.deepStrictEqual(
      ctrlReport.affectedPaths.sort(),
      ['src/UI.ts', 'tests/Controller.test.ts']
    );
    assert.strictEqual(ctrlReport.requiredTestSuites.length, 1);
    assert.strictEqual(ctrlReport.requiredTestSuites[0].path, 'tests/Controller.test.ts');

    // 4. Depth Limit: maxDepth = 1 from Core should reach only direct dependents (Service, CoreTest)
    const limitedReport = VIGImpactTracker.computeDownstreamImpact([core.cid], store, { maxDepth: 1 });
    assert.strictEqual(limitedReport.affectedNodes.length, 2);
    assert.deepStrictEqual(
      limitedReport.affectedPaths.sort(),
      ['src/Service.ts', 'tests/Core.test.ts']
    );

    console.log('  ✓ Multi-hop transitive downstream impact traversal verified.');
  }

  // ============================================================================
  // Suite 4: Cycle Safety and Circular Dependency Detection
  // ============================================================================
  console.log('\n[Suite 4] Circular Dependency Detection and Safe Traversal...');
  {
    // Topology with circular dependency:
    // A -> B -> C -> A (Circle)
    // C -> D -> TestD
    const store = new VIGGraphStore();
    const nodeA = store.addNode(
      VIGModel.createNode({ kind: 'SOURCE_FILE', path: 'src/CircleA.ts', name: 'CircleA.ts', contentHash: '1'.repeat(64), isExported: true })
    );
    const nodeB = store.addNode(
      VIGModel.createNode({ kind: 'SOURCE_FILE', path: 'src/CircleB.ts', name: 'CircleB.ts', contentHash: '2'.repeat(64), isExported: true })
    );
    const nodeC = store.addNode(
      VIGModel.createNode({ kind: 'SOURCE_FILE', path: 'src/CircleC.ts', name: 'CircleC.ts', contentHash: '3'.repeat(64), isExported: true })
    );
    const nodeD = store.addNode(
      VIGModel.createNode({ kind: 'SOURCE_FILE', path: 'src/LeafD.ts', name: 'LeafD.ts', contentHash: '4'.repeat(64), isExported: true })
    );
    const testD = store.addNode(
      VIGModel.createNode({ kind: 'TEST_SUITE', path: 'tests/LeafD.test.ts', name: 'LeafD.test.ts', contentHash: '5'.repeat(64), isExported: true })
    );

    // Dependencies (Consumer -> Provider)
    // B depends on A
    store.addEdge(VIGModel.createEdge({ sourceCid: nodeB.cid, targetCid: nodeA.cid, relation: 'IMPORTS', isPublicApi: false }));
    // C depends on B
    store.addEdge(VIGModel.createEdge({ sourceCid: nodeC.cid, targetCid: nodeB.cid, relation: 'IMPORTS', isPublicApi: false }));
    // A depends on C (creates the cycle A <-> B <-> C)
    store.addEdge(VIGModel.createEdge({ sourceCid: nodeA.cid, targetCid: nodeC.cid, relation: 'IMPORTS', isPublicApi: false }));
    // D depends on C
    store.addEdge(VIGModel.createEdge({ sourceCid: nodeD.cid, targetCid: nodeC.cid, relation: 'IMPORTS', isPublicApi: false }));
    // TestD tests D
    store.addEdge(VIGModel.createEdge({ sourceCid: testD.cid, targetCid: nodeD.cid, relation: 'TESTS_MODULE', isPublicApi: false }));

    // 1. BFS Impact Traversal must terminate safely and report cycles
    const bfsReport = VIGImpactTracker.computeDownstreamImpact([nodeA.cid], store, { mode: 'BFS' });
    assert.strictEqual(bfsReport.cycleDetected, true, 'BFS must detect the circular dependency');
    assert(bfsReport.cycles.length > 0, 'Detected cycles must contain at least one loop');
    assert.strictEqual(bfsReport.affectedNodes.length, 4, 'All cycle nodes (B, C) and branches (D, TestD) must be reached');
    assert.strictEqual(bfsReport.requiredTestSuites.length, 1);
    assert.strictEqual(bfsReport.requiredTestSuites[0].path, 'tests/LeafD.test.ts');

    // 2. DFS Impact Traversal must also terminate safely and report cycles
    const dfsReport = VIGImpactTracker.computeDownstreamImpact([nodeA.cid], store, { mode: 'DFS' });
    assert.strictEqual(dfsReport.cycleDetected, true, 'DFS must detect the circular dependency');
    assert(dfsReport.cycles.length > 0);
    assert.strictEqual(dfsReport.affectedNodes.length, 4);

    // 3. Upstream dependency check must also terminate safely on cycle
    const upReport = VIGImpactTracker.computeUpstreamDependencies([nodeD.cid], store);
    assert.strictEqual(upReport.dependencies.length, 3, 'Upstream should find C, B, A');
    assert(upReport.cycles.length > 0, 'Upstream traversal must detect cycle');

    console.log('  ✓ Cycle-safe BFS/DFS termination and cycle reporting verified.');
  }

  // ============================================================================
  // Suite 5: Public API Contract Breach vs Private Change Isolation
  // ============================================================================
  console.log('\n[Suite 5] Public API Contract Breach vs Private Change Isolation...');
  {
    const store = new VIGGraphStore();

    // Module with:
    // - private internal function (isExported: false)
    // - public exported function (isExported: true)
    // - external consumer
    // 1. Isolated Private Chain:
    const privFn = store.addNode(
      VIGModel.createNode({
        kind: 'AST_DECLARATION',
        path: 'src/lib/Util.ts',
        name: '_internalCalc',
        contentHash: '1'.repeat(64),
        isExported: false,
      })
    );

    const internalWorker = store.addNode(
      VIGModel.createNode({
        kind: 'AST_DECLARATION',
        path: 'src/lib/Util.ts',
        name: '_internalWorker',
        contentHash: '2'.repeat(64),
        isExported: false,
      })
    );

    store.addEdge(
      VIGModel.createEdge({
        sourceCid: internalWorker.cid,
        targetCid: privFn.cid,
        relation: 'CALLS',
        isPublicApi: false,
      })
    );

    // 2. Public Export Chain:
    const pubFn = store.addNode(
      VIGModel.createNode({
        kind: 'AST_DECLARATION',
        path: 'src/lib/Util.ts',
        name: 'computePublic',
        contentHash: '3'.repeat(64),
        isExported: true,
      })
    );

    const clientSym = store.addNode(
      VIGModel.createNode({
        kind: 'AST_DECLARATION',
        path: 'src/client/Client.ts',
        name: 'runClient',
        contentHash: '4'.repeat(64),
        isExported: true,
      })
    );

    store.addEdge(
      VIGModel.createEdge({
        sourceCid: clientSym.cid,
        targetCid: pubFn.cid,
        relation: 'CALLS',
        isPublicApi: true,
      })
    );

    // Test A: Modifying purely internal helper (privFn -> internalWorker)
    const privReport = VIGImpactTracker.computeDownstreamImpact([privFn.cid], store);
    assert.strictEqual(
      privReport.isPublicApiBreached,
      false,
      'Modifying internal helper should not breach public API contract'
    );
    assert.strictEqual(privReport.affectedNodes.length, 1);
    assert.strictEqual(privReport.affectedNodes[0].name, '_internalWorker');

    // Test B: Modifying public exported function directly (pubFn -> clientSym)
    const pubReport = VIGImpactTracker.computeDownstreamImpact([pubFn.cid], store);
    assert.strictEqual(
      pubReport.isPublicApiBreached,
      true,
      'Modifying exported public symbol must breach public API contract'
    );
    assert.strictEqual(pubReport.affectedNodes.length, 1);
    assert.strictEqual(pubReport.affectedNodes[0].name, 'runClient');

    console.log('  ✓ Public API contract breach vs private change isolation verified.');
  }

  // ============================================================================
  // Suite 6: Duplicate Edge Idempotency and Collision Handling
  // ============================================================================
  console.log('\n[Suite 6] Duplicate Edge Idempotency and Collision Handling...');
  {
    const store = new VIGGraphStore();
    const nodeA = store.addNode(
      VIGModel.createNode({ kind: 'SOURCE_FILE', path: 'src/ModA.ts', name: 'ModA.ts', contentHash: 'a'.repeat(64), isExported: true })
    );
    const nodeB = store.addNode(
      VIGModel.createNode({ kind: 'SOURCE_FILE', path: 'src/ModB.ts', name: 'ModB.ts', contentHash: 'b'.repeat(64), isExported: true })
    );

    const edge = VIGModel.createEdge({
      sourceCid: nodeB.cid,
      targetCid: nodeA.cid,
      relation: 'IMPORTS',
      isPublicApi: false,
    });

    // 1. Add edge first time
    const added1 = store.addEdge(edge);
    assert.strictEqual(added1.edgeId, edge.edgeId);
    assert.strictEqual(store.edgeCount, 1);

    // 2. Add identical edge second time (idempotent duplicate)
    const added2 = store.addEdge(edge);
    assert.strictEqual(added2.edgeId, edge.edgeId);
    assert.strictEqual(store.edgeCount, 1, 'Edge count must remain 1');
    assert.strictEqual(store.getOutgoingEdges(nodeB.cid).length, 1);
    assert.strictEqual(store.getIncomingEdges(nodeA.cid).length, 1);

    // 3. Add edge with conflicting attribute (same edgeId but different isPublicApi)
    const conflictingEdge = { ...edge, isPublicApi: true };
    assertThrows(
      () => store.addEdge(conflictingEdge),
      VIGConflictError,
      'Edge collision with conflicting attributes'
    );

    console.log('  ✓ Duplicate edge idempotency and collision handling verified.');
  }

  // ============================================================================
  // Suite 7: Real TypeScript AST Extraction & Symbol Relationships
  // ============================================================================
  console.log('\n[Suite 7] Real TypeScript AST Extraction & Relationships...');
  {
    const sourceCode = `
      import { Tensor } from './tensor/Tensor';
      export { Tensor } from './tensor/Tensor'; // Public re-export

      export interface IRunner {
        run(): void;
      }

      export class BaseEngine {
        public init(): void {}
      }

      export class HeavyEngine extends BaseEngine implements IRunner {
        private counter: number = 0;

        public run(): void {
          this.step();
        }

        private step(): void {
          helperLog('stepping');
        }
      }

      function helperLog(msg: string): void {
        console.log(msg);
      }

      export const DEFAULT_TIMEOUT = 5000;
    `;

    const res = VIGASTExtractor.extractFromSource('src/engine/HeavyEngine.ts', sourceCode);

    // 1. Node counts and classifications
    const fileNode = res.nodes.find((n) => n.kind === 'SOURCE_FILE');
    assert(fileNode, 'Must extract SOURCE_FILE node');
    assert.strictEqual(fileNode.path, 'src/engine/HeavyEngine.ts');

    const declarations = res.nodes.filter((n) => n.kind === 'AST_DECLARATION');
    const symbolNames = declarations.map((n) => n.name).sort();
    assert(symbolNames.includes('IRunner'), 'Must extract interface IRunner');
    assert(symbolNames.includes('BaseEngine'), 'Must extract class BaseEngine');
    assert(symbolNames.includes('HeavyEngine'), 'Must extract class HeavyEngine');
    assert(symbolNames.includes('HeavyEngine.run'), 'Must extract method HeavyEngine.run');
    assert(symbolNames.includes('HeavyEngine.step'), 'Must extract method HeavyEngine.step');
    assert(symbolNames.includes('helperLog'), 'Must extract function helperLog');
    assert(symbolNames.includes('DEFAULT_TIMEOUT'), 'Must extract exported const DEFAULT_TIMEOUT');

    // 2. DEFINES_SYMBOL edges
    const definesEdges = res.edges.filter((e) => e.relation === 'DEFINES_SYMBOL');
    assert(definesEdges.length >= 6, 'Must generate DEFINES_SYMBOL edges for declarations');

    // 3. EXTENDS_OR_IMPLEMENTS intra-file edges
    const extendsEdges = res.edges.filter((e) => e.relation === 'EXTENDS_OR_IMPLEMENTS');
    assert(extendsEdges.length >= 1, 'Must extract inheritance edges');

    // 4. Intra-file CALLS edges (HeavyEngine.step -> helperLog)
    const callEdges = res.edges.filter((e) => e.relation === 'CALLS');
    assert(callEdges.length >= 1, 'Must extract CALLS edges');

    console.log('  ✓ Real TypeScript AST extraction and intra-file relationships verified.');
  }

  // ============================================================================
  // Suite 8: Unresolved Imports, Missing Nodes & Syntax Error Handling
  // ============================================================================
  console.log('\n[Suite 8] Unresolved Imports, Missing Nodes & Syntax Error Tolerance...');
  {
    // Code with:
    // 1. External package import ('fs', 'crypto')
    // 2. Unresolved relative import ('./does/not/exist')
    // 3. Deliberate syntax error (missing brace, malformed token)
    const malformedSource = `
      import * as fs from 'fs';
      import { missingSymbol } from './does/not/exist';

      export function brokenFunction(x: number {
        return x + 1;
      // missing closing brace
    `;

    // AST Extractor must NOT throw; must be resilient and return diagnostics
    const res = VIGASTExtractor.extractFromSource('src/broken/Broken.ts', malformedSource);

    // 1. Source file node is still created
    assert.strictEqual(res.nodes.length >= 1, true, 'Must create file node even on syntax errors');

    // 2. Unresolved imports recorded cleanly
    assert(res.unresolvedImports.length >= 2, 'Must record unresolved imports');
    const fsImport = res.unresolvedImports.find((u) => u.specifier === 'fs');
    assert(fsImport, 'Must capture external package import "fs"');
    assert.strictEqual(fsImport.reason, 'External package dependency');

    const missingImport = res.unresolvedImports.find((u) => u.specifier === './does/not/exist');
    assert(missingImport, 'Must capture missing relative import');

    // 3. Syntax error diagnostics recorded
    assert(res.diagnostics.length > 0, 'Must record syntax error diagnostic');
    assert(res.diagnostics.some((d) => d.level === 'warning' || d.level === 'error'));

    // 4. Missing node referential integrity:
    // Attempting to add an edge pointing to a non-existent CID in VIGGraphStore must fail-closed
    const store = new VIGGraphStore();
    const goodNode = store.addNode(
      VIGModel.createNode({
        kind: 'SOURCE_FILE',
        path: 'src/Good.ts',
        name: 'Good.ts',
        contentHash: 'f'.repeat(64),
        isExported: true,
      })
    );

    const danglingEdge = VIGModel.createEdge({
      sourceCid: goodNode.cid,
      targetCid: '0'.repeat(64), // Does not exist
      relation: 'IMPORTS',
      isPublicApi: false,
    });

    assertThrows(
      () => store.addEdge(danglingEdge),
      VIGValidationError,
      'Referential integrity failure'
    );

    console.log('  ✓ Unresolved imports, missing nodes, and syntax errors handled safely.');
  }

  // ============================================================================
  // Suite 9: Spatial Memory [0..368] Strict Boundary Preservation
  // ============================================================================
  console.log('\n[Suite 9] 369 Spatial Memory Boundary Separation...');
  {
    // Ensure VIGNode can reference CanonicalAddress369 [0..368] as a foreign key attribute
    // without ever storing AST nodes or graph edges into the physical spatial lattice.
    const validSpatialNode = VIGModel.createNode({
      kind: 'SOURCE_FILE',
      path: 'src/one/programs/spatial_engine.one',
      name: 'spatial_engine.one',
      contentHash: '9'.repeat(64),
      isExported: true,
      spatialAddress: 197, // Center coordinate [3, 3, 3] in 7x7x7 lattice
    });
    assert.strictEqual(validSpatialNode.spatialAddress, 197);

    // Out-of-bounds spatial address (e.g. 369) must be rejected fail-closed
    assertThrows(
      () =>
        VIGModel.createNode({
          kind: 'SOURCE_FILE',
          path: 'src/one/programs/invalid.one',
          name: 'invalid.one',
          contentHash: '9'.repeat(64),
          isExported: true,
          spatialAddress: 369, // Out of bounds
        }),
      VIGValidationError,
      'outside valid CanonicalAddress369 range'
    );

    console.log('  ✓ Spatial Memory [0..368] strict boundary separation verified.');
  }

  // ============================================================================
  // Suite 10: BUG-C02 Regression — Dynamic import() and require() Discovery
  // ============================================================================
  console.log('\n[Suite 10] BUG-C02: Dynamic import() and CommonJS require() Dependency Discovery...');
  {
    // Part A: Intra-file AST extraction with nodeResolver
    const fileA = 'src/ModuleA.ts';
    const fileB = 'src/ModuleB.ts';
    const fileC = 'src/ModuleC.ts';
    const testFile = 'tests/ModuleA.test.ts';

    const sourceA = `
      const b = require('./ModuleB');
      export async function loadSubmodule() {
        const c = await import('./ModuleC');
        const computed = await import(getDynamicName());
      }
      const fake = { require: (x: any) => x };
      fake.require('./NotARealImport');
    `;

    const sourceB = `export const bVal = 42;`;
    const sourceC = `export const cVal = 100;`;
    const sourceTest = `
      const modA = require('../src/ModuleA');
    `;

    const nodeA = VIGModel.createNode({ kind: 'SOURCE_FILE', path: fileA, name: 'ModuleA.ts', contentHash: 'a'.repeat(64), isExported: true });
    const nodeB = VIGModel.createNode({ kind: 'SOURCE_FILE', path: fileB, name: 'ModuleB.ts', contentHash: 'b'.repeat(64), isExported: true });
    const nodeC = VIGModel.createNode({ kind: 'SOURCE_FILE', path: fileC, name: 'ModuleC.ts', contentHash: 'c'.repeat(64), isExported: true });

    const nodeMap = new Map<string, VIGNode>([
      [fileA, nodeA],
      [fileB, nodeB],
      [fileC, nodeC],
    ]);

    const knownFiles = new Set<string>([fileA, fileB, fileC]);

    const resultA = VIGASTExtractor.extractFromSource(fileA, sourceA, {
      knownFiles,
      nodeResolver: (p) => nodeMap.get(p),
    });

    // 1. Both ModuleB (require) and ModuleC (import) must have IMPORTS edges
    const importedTargetCids = resultA.edges.filter((e) => e.relation === 'IMPORTS').map((e) => e.targetCid);
    assert(importedTargetCids.includes(nodeB.cid), 'CommonJS require must produce an IMPORTS edge');
    assert(importedTargetCids.includes(nodeC.cid), 'Dynamic import() must produce an IMPORTS edge');

    // 2. Computed dynamic import must be recorded in unresolvedImports without crashing
    const computedUnresolved = resultA.unresolvedImports.find((u) => u.reason.includes('Computed dynamic import'));
    assert(computedUnresolved !== undefined, 'Computed dynamic import must be recorded in unresolvedImports');

    // 3. Fake method call fake.require(...) must NOT produce a false-positive edge or unresolved import
    const falsePositive = resultA.unresolvedImports.find((u) => u.specifier === './NotARealImport');
    assert.strictEqual(falsePositive, undefined, 'fake.require() must not be captured as an import');

    // Part B: Test suite require must produce TESTS_MODULE edge
    const testNode = VIGModel.createNode({ kind: 'TEST_SUITE', path: testFile, name: 'ModuleA.test.ts', contentHash: 'd'.repeat(64), isExported: true });
    nodeMap.set(testFile, testNode);
    knownFiles.add(testFile);

    const resultTest = VIGASTExtractor.extractFromSource(testFile, sourceTest, {
      knownFiles,
      nodeResolver: (p) => nodeMap.get(p),
    });
    const testEdges = resultTest.edges.filter((e) => e.relation === 'TESTS_MODULE');
    assert.strictEqual(testEdges.length, 1, 'require in TEST_SUITE must produce a TESTS_MODULE edge');
    assert.strictEqual(testEdges[0].targetCid, nodeA.cid);

    // Part C: Multi-file project extraction (extractProject) with dynamic imports and require
    const projectFiles = new Map<string, string>([
      [fileA, sourceA],
      [fileB, sourceB],
      [fileC, sourceC],
      [testFile, sourceTest],
    ]);

    const projectResult = VIGASTExtractor.extractProject(projectFiles);
    const projImportEdges = projectResult.edges.filter((e) => e.relation === 'IMPORTS');
    const projTestEdges = projectResult.edges.filter((e) => e.relation === 'TESTS_MODULE');

    // File nodes created in project extraction:
    const projNodeA = projectResult.nodes.find((n) => n.path === fileA);
    const projNodeB = projectResult.nodes.find((n) => n.path === fileB);
    const projNodeC = projectResult.nodes.find((n) => n.path === fileC);
    assert(projNodeA && projNodeB && projNodeC, 'All project nodes must be indexed');

    const modAImportTargets = projImportEdges.filter((e) => e.sourceCid === projNodeA.cid).map((e) => e.targetCid);
    assert(modAImportTargets.includes(projNodeB.cid), 'extractProject must discover CommonJS require edge');
    assert(modAImportTargets.includes(projNodeC.cid), 'extractProject must discover dynamic import edge');
    assert(projTestEdges.length >= 1, 'extractProject must discover TESTS_MODULE edge from require in test file');

    console.log('  ✓ BUG-C02: Dynamic import() and CommonJS require() dependency discovery verified.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ALL VIG PHASE 3 DEPENDENCY GRAPH SUITES PASSED (100%)');
  console.log('='.repeat(80) + '\n');
}

// Auto-execute when run as direct script
runVIGDependencyGraphTests();
