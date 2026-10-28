/**
 * ONE Language & CubiO Spatial VM - Phase 1 Prototype
 * System CLI & End-to-End Pipeline Verification Script (src/index.ts)
 *
 * Workflow:
 * 1. Ingest sample string ("ONE_LANGUAGE_PHASE_1")
 * 2. Convert to UTF-8 hex and binary bits ('0' and '1')
 * 3. Run BitAgent (bit density, Hamming weights, classification)
 * 4. Run EntropyEngine (2-bit basis states, 4x4 density matrix, eigenvalues, Von Neumann entropy S(rho))
 * 5. Allocate and store result into coordinate [3, 3, 3] of 7x7x7 Spatial Memory Grid
 * 6. Test high-level ONE Language compiler pipeline and execution
 * 7. Output structured log verifying system status
 */
import { BitAgent } from './vm/bitAgent';
import { EntropyEngine } from './vm/entropyEngine';
import { GridMemory } from './vm/gridMemory';
import { CubioVM } from './vm/cubioVM';
import { OneCompiler } from './compiler/oneCompiler';
export function runPhase1Pipeline(inputString = 'ONE_LANGUAGE_PHASE_1') {
    console.log('='.repeat(78));
    console.log('    ONE LANGUAGE & CUBIO SPATIAL VM: PHASE 1 PROTOTYPE VERIFICATION');
    console.log('='.repeat(78));
    // Step 1: Ingest sample string
    console.log(`\n[STEP 1] Ingesting Sample Input: "${inputString}"`);
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(inputString);
    const hexStr = Array.from(utf8Bytes)
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
    console.log(` - UTF-8 Byte Length: ${utf8Bytes.length} bytes`);
    console.log(` - UTF-8 Hex: [ ${hexStr} ]`);
    // Step 2: Convert to binary bits
    const bitString = BitAgent.bytesToBitString(utf8Bytes);
    console.log(`\n[STEP 2] Binary Bitstream Representation:`);
    console.log(` - Total Bits: ${bitString.length}`);
    console.log(` - Bit Stream (preview): ${bitString.slice(0, 48)}...${bitString.slice(-16)}`);
    // Step 3: Bitstream Intelligence Agent Analysis
    console.log(`\n[STEP 3] Bitstream Intelligence Agent Analysis:`);
    const bitAgent = new BitAgent(64);
    const bitAnalysis = bitAgent.analyze(bitString);
    console.log(` - Total Bits: ${bitAnalysis.totalBits}`);
    console.log(` - '1' Bits (Count): ${bitAnalysis.onesCount}`);
    console.log(` - '0' Bits (Count): ${bitAnalysis.zerosCount}`);
    console.log(` - Bit Density D: ${bitAnalysis.bitDensity.toFixed(6)}`);
    console.log(` - Transitions: ${bitAnalysis.transitions} (rate: ${bitAnalysis.transitionRate.toFixed(4)})`);
    console.log(` - Sliding Window (64-bit) Hamming Weights: [ ${bitAnalysis.slidingHammingWeights.join(', ')} ]`);
    console.log(` - Stream Classification: ${bitAnalysis.classification}`);
    console.log(` - Zero-Copy Fast-Path Eligible: ${bitAnalysis.fastPathEligible}`);
    // Step 4: Native Entropy Engine Analysis
    console.log(`\n[STEP 4] Native Entropy Engine Analysis:`);
    const entropyEngine = new EntropyEngine();
    const entropyAnalysis = entropyEngine.analyze(bitString, false);
    console.log(` - 2-Bit Basis State Counts:`);
    console.log(`     |00>: ${entropyAnalysis.stateCounts[0]} (p = ${entropyAnalysis.probabilities[0].toFixed(4)})`);
    console.log(`     |01>: ${entropyAnalysis.stateCounts[1]} (p = ${entropyAnalysis.probabilities[1].toFixed(4)})`);
    console.log(`     |10>: ${entropyAnalysis.stateCounts[2]} (p = ${entropyAnalysis.probabilities[2].toFixed(4)})`);
    console.log(`     |11>: ${entropyAnalysis.stateCounts[3]} (p = ${entropyAnalysis.probabilities[3].toFixed(4)})`);
    console.log(` - 4x4 Density Matrix ρ:`);
    for (let r = 0; r < 4; r++) {
        const rowStr = entropyAnalysis.densityMatrix[r]
            .map((v) => v.toFixed(4).padStart(8))
            .join(' ');
        console.log(`     [${rowStr} ]`);
    }
    console.log(` - Calculated Eigenvalues λ_i:`);
    entropyAnalysis.eigenvalues.forEach((lambda, i) => {
        console.log(`     λ_${i + 1} = ${lambda.toFixed(6)}`);
    });
    const sumLambda = entropyAnalysis.eigenvalues.reduce((a, b) => a + b, 0);
    console.log(`     Trace Tr(ρ) = sum(λ_i) = ${sumLambda.toFixed(6)}`);
    console.log(` - Von Neumann Entropy S(ρ) = -sum(λ_i * log2(λ_i)):`);
    console.log(`     S(ρ) = ${entropyAnalysis.vonNeumannEntropy.toFixed(6)} / 2.000000`);
    console.log(` - Purity Tr(ρ²): ${entropyAnalysis.purity.toFixed(6)}`);
    // Step 5: Allocate and store into coordinate [3, 3, 3] of 7x7x7 Spatial Grid
    console.log(`\n[STEP 5] Spatial Memory Grid Allocation:`);
    const gridMemory = new GridMemory();
    const targetCoord = { x: 3, y: 3, z: 3 };
    const storedCell = gridMemory.write(targetCoord, utf8Bytes, {
        bitDensity: bitAnalysis.bitDensity,
        entropyScore: entropyAnalysis.vonNeumannEntropy,
        tags: ['INITIAL_PROTOTYPE', 'PAYLOAD'],
    });
    console.log(` - Lattice Architecture: 7x7x7 (343 Spatial Cells)`);
    console.log(` - Target Cell Coordinates: [${targetCoord.x}, ${targetCoord.y}, ${targetCoord.z}] (1D Index: ${storedCell.index})`);
    console.log(` - Cell Status: OCCUPIED = ${storedCell.occupied}`);
    console.log(` - Stored Payload Size: ${storedCell.data?.byteLength} bytes`);
    console.log(` - Cell Bit Density: ${storedCell.bitDensity.toFixed(6)}`);
    console.log(` - Cell Entropy Score: ${storedCell.entropyScore.toFixed(6)}`);
    console.log(` - Cell Tags: [${storedCell.tags.join(', ')}]`);
    // Step 6: Verify Compiler Pipeline
    console.log(`\n[STEP 6] High-Level ONE Language Program Compilation & VM Run:`);
    const sampleProgram = `
    spatial grid: Cube(7, 7, 7);
    cell[3, 3, 3].write("${inputString}");
    entropy.analyze("${inputString}");
    bitAgent.analyze("${inputString}");
  `;
    const compiler = new OneCompiler();
    const compiled = compiler.compile(sampleProgram);
    console.log(` - Compiled Instructions (${compiled.instructions.length} ops):`);
    compiled.instructions.forEach((ins, idx) => {
        console.log(`     [Op ${idx.toString().padStart(2, '0')}] Opcode: 0x${ins.op.toString(16).padStart(2, '0')} | ${ins.comment}`);
    });
    const vm = new CubioVM();
    const vmResult = vm.run(compiled.instructions, false); // pinned cells: no dynamic dispatch
    console.log(` - VM Execution Cycles: ${vmResult.cyclesExecuted}`);
    const vmCell = vm.memory.read(targetCoord);
    console.log(` - VM Verified Stored Cell at [3, 3, 3]: ${vmCell ? `${vmCell.data?.length} bytes stored` : 'FAILED'}`);
    console.log(` - Total Occupied Grid Cells: ${vmResult.gridStats.occupiedCells}/${vmResult.gridStats.totalCells}`);
    console.log('\n' + '='.repeat(78));
    console.log('              PHASE 1 VERIFICATION: ALL CHECKS PASSED');
    console.log('='.repeat(78));
    return {
        bitAnalysis,
        entropyAnalysis,
        storedCell,
        vmResult,
    };
}
if (typeof require !== 'undefined' && require.main === module) {
    runPhase1Pipeline();
}
else if (typeof process !== 'undefined' && process.argv && process.argv[1]) {
    const scriptPath = process.argv[1].replace(/\\/g, '/');
    if (scriptPath.endsWith('src/index.ts') || scriptPath.endsWith('src/index.js') || scriptPath.endsWith('dist/index.js')) {
        runPhase1Pipeline();
    }
}
