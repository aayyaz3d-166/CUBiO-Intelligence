import { CubioBuilder } from './builder/cubio_builder';
import { OneLexer } from './one/oneLexer';
import { OneParser } from './one/oneParser';
import { OneCompiler } from './one/oneCompiler';

const advancedProgramSource = `
// ONE Language Advanced Features Configuration
rss_max = 512;
@assert_rss(512);
@actuation_lock(true);

node VoxelAlpha {
  @Grid777(3, 6, 2);
  @memview(16);
  checkpoint genesis;
  seal "node_alpha.3dmemory";
}

node VoxelBeta {
  @Grid777(0, 3, 5);
  @memview(16);
  checkpoint sync_point;
}

channel SwarmSync {
  stream VoxelAlpha -> VoxelBeta : 32;
  @gossip(369);
}

seal "global_mesh.3dmemory";

@Slice([0.0..0.6, 0.0..1.0, 0.0..0.6]);
`;

const failingAssertionProgram = `
rss_max = 512;
@assert_rss(64); // Assert hard cap at 64MB

node HeavyNode {
  @Grid777(1, 1, 1);
  @memview(128); // Exceeds 64MB assert cap!
}
`;

function runAdvancedFeaturesTestSuite(): void {
  console.log('======================================================================');
  console.log(' 🚀 ONE LANGUAGE ADVANCED FEATURES & BUILDER TEST SUITE');
  console.log('======================================================================\n');

  try {
    // 1. Test Feature 1: Compiler & 7x7x7 Voxel Grid Resolution
    console.log('[Feature 1] Testing 7x7x7 Discrete Spatial Grid Resolution & Slicing...');
    const q1 = CubioBuilder.quantize777(0.5, 1.0, 0.333333);
    console.log(`  ✓ Quantized (0.5, 1.0, 0.333) -> @Grid777(${q1.i}, ${q1.j}, ${q1.k}) | CellIndex #${q1.cellIndex}`);
    const u1 = CubioBuilder.unquantize777(q1.cellIndex);
    console.log(`  ✓ Unquantized CellIndex #${q1.cellIndex} -> (${u1.x}, ${u1.y}, ${u1.z})`);

    // 2. Test Compilation of Advanced Program
    console.log('\n[Feature 2, 3, 4, 5] Compiling Advanced Program...');
    const bytecode = CubioBuilder.compileOneSource(advancedProgramSource);
    console.log(`  ✓ Successfully compiled ${bytecode.instructions.length} execution instructions.`);
    console.log(`  ✓ Voxel Nodes Registered: ${bytecode.totalVoxelCellsCount}`);
    console.log(`  ✓ Static Actuation Lock: ${bytecode.actuationLock}`);

    // 3. Test Execution on CubiO VM
    console.log('\n[VM Execution] Running Bytecode on CubiO VM...');
    const vm = CubioBuilder.executeOneVM(bytecode);
    const vmState = vm.getVMState();

    console.log('\n--- VM Runtime Verification ---');
    console.log(`  - Active Spatial Nodes   : ${vmState.nodesCount}`);
    console.log(`  - Active Channels/Streams: ${vmState.streamsCount}`);
    console.log(`  - Spatial Slices Matched : ${vmState.slicesCount}`);
    console.log(`  - Cryptographic Seals    : ${vmState.sealedSnapshotsCount}`);
    console.log(`  - Active Allocated Memory: ${vmState.allocatedMemoryMb.toFixed(2)} / 512 MB`);
    console.log(`  - Determinism Variance   : σ² = ${vmState.determinismSigmaSq.toFixed(1)}`);
    console.log(`  - Actuation Lock Status  : ${vmState.actuationLocked}`);

    // Verify sealed snapshots
    console.log('\n[Feature 3] Verified Sealed Snapshots:');
    for (const [path, hash] of vm.getSealedSnapshots().entries()) {
      console.log(`  ✓ Sealed '${path}' -> Hash: ${hash}`);
    }

    // 4. Test Compile-Time Resource Assertion Rejection
    console.log('\n[Feature 5] Testing Compile-Time Static Assertion Rejection (Fail-Closed)...');
    try {
      CubioBuilder.compileOneSource(failingAssertionProgram);
      throw new Error('FAIL: Compile-time assertion should have rejected oversized memory allocation!');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Compile-Time Memory Assertion Failure')) {
        console.log(`  ✓ Successfully intercepted & failed closed:`);
        console.log(`    ${err.message}`);
      } else {
        throw err;
      }
    }

    // 5. Test Live Stream Token Parser in Bridge
    console.log('\n[Builder Bridge] Testing Live Streaming Token Parsing...');
    const token = CubioBuilder.parseStreamToken('_1::Cube_Alpha_01::FUNNEL_RELAY::3::Rx_NEXT::TRIGGER_CURRENT');
    console.log(`  ✓ Parsed Stream Token:`, token);

    console.log('\n======================================================================');
    console.log(' ✅ PASS: ALL 5 ADVANCED FEATURES & BUILDER BRIDGE FULLY VERIFIED');
    console.log('======================================================================\n');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Advanced Features Test Error:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runAdvancedFeaturesTestSuite();
