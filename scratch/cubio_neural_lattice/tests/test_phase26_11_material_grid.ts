/**
 * Gate CNL-P26.11: Test Suite — Spatial Material Grid & Permittivity Mapping
 *
 * T1:  LATTICE_SIZE = 343, LATTICE_DIMENSION = 7, CENTER_CELL_ID = 171
 * T2:  coordinateToIndex(3, 3, 3) = 171 (center cell)
 * T3:  indexToCoordinate(171) = {x: 3, y: 3, z: 3}
 * T4:  Boundary coords (0,0,0)=0, (6,6,6)=342, out of bounds -> -1
 * T5:  Default initialization fills all 343 cells as AIR
 * T6:  AIR properties: epsilon_r = 1.0, density = 1.204, isObstacle = false
 * T7:  Negative or >342 cellId assign returns default AIR properties
 * T8:  Assign CONCRETE: epsilon_r = 6.5, density = 2300, isObstacle = true
 * T9:  Assign METAL: epsilon_r = 1.0, density = 7850, isObstacle = true
 * T10: Assign HUMAN_MASS: epsilon_r = 50.0, density = 985, isObstacle = true
 * T11: AIR wave velocity factor = 1.0 / sqrt(1.0) = 1.0
 * T12: AIR energy pressure = P_in * 1.204 * 1.0 * 0.001
 * T13: AIR status = "UNOBSTRUCTED_FREE_SPACE"
 * T14: CONCRETE wave velocity factor = 1.0 / sqrt(6.5) ≈ 0.392232
 * T15: CONCRETE status = "SOLID_INTERFERENCE_DETECTED"
 * T16: CONCRETE energy pressure (P=100) = 100 * 2300 * 6.5 * 0.001 = 1495.0
 * T17: METAL wave velocity factor = 1.0 / sqrt(1.0) = 1.0
 * T18: METAL status = "SOLID_INTERFERENCE_DETECTED"
 * T19: METAL energy pressure (P=100) = 100 * 7850 * 1.0 * 0.001 = 785.0
 * T20: HUMAN_MASS wave velocity factor = 1.0 / sqrt(50.0) ≈ 0.141421
 * T21: HUMAN_MASS status = "SOLID_INTERFERENCE_DETECTED"
 * T22: HUMAN_MASS energy pressure (P=100) = 100 * 985 * 50.0 * 0.001 = 4925.0
 * T23: PQC lattice seal valid format (^0xPQC_369_[0-9a-f]{32}_SEAL$)
 * T24: Determinism (σ² = 0.0): identical inputs yield identical PQC seal
 * T25: scanLatticeInterference calculates correct counts (obstacle vs freespace)
 * T26: scanLatticeInterference verifies immutable constraints: isActuationBlocked, uup, sigmaSq
 * T27: formatMaterialReport output contains all critical telemetry fields
 */

import {
  CUBiOMaterialLayer,
  MaterialType,
  LATTICE_DIMENSION,
  LATTICE_SIZE,
  CENTER_CELL_ID,
  formatMaterialReport,
} from '../../../src/one/spatial_material_grid_engine';

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    const msg = detail ? `${label} — ${detail}` : label;
    console.error(`  ❌ FAIL  ${msg}`);
    failed++;
    errors.push(msg);
  }
}

function approxEq(a: number, b: number, tol = 1e-5): boolean {
  return Math.abs(a - b) <= tol;
}

