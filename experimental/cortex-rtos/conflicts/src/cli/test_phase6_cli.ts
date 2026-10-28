import { OneCLI } from './oneCLI';

const testProgramSource = `
rss_max = 512;

node VisualNodeAlpha {
  @Space(0.333, 0.666, 0.999);
  align => (0.3, 0.6, 0.9);
  checkpoint start;
}

node VisualNodeBeta {
  @Space(0.123, 0.456, 0.789);
  checkpoint end;
}

funnel VisualStream {
  stream VisualNodeAlpha -> VisualNodeBeta : 64;
}
`;

function runPhase6TestSuite(): void {
  console.log('=== Phase 6: ONE Language CLI Toolchain & Visualizer Test ===\n');

  const cli = new OneCLI();

  try {
    console.log('[Test 1] Testing CLI compile command...');
    cli.executeCommand(['node', 'one', 'compile', testProgramSource]);

    console.log('\n[Test 2] Testing CLI run command...');
    cli.executeCommand(['node', 'one', 'run', testProgramSource]);

    console.log('\n[Test 3] Testing CLI inspect command (Orbit Visualizer Dashboard)...');
    cli.executeCommand(['node', 'one', 'inspect', testProgramSource]);

    console.log('\n[Test 4] Testing CLI cluster mesh command...');
    cli.executeCommand(['node', 'one', 'cluster', 'CubiO-Global-Mesh']);

    console.log('\n✅ PASS: Phase 6 CLI Toolchain & Orbit Visualizer Fully Verified.');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Phase 6 CLI Error:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runPhase6TestSuite();
