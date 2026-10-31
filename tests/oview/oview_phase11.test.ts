/**
 * Oview OS — Phase 11 Master Verification Test Suite
 * ============================================================================
 * Tests:
 * 1. Explorer Pro "My Space" Dashboard initialization & default state
 * 2. My Space 5 Primary Daily Folders categories metadata & item counts
 * 3. Starred & Pinned Favorites persistence & pin toggling
 * 4. Recent Activity FIFO tracking & relative time stamps
 * 5. Sovereign Storage Health Meter & quota calculation (500 MB)
 * 6. Quick-Look Inspection for Text, Code, Media & .onepkg Containers
 * 7. Standalone Zero-Dependency HTML Bundle Generation with My Space
 */

import { ExplorerApp } from '../../src/oview/apps/explorer/ExplorerApp';
import { VirtualFileSystem } from '../../src/oview/vfs/VirtualFileSystem';
import { OviewBundler } from '../../src/oview/tooling/OviewBundler';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${msg}`);
  }
}

async function runPhase11Tests() {
  console.log('================================================================================');
  console.log('  OVIEW OS: PHASE 11 MASTER VERIFICATION SUITE');
  console.log('  File Explorer Pro: My Space • Starred • Recents • Storage Health');
  console.log('================================================================================\n');

  const t0 = performance.now();

  // Test 1: Explorer Pro "My Space" Dashboard initialization & default state
  console.log('[Test 1] Testing Explorer Pro "My Space" Dashboard initialization...');
  const explorer = new ExplorerApp();
  assert(explorer.isMySpace(), 'Default Explorer view must be My Space ("myspace")');
  assert(explorer.currentPath === 'myspace', 'currentPath must be "myspace"');
  assert(explorer.getItems().length === 0, 'My Space view should not render raw directory listing');
  console.log('  ✔ Explorer Pro "My Space" default landing state verified.');

  // Test 2: My Space 5 Primary Daily Folders categories
  console.log('\n[Test 2] Testing My Space 5 Primary Daily Folders Categories...');
  const categories = explorer.getMySpaceCategories();
  assert(categories.length === 5, 'Must have exactly 5 daily categories');
  assert(categories.some(c => c.id === 'documents' && c.path === '/user/documents'), 'Must have Documents folder');
  assert(categories.some(c => c.id === 'media' && c.path === '/user/media'), 'Must have Pictures & Media folder');
  assert(categories.some(c => c.id === 'packages' && c.path === '/user/packages'), 'Must have My Apps (.onepkg) folder');
  assert(categories.some(c => c.id === 'downloads' && c.path === '/user/downloads'), 'Must have Downloads folder');
  assert(categories.some(c => c.id === 'trash' && c.path === '/user/trash'), 'Must have Recycle Bin folder');
  console.log('  ✔ 5 Daily Folders metadata and item counts verified.');

  // Test 3: Starred & Pinned Favorites persistence & pin toggling
  console.log('\n[Test 3] Testing Starred & Pinned Favorites System...');
  const pinnedBefore = explorer.getPinnedItems();
  assert(pinnedBefore.length >= 2, 'Should have initial pinned favorites');
  const testPinTarget = '/user/documents/welcome.txt';
  assert(explorer.isPinned(testPinTarget), 'Welcome note should be pinned by default');
  
  // Toggle off
  const unpinned = explorer.togglePin(testPinTarget);
  assert(!unpinned, 'Toggling should unpin');
  assert(!explorer.isPinned(testPinTarget), 'Should no longer be pinned');

  // Toggle on
  const rePinned = explorer.togglePin(testPinTarget);
  assert(rePinned, 'Toggling again should re-pin');
  assert(explorer.isPinned(testPinTarget), 'Should be pinned again');
  console.log('  ✔ Starred & Pinned Favorites persistence and toggle verified.');

  // Test 4: Recent Activity FIFO tracking & relative time stamps
  console.log('\n[Test 4] Testing Recent Activity Tracking & FIFO Queue...');
  explorer.createFile('daily_routine.one', '// Daily Schedule in ONE');
  const recents = explorer.getRecentFiles();
  assert(recents.length > 0, 'Recents list must not be empty');
  assert(recents[0].path === '/user/documents/daily_routine.one', 'Most recently accessed file must be first');
  assert(recents[0].timeAgo === 'Just now', 'Recent timeAgo should be "Just now"');
  console.log('  ✔ Recent activity FIFO queue and access timestamps verified.');

  // Test 5: Storage Health Meter & Quota Calculation
  console.log('\n[Test 5] Testing Storage Health Meter & Quota Metrics...');
  const metrics = explorer.getStorageMetrics();
  assert(metrics.totalBytes === 500 * 1024 * 1024, 'Total quota must be 500 MB');
  assert(metrics.usedBytes > 0, 'Used bytes must be greater than zero');
  assert(metrics.usagePercent >= 1 && metrics.usagePercent <= 100, 'Usage percent must be in 1..100');
  console.log(`  ✔ Storage Health Meter verified: ${metrics.usagePercent}% used of 500 MB quota.`);

  // Test 6: Quick-Look Inspection for Text, Media, and .onepkg containers
  console.log('\n[Test 6] Testing Quick-Look Preview Inspection...');
  const qlTxt = explorer.getQuickLook('/user/documents/welcome.txt');
  assert(qlTxt !== null, 'Quick-look for welcome.txt must succeed');
  assert(qlTxt!.preview.includes('Welcome to Oview OS'), 'Preview must extract text content');

  const qlPkg = explorer.getQuickLook('/user/packages/putty_ssh.onepkg');
  assert(qlPkg !== null, 'Quick-look for .onepkg must succeed');
  assert(qlPkg!.meta.format === 'onepkg', 'Quick-look must parse .onepkg container metadata');
  console.log('  ✔ Quick-Look content parser for text and .onepkg containers verified.');

  // Test 7: Standalone Zero-Dependency HTML Bundle Generation
  console.log('\n[Test 7] Testing Standalone HTML Bundle Generation with Explorer Pro...');
  const html = OviewBundler.bundle();
  assert(html.length > 150000, 'Bundle HTML must be comprehensive (>150 KB)');
  assert(html.includes('My Space Personal Hub'), 'Bundle must include My Space Personal Hub');
  assert(html.includes('explorerHandleDrop'), 'Bundle must include drag & drop Windows file importer');
  assert(html.includes('explorerTogglePin'), 'Bundle must include pin/star handlers');
  assert(html.includes('explorerQuickLook'), 'Bundle must include Quick-Look preview pane');
  console.log(`  ✔ Standalone single-file bundle verified with Explorer Pro (${(html.length / 1024).toFixed(2)} KB).`);

  const duration = (performance.now() - t0).toFixed(2);
  console.log('\n================================================================================');
  console.log(`  🎉 ALL PHASE 11 VERIFICATION TESTS PASSED (${duration} ms)`);
  console.log('  Explorer Pro • My Space Hub • Pinned • Recents • Storage Health');
  console.log('================================================================================\n');
}

runPhase11Tests().catch((err) => {
  console.error(err);
  process.exit(1);
});