function runTests(): void {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  Gate CNL-P26.11: Spatial Material Grid & Permittivity Tests');
  console.log('════════════════════════════════════════════════════════════════\n');

  // ── T1: Constants ──────────────────────────────────────────────────────────
  assert('T1:  LATTICE_SIZE = 343, LATTICE_DIMENSION = 7, CENTER_CELL_ID = 171',
    LATTICE_SIZE === 343 && LATTICE_DIMENSION === 7 && CENTER_CELL_ID === 171);

  // ── T2–T4: Coordinates and Indices ─────────────────────────────────────────
  const centerIdx = CUBiOMaterialLayer.coordinateToIndex(3, 3, 3);
  assert('T2:  coordinateToIndex(3, 3, 3) = 171 (origin cell)', centerIdx === 171);

  const centerCoord = CUBiOMaterialLayer.indexToCoordinate(171);
  assert('T3:  indexToCoordinate(171) = {x:3, y:3, z:3}',
    centerCoord.x === 3 && centerCoord.y === 3 && centerCoord.z === 3);

  const minIdx = CUBiOMaterialLayer.coordinateToIndex(0, 0, 0);
  const maxIdx = CUBiOMaterialLayer.coordinateToIndex(6, 6, 6);
  const oobIdx = CUBiOMaterialLayer.coordinateToIndex(7, 0, 0);
  const oobCoord = CUBiOMaterialLayer.indexToCoordinate(343);
  assert('T4:  Boundary coords (0,0,0)=0, (6,6,6)=342, out of bounds -> -1',
    minIdx === 0 && maxIdx === 342 && oobIdx === -1 && oobCoord.x === -1);

  // ── T5–T7: Material Assignment ─────────────────────────────────────────────
  const grid = new CUBiOMaterialLayer();
  const c0 = grid.getCell(0);
  const cCenter = grid.getCell(171);
  assert('T5:  Default initialization fills all cells as AIR',
    c0.material === MaterialType.AIR && cCenter.material === MaterialType.AIR);

  assert('T6:  AIR properties: epsilon_r = 1.0, density = 1.204, isObstacle = false',
    c0.permittivityEpsilonR === 1.0 && c0.densityKgM3 === 1.204 && !c0.isObstacle);

  const oobProps = grid.assignMaterial(-10, MaterialType.CONCRETE);
  assert('T7:  Out of bounds assign returns default AIR properties',
    oobProps.material === MaterialType.AIR && !oobProps.isObstacle);

  const concreteProps = grid.assignMaterial(10, MaterialType.CONCRETE);
  assert('T8:  Assign CONCRETE: epsilon_r = 6.5, density = 2300, isObstacle = true',
    concreteProps.material === MaterialType.CONCRETE &&
    concreteProps.permittivityEpsilonR === 6.5 &&
    concreteProps.densityKgM3 === 2300.0 &&
    concreteProps.isObstacle);

  const metalProps = grid.assignMaterial(50, MaterialType.METAL);
  assert('T9:  Assign METAL: epsilon_r = 1.0, density = 7850, isObstacle = true',
    metalProps.material === MaterialType.METAL &&
    metalProps.permittivityEpsilonR === 1.0 &&
    metalProps.densityKgM3 === 7850.0 &&
    metalProps.isObstacle);

  const humanProps = grid.assignMaterial(CENTER_CELL_ID, MaterialType.HUMAN_MASS);
  assert('T10: Assign HUMAN_MASS: epsilon_r = 50.0, density = 985, isObstacle = true',
    humanProps.material === MaterialType.HUMAN_MASS &&
    humanProps.permittivityEpsilonR === 50.0 &&
    humanProps.densityKgM3 === 985.0 &&
    humanProps.isObstacle);

  // ── T11–T13: Wave Interaction on AIR ───────────────────────────────────────
  const airRes = grid.evaluateCell(0, 100.0);
  assert('T11: AIR wave velocity factor = 1.0 / sqrt(1.0) = 1.0',
    approxEq(airRes.propagationVelocityFactor, 1.0));
  const expectedAirPressure = 100.0 * 1.204 * 1.0 * 0.001;
  assert('T12: AIR energy pressure = P_in * 1.204 * 1.0 * 0.001',
    approxEq(airRes.energyDensityPressure, expectedAirPressure));
  assert('T13: AIR status = "UNOBSTRUCTED_FREE_SPACE"',
    airRes.status === 'UNOBSTRUCTED_FREE_SPACE');

  // ── T14–T16: Wave Interaction on CONCRETE ──────────────────────────────────
  const concreteRes = grid.evaluateCell(10, 100.0);
  const expectedConcreteV = 1.0 / Math.sqrt(6.5);
  assert('T14: CONCRETE wave velocity factor = 1.0 / sqrt(6.5) ≈ 0.392232',
    approxEq(concreteRes.propagationVelocityFactor, expectedConcreteV));
  assert('T15: CONCRETE status = "SOLID_INTERFERENCE_DETECTED"',
    concreteRes.status === 'SOLID_INTERFERENCE_DETECTED');
  const expectedConcreteP = 100.0 * 2300.0 * 6.5 * 0.001; // = 1495.0
  assert('T16: CONCRETE energy pressure (P=100) = 1495.0',
    approxEq(concreteRes.energyDensityPressure, expectedConcreteP));

  // ── T17–T19: Wave Interaction on METAL ─────────────────────────────────────
  const metalRes = grid.evaluateCell(50, 100.0);
  assert('T17: METAL wave velocity factor = 1.0 / sqrt(1.0) = 1.0',
    approxEq(metalRes.propagationVelocityFactor, 1.0));
  assert('T18: METAL status = "SOLID_INTERFERENCE_DETECTED"',
    metalRes.status === 'SOLID_INTERFERENCE_DETECTED');
  const expectedMetalP = 100.0 * 7850.0 * 1.0 * 0.001; // = 785.0
  assert('T19: METAL energy pressure (P=100) = 785.0',
    approxEq(metalRes.energyDensityPressure, expectedMetalP));

  // ── T20–T22: Wave Interaction on HUMAN_MASS ────────────────────────────────
  const humanRes = grid.evaluateCell(CENTER_CELL_ID, 100.0);
  const expectedHumanV = 1.0 / Math.sqrt(50.0);
  assert('T20: HUMAN_MASS wave velocity factor = 1.0 / sqrt(50.0) ≈ 0.141421',
    approxEq(humanRes.propagationVelocityFactor, expectedHumanV));
  assert('T21: HUMAN_MASS status = "SOLID_INTERFERENCE_DETECTED"',
    humanRes.status === 'SOLID_INTERFERENCE_DETECTED');
  const expectedHumanP = 100.0 * 985.0 * 50.0 * 0.001; // = 4925.0
  assert('T22: HUMAN_MASS energy pressure (P=100) = 4925.0',
    approxEq(humanRes.energyDensityPressure, expectedHumanP));

  // ── T23–T24: PQC Seal & Determinism ────────────────────────────────────────
  assert('T23: PQC lattice seal valid format',
    /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(humanRes.pqcSeal));

  const humanRes2 = grid.evaluateCell(CENTER_CELL_ID, 100.0);
  assert('T24: Determinism (σ² = 0.0): identical inputs yield identical PQC seal',
    humanRes.pqcSeal === humanRes2.pqcSeal);

  // ── T25–T26: Full Lattice Scan ─────────────────────────────────────────────
  // Currently cells 10, 50, and 171 are obstacles (3 obstacles, 340 free space)
  const scan = grid.scanLatticeInterference(100.0);
  assert('T25: scanLatticeInterference calculates correct counts',
    scan.totalCells === 343 && scan.obstacleCount === 3 && scan.freeSpaceCount === 340);

  assert('T26: scanLatticeInterference verifies immutable constraints',
    scan.isActuationBlocked === true && scan.uup === 1.0 && scan.sigmaSq === 0.0);

  // ── T27: Report Formatter ──────────────────────────────────────────────────
  const reportStr = formatMaterialReport(humanRes, humanProps);
  assert('T27: formatMaterialReport output contains all critical telemetry fields',
    reportStr.includes('Target Cell ID       : 171') &&
    reportStr.includes('HUMAN_MASS') &&
    reportStr.includes('Permittivity (ε_r)   : 50.00') &&
    reportStr.includes('SOLID_INTERFERENCE_DETECTED') &&
    reportStr.includes('PQC Lattice Seal'));

  printSummary();
}

function printSummary(): void {
  const total = passed + failed;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`  GATE CNL-P26.11 TEST RESULTS: ${passed}/${total} PASS`);
  if (failed > 0) {
    console.log('\n  Failed:');
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }
  console.log('════════════════════════════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

runTests();
