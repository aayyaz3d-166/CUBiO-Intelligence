/**
 * Oview OS — Phase 12 Master Verification Test Suite
 * ============================================================================
 * Tests:
 * 1. Osheets cell evaluation & binary arithmetic formulas (=A1+B1, =A1*2)
 * 2. Osheets statistical functions (=SUM, =AVG, =MIN, =MAX, =COUNT)
 * 3. Osheets CSV export & VFS persistence (/user/documents/budget_2026.osheet)
 * 4. Ocanvas infinite pan/zoom coordinates & spatial transform
 * 5. Ocanvas sticky notes, concept shapes & mind-mapping connectors
 * 6. ProcessManager 22-App Registration & Address369 Slots [110, 115]
 * 7. VFS sample documents creation (.osheet & .board)
 * 8. Standalone Zero-Dependency HTML Bundle Generation with Office & Creative Suite
 */

import { OsheetsApp } from '../../src/oview/apps/osheets/OsheetsApp';
import { OcanvasApp } from '../../src/oview/apps/ocanvas/OcanvasApp';
import { ProcessManager } from '../../src/oview/core/ProcessManager';
import { VirtualFileSystem } from '../../src/oview/vfs/VirtualFileSystem';
import { OviewBundler } from '../../src/oview/tooling/OviewBundler';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${msg}`);
  }
}

async function runPhase12Tests() {
  console.log('================================================================================');
  console.log('  OVIEW OS: PHASE 12 MASTER VERIFICATION SUITE');
  console.log('  Productivity Suite: Osheets (Excel) • Ocanvas (Whiteboard) • Slots [110, 115]');
  console.log('================================================================================\n');

  const t0 = performance.now();

  // Test 1: Osheets Cell Evaluation & Binary Arithmetic Formulas
  console.log('[Test 1] Testing Osheets Cell Evaluation & Binary Arithmetic Formulas...');
  const sheets = new OsheetsApp();
  sheets.setCellValue('E1', '10');
  sheets.setCellValue('E2', '20');
  sheets.setCellValue('E3', '=E1 + E2');
  assert(sheets.getComputedValue('E3') === '30', 'Formula =E1 + E2 must compute 30');

  sheets.setCellValue('E4', '=E1 * 5');
  assert(sheets.getComputedValue('E4') === '50', 'Formula =E1 * 5 must compute 50');
  console.log('  ✔ Cell evaluation and arithmetic binary formulas verified.');

  // Test 2: Osheets Statistical Functions (=SUM, =AVG, =MIN, =MAX, =COUNT)
  console.log('\n[Test 2] Testing Osheets Statistical Functions (=SUM, =AVG, =MIN, =MAX, =COUNT)...');
  sheets.setCellValue('F1', '10');
  sheets.setCellValue('F2', '20');
  sheets.setCellValue('F3', '30');
  sheets.setCellValue('F4', '40');

  sheets.setCellValue('F5', '=SUM(F1:F4)');
  assert(sheets.getComputedValue('F5') === '100', '=SUM(F1:F4) must equal 100');

  sheets.setCellValue('F6', '=AVG(F1:F4)');
  assert(sheets.getComputedValue('F6') === '25.00', '=AVG(F1:F4) must equal 25.00');

  sheets.setCellValue('F7', '=MIN(F1:F4)');
  assert(sheets.getComputedValue('F7') === '10', '=MIN(F1:F4) must equal 10');

  sheets.setCellValue('F8', '=MAX(F1:F4)');
  assert(sheets.getComputedValue('F8') === '40', '=MAX(F1:F4) must equal 40');

  sheets.setCellValue('F9', '=COUNT(F1:F4)');
  assert(sheets.getComputedValue('F9') === '4', '=COUNT(F1:F4) must equal 4');
  console.log('  ✔ All statistical functions (SUM, AVG, MIN, MAX, COUNT) verified.');

  // Test 3: Osheets CSV Export & VFS Persistence
  console.log('\n[Test 3] Testing Osheets CSV Export & VFS Persistence...');
  const csv = sheets.exportToCSV();
  assert(csv.includes('Item Description'), 'CSV must include header row');
  assert(csv.includes('Cloud Server VM'), 'CSV must include row items');
  sheets.saveToVFS('/user/documents/test_sheet.osheet');
  const vfs = VirtualFileSystem.getInstance();
  assert(vfs.exists('/user/documents/test_sheet.osheet'), 'VFS file must exist');
  console.log('  ✔ CSV generation and VFS sheet persistence verified.');

  // Test 4: Ocanvas Infinite Pan/Zoom Coordinates & Spatial Transform
  console.log('\n[Test 4] Testing Ocanvas Infinite Pan/Zoom Coordinates & Spatial Transform...');
  const canvas = new OcanvasApp();
  assert(canvas.zoom === 1.0, 'Default zoom must be 1.0 (100%)');
  canvas.setZoom(1.5);
  assert(canvas.zoom === 1.5, 'Zoom must update to 1.5');
  canvas.setPan(150, -80);
  assert(canvas.panX === 150 && canvas.panY === -80, 'Pan coordinates must update accurately');
  console.log('  ✔ Spatial pan and zoom coordinate transforms verified.');

  // Test 5: Ocanvas Sticky Notes, Concept Shapes & Mind-Mapping Connectors
  console.log('\n[Test 5] Testing Ocanvas Sticky Notes, Concept Shapes & Connectors...');
  const initialItemsCount = canvas.items.length;
  assert(initialItemsCount >= 3, 'Must have initial concept items');

  const sticky = canvas.addSticky('Test Architecture Note', 300, 300, '#fbcfe8');
  assert(sticky.type === 'sticky', 'Added item must be a sticky note');
  assert(sticky.text === 'Test Architecture Note', 'Sticky note text must match');

  const shape = canvas.addShape('Decision Gateway', 'diamond', 500, 200);
  assert(shape.type === 'shape', 'Added item must be a shape');

  const conn = canvas.addConnector(sticky.id, shape.id, 'Next Step');
  assert(conn.type === 'connector', 'Added item must be a connector');
  assert(conn.fromId === sticky.id && conn.toId === shape.id, 'Connector must link the two items');

  canvas.moveItem(sticky.id, 20, 30);
  assert(sticky.x === 320 && sticky.y === 330, 'moveItem must update item coordinates');
  console.log('  ✔ Sticky notes, shapes, connectors, and spatial manipulation verified.');

  // Test 6: ProcessManager 22-App Registration & Address369 Slots [110, 115]
  console.log('\n[Test 6] Testing ProcessManager 22-App Registration & Address369 Slots...');
  const pm = ProcessManager.getInstance();
  const registeredApps = pm.getRegisteredApps();
  assert(registeredApps.length >= 22, `Expected at least 22 registered native apps, got ${registeredApps.length}`);

  const osheetsApp = registeredApps.find(a => a.id === 'oview.osheets');
  assert(!!osheetsApp, 'oview.osheets must be registered');
  assert(osheetsApp!.memorySlot369 === 110, 'oview.osheets must be assigned Address369 Slot #110');

  const ocanvasApp = registeredApps.find(a => a.id === 'oview.ocanvas');
  assert(!!ocanvasApp, 'oview.ocanvas must be registered');
  assert(ocanvasApp!.memorySlot369 === 115, 'oview.ocanvas must be assigned Address369 Slot #115');
  console.log('  ✔ ProcessManager 22-app suite & Address369 Slots #110 & #115 verified.');

  // Test 7: VFS Sample Documents Creation
  console.log('\n[Test 7] Testing VFS Sample Documents Creation (.osheet & .board)...');
  canvas.saveToVFS('/user/documents/test_board.board');
  assert(vfs.exists('/user/documents/test_board.board'), 'Board file must exist in VFS');
  const boardContent = JSON.parse(vfs.readFile('/user/documents/test_board.board'));
  assert(boardContent.items.length >= 4, 'Saved board must contain canvas items');
  console.log('  ✔ VFS sample documents creation and JSON parsing verified.');

  // Test 8: Standalone HTML Bundle Generation with Office & Creative Suite
  console.log('\n[Test 8] Testing Standalone HTML Bundle Generation...');
  const html = OviewBundler.bundle();
  assert(html.length > 200000, 'Bundle must be >200 KB');
  assert(html.includes('renderOsheetsApp'), 'Bundle must include renderOsheetsApp');
  assert(html.includes('renderOcanvasApp'), 'Bundle must include renderOcanvasApp');
  assert(html.includes('osheetsEvaluateFormula'), 'Bundle must include Osheets formula engine');
  assert(html.includes('ocanvasAddSticky'), 'Bundle must include Ocanvas sticky note builder');
  console.log(`  ✔ Standalone single-file bundle verified with Osheets & Ocanvas (${(html.length / 1024).toFixed(2)} KB).`);

  const duration = (performance.now() - t0).toFixed(2);
  console.log('\n================================================================================');
  console.log(`  🎉 ALL PHASE 12 VERIFICATION TESTS PASSED (${duration} ms)`);
  console.log('  22 Native Apps • Osheets (Excel) • Ocanvas (Whiteboard) • 100% Sovereign');
  console.log('================================================================================\n');
}

runPhase12Tests().catch((err) => {
  console.error(err);
  process.exit(1);
});
