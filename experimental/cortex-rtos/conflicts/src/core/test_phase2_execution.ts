import { OneLexer } from '../one/oneLexer';
import { OneParser } from '../one/oneParser';
import { OneCompiler } from '../one/oneCompiler';
import { CubiOVirtualMachine } from './engine/cubioVM';

const phase2Program = `
rss_max = 512;

node GeneratorNode {
  @Space(0.000, 0.500, 0.500);
  align => (0.100, 0.500, 0.500);
  checkpoint init;
}

node CollectorNode {
  @Space(0.900, 0.900, 0.900);
  checkpoint sink;
}

funnel SpatialDataPipeline {
  stream GeneratorNode -> CollectorNode : 256;
}
`;

function runPhase2TestSuite(): void {
  console.log('=== CubiO Core Engine Phase 2 Runtime Verification ===\n');

  try {
    // Pipeline compilation
    const lexer = new OneLexer(phase2Program);
    const parser = new OneParser(lexer.tokenize());
    const compiler = new OneCompiler(parser.parse());
    const executableAST = compiler.compile();

    // VM Execution
    const vm = new CubiOVirtualMachine();
    vm.execute(executableAST);

    const state = vm.getVMState();
    console.log('\n--- Final VM State Verification ---');
    console.log(`Active Spatial Nodes : ${state.nodesCount}`);
    console.log(`Active Stream Funnels: ${state.streamsCount}`);
    console.log(`Physical Memory Usage: ${state.allocatedMemoryMb.toFixed(3)} / 512 MB`);
    console.log(`Determinism Variance : σ² = ${state.determinismSigmaSq.toFixed(1)}`);

    if (state.allocatedMemoryMb <= 512 && state.determinismSigmaSq === 0.0) {
      console.log('\n✅ PASS: Phase 2 Core Runtime Engine Verified with 100% Determinism & Memory Enforcement.');
    } else {
      throw new Error('VM state bounds validation failed');
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Phase 2 Execution Error:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runPhase2TestSuite();
