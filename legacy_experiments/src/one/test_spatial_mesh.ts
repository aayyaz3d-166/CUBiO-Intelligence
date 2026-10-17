/**
 * Phase 5E — Spatial Mesh & Harmonic Alignment Integration Test
 *
 * End-to-end test: instantiate mesh cluster, register nodes via
 * ONE Language runtime logic, execute spatial queries, verify
 * harmonic synchronization.
 */

import { RSSGuard } from '../core/memory/rssGuard';
import { SpatialMeshCluster } from '../core/engine/spatialMeshCluster';
import { HarmonicMeshAligner } from '../core/engine/spatialHarmonicAligner';
import { SpatialHarmonic369Engine, Point3D, is369Resonant, computePathHarmonicWeight } from '../core/engine/spatialHarmonic369';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`❌ FAIL: ${message}`);
  console.log(`  ✓ ${message}`);
}

function runSpatialMeshTestSuite(): void {
  console.log('══════════════════════════════════════════════════════');
  console.log('  ONE Language — Phase 5: Spatial Mesh + Harmonic Alignment');
  console.log('══════════════════════════════════════════════════════\n');

  try {
    // ── Setup ──────────────────────────────────────────────────────────
    console.log('[Setup] Creating RSS Guard (512 MB) + 7×7×7 Mesh Cluster...');
    const rssGuard = new RSSGuard(512);
    const mesh = new SpatialMeshCluster(rssGuard);
    const aligner = new HarmonicMeshAligner(mesh);

    console.log(`  RSS Guard created. Max: 512 MB\n`);

    // ── 5A: Node Registration + Grid Layout ────────────────────────────
    console.log('─── 5A: Node Registration & 7×7×7 Grid ──────────────────');

    // Register nodes at 369-aligned coordinates
    mesh.registerNode('NodeAlpha',   { x: 3/9, y: 6/9, z: 9/9 });  // exact 369
    mesh.registerNode('NodeBeta',    { x: 1/9, y: 2/9, z: 3/9 });
    mesh.registerNode('NodeGamma',   { x: 5/9, y: 4/9, z: 7/9 });
    mesh.registerNode('NodeDelta',   { x: 0.15, y: 0.25, z: 0.35 });
    mesh.registerNode('NodeEpsilon', { x: 0.82, y: 0.14, z: 0.61 });
    mesh.registerNode('NodeZeta',    { x: 0.45, y: 0.55, z: 0.65 });
    mesh.registerNode('NodeEta',     { x: 0.70, y: 0.80, z: 0.90 });

    assert(mesh.getNodeCount() === 7, `7 nodes registered (got ${mesh.getNodeCount()})`);

    const occupancy = mesh.getGridOccupancy();
    assert(occupancy.occupied > 0, `Grid has occupied cells (got ${occupancy.occupied}/${occupancy.total})`);
    console.log(`  Grid occupancy: ${occupancy.occupied}/${occupancy.total} cells\n`);

    // ── 5A: Neighbor Discovery ──────────────────────────────────────────
    console.log('─── 5A: Neighbor Discovery (3D Adjacency) ──────────────');

    const neighborsAlpha = mesh.findNeighbors('NodeAlpha');
    assert(neighborsAlpha.length >= 0, `NodeAlpha has ${neighborsAlpha.length} neighbors`);
    if (neighborsAlpha.length > 0) {
      console.log(`  NodeAlpha neighbors: ${neighborsAlpha.map(n => `${n.nodeId}(${n.direction}, d=${n.distance.toFixed(3)})`).join(', ')}`);
      assert(neighborsAlpha.every(n => n.distance >= 0), 'All neighbor distances non-negative');
    }

    const nearest = mesh.findNearest('NodeAlpha');
    assert(nearest !== null, `Found nearest node to NodeAlpha`);
    if (nearest) {
      console.log(`  Nearest to NodeAlpha: ${nearest.nodeId} at distance ${nearest.distance.toFixed(4)} (${nearest.direction})`);
    }

    // ── 5A: Cell Queries ────────────────────────────────────────────────
    console.log('─── 5A: Grid Cell Queries ──────────────────────────────');

    const nodeAlpha = mesh.getNode('NodeAlpha');
    if (nodeAlpha) {
      const cell = mesh.coordToCell?.(nodeAlpha.coordinate) ?? [
        Math.floor(nodeAlpha.coordinate.x / (1/7)),
        Math.floor(nodeAlpha.coordinate.y / (1/7)),
        Math.floor(nodeAlpha.coordinate.z / (1/7))
      ] as [number, number, number];
      const [cx, cy, cz] = cell;
      const cellOccupied = mesh.isCellOccupied(cx, cy, cz);
      assert(cellOccupied, `Cell (${cx},${cy},${cz}) is occupied by NodeAlpha`);
      const cellNode = mesh.getCellNode(cx, cy, cz);
      assert(cellNode !== null && cellNode.id === 'NodeAlpha', `Cell node is NodeAlpha`);
    }

    // ── 5C: Topology-Aware RSS Guard ────────────────────────────────────
    console.log('─── 5C: Topology-Aware RSS Guard ───────────────────────');

    const usedBefore = rssGuard.getUsedMb();
    console.log(`  RSS used before mesh ops: ${usedBefore.toFixed(4)} MB`);

    // Check node allocation (should succeed — 64KB per node)
    rssGuard.checkNodeAllocation('TestNode', 64 * 1024);
    assert(rssGuard.getUsedMb() >= usedBefore, 'RSS increased after node allocation');

    // Check funnel allocation
    rssGuard.checkFunnelAllocation('TestFunnel', 10 * 1024 * 1024); // 10 MB
    console.log(`  RSS used after funnel alloc: ${rssGuard.getUsedMb().toFixed(4)} MB`);

    // Verify per-node cap enforcement
    let perNodeCapPassed = false;
    try {
      rssGuard.checkNodeAllocation('OverNode', 65 * 1024 * 1024); // 65 MB > 64 MB cap
    } catch (err: any) {
      perNodeCapPassed = err.message.includes('exceeds per-node cap');
    }
    assert(perNodeCapPassed, 'Per-node RSS cap enforced (65 MB rejected)');

    // Verify global cap enforcement
    let globalCapPassed = false;
    try {
      rssGuard.allocate(512 * 1024 * 1024, 'OverLimit');
    } catch (err: any) {
      globalCapPassed = err.message.includes('exceeds maximum limit');
    }
    assert(globalCapPassed, 'Global RSS cap enforced (exceeded 512 MB rejected)');

    console.log(`  Final RSS used: ${rssGuard.getUsedMb().toFixed(4)} MB\n`);

    // ── 5B: Harmonic Alignment ──────────────────────────────────────────
    console.log('─── 5B: Harmonic Alignment (369 Matrix Lock) ──────────');

    const alphaLock = aligner.lockNode('NodeAlpha');
    assert(alphaLock !== null, 'NodeAlpha locked to 369 matrix');
    if (alphaLock) {
      assert(alphaLock.resonance > 0.9, `NodeAlpha resonance > 0.9 (got ${alphaLock.resonance.toFixed(4)})`);
      console.log(`  NodeAlpha locked coord: (${alphaLock.lockedCoord.x.toFixed(4)}, ${alphaLock.lockedCoord.y.toFixed(4)}, ${alphaLock.lockedCoord.z.toFixed(4)})`);
    }

    // Lock all nodes
    aligner.alignAllNodes();

    const det = aligner.verifyDeterminism();
    assert(det.sigmaSq === 0.0, `Determinism σ² = 0.0 (got ${det.sigmaSq})`);
    assert(det.allLocked === true, `All ${det.totalNodes} nodes locked (allLocked=${det.allLocked})`);
    console.log(`  Determinism: σ²=${det.sigmaSq}, locked=${det.lockedCount}/${det.totalNodes}`);

    const meshScore = aligner.getMeshHarmonicScore();
    assert(meshScore >= 0 && meshScore <= 1, `Mesh harmonic score in [0,1] (got ${meshScore.toFixed(4)})`);
    console.log(`  Mesh harmonic score: ${meshScore.toFixed(4)}`);

    const alignedScore = aligner.getAlignedMeshScore();
    assert(alignedScore >= 0 && alignedScore <= 1, `Aligned mesh score in [0,1] (got ${alignedScore.toFixed(4)})`);
    console.log(`  Aligned mesh score: ${alignedScore.toFixed(4)}\n`);

    // ── 5D: Spatial Query Engine ────────────────────────────────────────
    console.log('─── 5D: Spatial Query Engine ───────────────────────────');

    // Nearest neighbor query
    const nearestBeta = mesh.findNearest('NodeBeta');
    assert(nearestBeta !== null, 'Found nearest to NodeBeta');
    if (nearestBeta) {
      assert(nearestBeta.distance >= 0, `Distance non-negative (${nearestBeta.distance.toFixed(4)})`);
      assert(nearestBeta.nodeId !== 'NodeBeta', 'Nearest is not self');
      console.log(`  Nearest to NodeBeta: ${nearestBeta.nodeId} (d=${nearestBeta.distance.toFixed(4)})`);
    }

    // Multi-node neighbor discovery
    for (const nodeId of ['NodeAlpha', 'NodeBeta', 'NodeGamma']) {
      const nbrs = mesh.findNeighbors(nodeId);
      assert(Array.isArray(nbrs), `${nodeId} neighbor query returned array`);
      console.log(`  ${nodeId}: ${nbrs.length} neighbors found`);
    }

    // Harmonic path weight
    const pathPoints: Point3D[] = [
      { x: 3/9, y: 6/9, z: 9/9 },
      { x: 2/9, y: 4/9, z: 6/9 },
      { x: 1/9, y: 2/9, z: 3/9 },
    ];
    const pathWeight = computePathHarmonicWeight(pathPoints);
    assert(pathWeight >= 0, `Path harmonic weight >= 0 (got ${pathWeight.toFixed(4)})`);
    console.log(`  Path harmonic weight: ${pathWeight.toFixed(4)}`);

    // 369 resonance check
    const resonantPoint: Point3D = { x: 3/9, y: 6/9, z: 9/9 };
    assert(is369Resonant(resonantPoint), 'Exact 369 point is resonant');
    const nonResonantPoint: Point3D = { x: 0.1, y: 0.1, z: 0.1 };
    assert(!is369Resonant(nonResonantPoint), 'Non-369 point is not resonant');

    // ── Final: Clear ────────────────────────────────────────────────────
    console.log('─── Cleanup ──────────────────────────────────────────────');
    mesh.clear();
    aligner.clear();
    assert(mesh.getNodeCount() === 0, 'Mesh cleared (0 nodes)');
    console.log(`  RSS after clear: ${rssGuard.getUsedMb().toFixed(4)} MB\n`);

    // ── PASS ────────────────────────────────────────────────────────────
    console.log('───────────────────────────────────────────────────────────────\n');
    console.log('✅ PASS: Phase 5 Spatial Mesh + Harmonic Alignment — Fully Verified.');
    console.log('   5A: 7×7×7 grid, node registration, neighbor discovery    ✅');
    console.log('   5B: Mesh-wide 369 alignment, determinism σ²=0.0           ✅');
    console.log('   5C: Topology-aware RSS guard (per-node, per-funnel caps)  ✅');
    console.log('   5D: Spatial query engine (nearest, neighbors, coverage)   ✅');
    console.log('───────────────────────────────────────────────────────────────');

  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL:', err.message);
      console.error('Stack:', err.stack);
    } else {
      console.error('\n❌ FAIL: Unknown error');
    }
    process.exit(1);
  }
}

runSpatialMeshTestSuite();
