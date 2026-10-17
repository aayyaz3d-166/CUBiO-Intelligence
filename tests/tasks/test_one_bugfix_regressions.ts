/**
 * CUBiO AI — ONE LANGUAGE FORENSIC BUG-FIX REGRESSION TEST SUITE
 * ==============================================================
 * Tests fixes for confirmed defects BUG-ONE-01 through BUG-ONE-06.
 */

import { UnifiedIRProgram } from '../../src/one/ir/UnifiedIR';
import { JITCompiler } from '../../src/one/jit/JITCompiler';
import { Tensor } from '../../src/one/tensor/Tensor';
import { AddKernel } from '../../src/one/tensor/kernels/AddKernel';
import { MulKernel } from '../../src/one/tensor/kernels/MulKernel';
import { TensorMemoryArena } from '../../src/one/tensor/TensorArena';
import {
  computeMicroBatchForwardBackward,
  generateSyntheticBatch
} from '../../src/one/workers/WorkerThreadLogic';
import { GradCheck } from '../../src/one/tensor/GradCheck';
import { clipGradNorm } from '../../src/one/training/GradientClipping';

interface TestResult {
  bugId: string;
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function record(bugId: string, name: string, passed: boolean, detail: string) {
  results.push({ bugId, name, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${bugId}: ${name} — ${detail}`);
}

async function runRegressionSuite() {
  console.log('='.repeat(70));
  console.log('STARTING ONE FORENSIC BUG-FIX REGRESSION VERIFICATION');
  console.log('='.repeat(70));

  // -------------------------------------------------------------
  // REGRESSION 1: BUG-ONE-01 (AddKernel / MulKernel Shape Validation)
  // -------------------------------------------------------------
  try {
    const tA = Tensor.zeros([2, 3]);
    const tB = Tensor.zeros([3, 2]);

    let addCaught = false;
    try {
      AddKernel.forward(tA, tB);
    } catch (err: any) {
      addCaught = true;
    }

    let mulCaught = false;
    try {
      MulKernel.forward(tA, tB);
    } catch (err: any) {
      mulCaught = true;
    }

    const passed = addCaught && mulCaught;
    record(
      'BUG-ONE-01',
      'Exact shape validation on dimension mismatch (size 6 vs size 6)',
      passed,
      `AddKernel threw: ${addCaught}, MulKernel threw: ${mulCaught}`
    );
  } catch (err: any) {
    record('BUG-ONE-01', 'Exact shape validation', false, err.message);
  }

  // -------------------------------------------------------------
  // REGRESSION 2: BUG-ONE-02 (TensorArena free-list aligned buffer sizing)
  // -------------------------------------------------------------
  try {
    const arena = new TensorMemoryArena({
      maxBytes: 32 * 1024 * 1024,
      slabSizeBytes: 1 * 1024 * 1024,
      alignmentElements: 8
    });
    // Allocate tensor of size 5 (aligned to 8)
    const t1 = arena.allocateTensor([5]);
    for (let i = 0; i < 5; i++) t1.data[t1.offset + i] = i + 1;
    arena.free(t1);

    // Now allocate tensor of size 7 (aligned to 8).
    // In buggy version, freeList had buffer of length 5, causing out-of-bounds on elements 5, 6.
    const t2 = arena.allocateTensor([7]);
    for (let i = 0; i < 7; i++) {
      t2.data[t2.offset + i] = (i + 1) * 10;
    }

    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum += t2.data[t2.offset + i];
    }
    const expectedSum = 10 + 20 + 30 + 40 + 50 + 60 + 70;
    const passed = t2.data.length >= 8 && sum === expectedSum;
    record(
      'BUG-ONE-02',
      'TensorArena free-list buffer alignment slice retention',
      passed,
      `Buffer length: ${t2.data.length} (>=8), elements read correctly, sum: ${sum}`
    );
  } catch (err: any) {
    record('BUG-ONE-02', 'TensorArena free-list buffer alignment', false, err.message);
  }

  // -------------------------------------------------------------
  // REGRESSION 3: BUG-ONE-03 (WorkerThreadLogic signed token embedding gradient)
  // -------------------------------------------------------------
  try {
    const P = 369 * 64 + 40;
    const weights = new Float32Array(P).fill(0.01);
    const workerGradients = new Float32Array(P);

    const batch = generateSyntheticBatch(42, 1);
    // Force targets to 5.0 (greater than pred ~ 0.01) -> dLoss_dPred = 2/O * (pred - target) < 0
    // dLoss_dMeanEmb will be negative, tokenGrad will be negative
    batch.targetSpatialState.fill(5.0);

    computeMicroBatchForwardBackward(weights, workerGradients, batch, 0);
    const tokenIdx = (batch.tokens[0] % 369) * 64;
    const tokenGradNeg = workerGradients[tokenIdx];
    const isSignedNeg = tokenGradNeg < 0;

    // Force targets to -5.0 (less than pred ~ 0.01) -> dLoss_dPred > 0
    // dLoss_dMeanEmb will be positive, tokenGrad will be positive
    batch.targetSpatialState.fill(-5.0);
    computeMicroBatchForwardBackward(weights, workerGradients, batch, 0);
    const tokenGradPos = workerGradients[tokenIdx];
    const isSignedPos = tokenGradPos > 0;

    const passed = isSignedNeg && isSignedPos;
    record(
      'BUG-ONE-03',
      'WorkerThreadLogic analytical signed token embedding gradient',
      passed,
      `Negative target gave tokenGrad: ${tokenGradPos.toFixed(6)} (>0), Positive target gave tokenGrad: ${tokenGradNeg.toFixed(6)} (<0)`
    );
  } catch (err: any) {
    record('BUG-ONE-03', 'WorkerThreadLogic signed gradient', false, err.message);
  }

  // -------------------------------------------------------------
  // REGRESSION 4: BUG-ONE-04 (JIT recursive activation frame & slot preservation)
  // -------------------------------------------------------------
  try {
    // Construct IR for recursive factorial:
    // fn fact(n) {
    //   if (n <= 1) return 1;
    //   r1 = n - 1;
    //   r2 = fact(r1);
    //   r3 = n * r2;
    //   return r3;
    // }
    // r_main = fact(5);
    const program: UnifiedIRProgram = {
      version: '1.0.0',
      instructions: [
        // Entry point: jump over function definition to main
        { index: 0, opcode: 'JUMP', sources: [{ kind: 'label', value: 'main_entry' }] },

        // Function fact header:
        {
          index: 1,
          opcode: 'CONST',
          destination: { kind: 'variable', value: 'fact_start' },
          sources: [{ kind: 'constant', value: 'fact_start' }],
          metadata: { isFunctionHeader: true, name: 'fact', paramNames: ['n'], endLabel: 'fact_end' }
        },
        // check n <= 1
        {
          index: 2,
          opcode: 'LTE',
          destination: { kind: 'register', value: 'r_cond' },
          sources: [{ kind: 'variable', value: 'n' }, { kind: 'constant', value: 1 }]
        },
        {
          index: 3,
          opcode: 'JUMP_IF_FALSE',
          sources: [{ kind: 'register', value: 'r_cond' }, { kind: 'label', value: 'recurse' }]
        },
        // base case: return 1
        {
          index: 4,
          opcode: 'RETURN',
          sources: [{ kind: 'constant', value: 1 }]
        },
        // recursive case:
        {
          index: 5,
          opcode: 'CONST',
          destination: { kind: 'variable', value: 'recurse' },
          sources: [{ kind: 'constant', value: 'recurse' }],
          metadata: { isLabel: true }
        },
        // r1 = n - 1
        {
          index: 6,
          opcode: 'SUB',
          destination: { kind: 'register', value: 'r1' },
          sources: [{ kind: 'variable', value: 'n' }, { kind: 'constant', value: 1 }]
        },
        // r2 = fact(r1)
        {
          index: 7,
          opcode: 'CALL',
          destination: { kind: 'register', value: 'r2' },
          sources: [{ kind: 'constant', value: 'fact' }, { kind: 'register', value: 'r1' }]
        },
        // r3 = n * r2 (tests whether caller's 'n' was preserved across fact(r1) call!)
        {
          index: 8,
          opcode: 'MUL',
          destination: { kind: 'register', value: 'r3' },
          sources: [{ kind: 'variable', value: 'n' }, { kind: 'register', value: 'r2' }]
        },
        {
          index: 9,
          opcode: 'RETURN',
          sources: [{ kind: 'register', value: 'r3' }]
        },
        {
          index: 10,
          opcode: 'CONST',
          destination: { kind: 'variable', value: 'fact_end' },
          sources: [{ kind: 'constant', value: 'fact_end' }],
          metadata: { isFunctionEnd: true }
        },

        // Main entry
        {
          index: 11,
          opcode: 'CONST',
          destination: { kind: 'variable', value: 'main_entry' },
          sources: [{ kind: 'constant', value: 'main_entry' }],
          metadata: { isLabel: true }
        },
        {
          index: 12,
          opcode: 'CALL',
          destination: { kind: 'variable', value: 'result' },
          sources: [{ kind: 'constant', value: 'fact' }, { kind: 'constant', value: 5 }]
        }
      ]
    };

    const compiled = JITCompiler.compile(program, { cache: false });
    const execRes = compiled.run();

    const factorial5 = execRes.globals['result'];
    const passed = factorial5 === 120;
    record(
      'BUG-ONE-04',
      'JIT recursive frame slot preservation (fact(5) == 120)',
      passed,
      `Calculated: ${factorial5}, expected: 120`
    );
  } catch (err: any) {
    record('BUG-ONE-04', 'JIT recursive frame slot preservation', false, err.message);
  }

  // -------------------------------------------------------------
  // REGRESSION 5: BUG-ONE-05 (GradCheck non-contiguous / transposed view handling)
  // -------------------------------------------------------------
  try {
    // Create a 2x3 tensor and transpose to 3x2 (non-contiguous view)
    const base = Tensor.fromArray([1.0, 2.0, 3.0, 4.0, 5.0, 6.0], [2, 3]);
    const transposed = base.transpose(0, 1); // shape [3, 2], strides [1, 3] -> non-contiguous!

    // Scalar function: sum of squares: f(X) = sum(X_ij^2)
    // Analytical gradient: d f / d X = 2 * X
    const f = (x: Tensor) => {
      let sum = 0.0;
      for (const val of x.elementIterator()) {
        sum += val * val;
      }
      return sum;
    };

    // Analytical grad: 2 * transposed (shape [3, 2])
    // We create analyticalGrad as a transposed view of (2 * base) so BOTH x and analyticalGrad are non-contiguous!
    const baseGrad = Tensor.fromArray([2.0, 4.0, 6.0, 8.0, 10.0, 12.0], [2, 3]);
    const analyticalGrad = baseGrad.transpose(0, 1); // shape [3, 2], non-contiguous!
    const checkRes = GradCheck.check(f, transposed, analyticalGrad, { eps: 1e-3, rtol: 5e-3, atol: 5e-3 });

    const passed = checkRes.passed && checkRes.maxRelError < 5e-3;
    record(
      'BUG-ONE-05',
      'GradCheck non-contiguous transposed view handling',
      passed,
      `GradCheck passed: ${checkRes.passed}, maxRelError: ${checkRes.maxRelError.toExponential(4)}`
    );
  } catch (err: any) {
    record('BUG-ONE-05', 'GradCheck non-contiguous view', false, err.message);
  }

  // -------------------------------------------------------------
  // REGRESSION 6: BUG-ONE-06 (GradientClipping threshold guard totalNorm > maxNorm)
  // -------------------------------------------------------------
  try {
    // Case A: totalNorm == maxNorm (e.g. 1.0 == 1.0). In buggy code, clipCoef = 1.0 / (1.0 + 1e-6) < 1.0, causing unneeded scaling!
    const paramA = Tensor.zeros([1]);
    paramA.grad = Tensor.fromArray([1.0], [1]); // totalNorm = 1.0

    const normA = clipGradNorm([paramA], 1.0);
    const unclippedGrad = paramA.grad.get(0);
    const notClippedWhenEqual = unclippedGrad === 1.0;

    // Case B: totalNorm > maxNorm (e.g. 2.0 > 1.0). Must clip to ~ 1.0
    const paramB = Tensor.zeros([1]);
    paramB.grad = Tensor.fromArray([2.0], [1]);
    const normB = clipGradNorm([paramB], 1.0);
    const clippedGrad = paramB.grad.get(0);
    const clippedWhenGreater = Math.abs(clippedGrad - 1.0) < 1e-4;

    const passed = notClippedWhenEqual && clippedWhenGreater;
    record(
      'BUG-ONE-06',
      'GradientClipping guard (totalNorm > maxNorm)',
      passed,
      `totalNorm=1.0, maxNorm=1.0 -> grad=${unclippedGrad} (expected 1.0); totalNorm=2.0 -> grad=${clippedGrad.toFixed(6)} (expected ~1.0)`
    );
  } catch (err: any) {
    record('BUG-ONE-06', 'GradientClipping guard', false, err.message);
  }

  console.log('='.repeat(70));
  const allPassed = results.every(r => r.passed);
  console.log(`SUMMARY: ${results.filter(r => r.passed).length}/${results.length} REGRESSIONS PASSED.`);
  console.log(`STATUS: ${allPassed ? 'ALL BUGS FIXED AND VERIFIED' : 'FAILURES DETECTED'}`);
  console.log('='.repeat(70));

  if (!allPassed) {
    process.exit(1);
  }
}

runRegressionSuite().catch(err => {
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});
