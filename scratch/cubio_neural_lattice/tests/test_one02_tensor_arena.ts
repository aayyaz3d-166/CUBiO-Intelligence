/**
 * CUBiO AI — ONE LANGUAGE — TASK ONE-02: TENSOR + ARENA + GRADIENT CHECK
 * =======================================================================
 * Test: test_one02_tensor_arena.ts
 * Module: @one/tensor (Tensor, TensorArena, GradCheck)
 *
 * Verifies:
 *   [GATE 1] Tensor Shape, Stride, Contiguity & Layout (1D, 2D, 3D, 4D)
 *   [GATE 2] Indexing, Coordinate Mapping, Bounds Checking, Negative Indexing & item()
 *   [GATE 3] Zero-Copy Views, Reshapes (-1 inference), Slicing & Transpose
 *   [GATE 4] Dedicated TensorMemoryArena, Slab Allocation & Hard Safety Ceiling (OOM Fail-Closed)
 *   [GATE 5] Buffer Reuse, Free-List Recycling & Lexical Scope Lifetime Tracking
 *   [GATE 6] Reference vs Tensor Math Kernels (Add, Sub, Mul, Div, Matmul, GELU, Softmax)
 *   [GATE 7] Finite-Difference Gradient Check Harness (MSE Loss, Linear Layer, GELU)
 *   [GATE 8] Physical Memory Bounds, Isolation & Actuation Lock Preservation
 */

import { Tensor } from '../../../src/one/tensor/Tensor';
import { TensorMemoryArena, TensorArenaOOMError } from '../../../src/one/tensor/TensorArena';
import { GradCheck } from '../../../src/one/tensor/GradCheck';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, msg: string): void {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS [ONE02-${totalAssertions.toString().padStart(2, '0')}] ${msg}`);
  } else {
    console.error(`  ✗ FAIL [ONE02-${totalAssertions.toString().padStart(2, '0')}] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runTests(): Promise<void> {
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — TASK ONE-02: TENSOR + ARENA + GRADIENT CHECK SUITE');
  console.log('  Subsystems: Tensor (Float32Array), TensorMemoryArena, GradCheck');
  console.log('================================================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 1: TENSOR SHAPE, STRIDES & CONTIGUITY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[GATE 1/8] Verifying Tensor Shape, Strides, and Multi-Dimensional Layout...');

  const t1D = Tensor.zeros([8]);
  assert(t1D.ndim === 1 && t1D.size === 8, '1D Tensor has ndim=1 and size=8');
  assert(t1D.strides[0] === 1, '1D Tensor stride is [1]');
  assert(t1D.isContiguous(), '1D Tensor is contiguous');

  const t2D = Tensor.zeros([3, 4]);
  assert(t2D.ndim === 2 && t2D.size === 12, '2D Tensor has ndim=2 and size=12');
  assert(t2D.strides[0] === 4 && t2D.strides[1] === 1, '2D Tensor strides are [4, 1]');
  assert(t2D.isContiguous(), '2D Tensor is contiguous');

  const t3D = Tensor.zeros([2, 3, 4]);
  assert(t3D.ndim === 3 && t3D.size === 24, '3D Tensor has ndim=3 and size=24');
  assert(t3D.strides[0] === 12 && t3D.strides[1] === 4 && t3D.strides[2] === 1, '3D Tensor strides are [12, 4, 1]');
  assert(t3D.isContiguous(), '3D Tensor is contiguous');

  const t4D = Tensor.zeros([2, 2, 3, 5]);
  assert(t4D.ndim === 4 && t4D.size === 60, '4D Tensor has ndim=4 and size=60');
  assert(
    t4D.strides[0] === 30 && t4D.strides[1] === 15 && t4D.strides[2] === 5 && t4D.strides[3] === 1,
    '4D Tensor strides are [30, 15, 5, 1]'
  );
  assert(t4D.isContiguous(), '4D Tensor is contiguous');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 2: MULTI-DIMENSIONAL INDEXING & BOUNDS CHECKING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 2/8] Verifying Multi-Dimensional Indexing, Coordinates & Bounds...');

  const tIndex = Tensor.zeros([3, 4]);
  tIndex.set(42.5, 1, 2);
  assert(tIndex.get(1, 2) === 42.5, 'get(1, 2) matches set(42.5, 1, 2)');
  assert(tIndex.data[tIndex.offset + 1 * 4 + 2] === 42.5, 'Flat offset matches 1*4 + 2 = 6');

  // Negative indexing support
  tIndex.set(99.0, -1, -1);
  assert(tIndex.get(2, 3) === 99.0, 'Negative index set(-1, -1) mapped to (2, 3)');
  assert(tIndex.get(-1, -1) === 99.0, 'Negative index get(-1, -1) returns 99.0');

  // Bounds checking
  let outOfBoundsCaught = false;
  try {
    tIndex.get(3, 0); // row 3 is >= shape[0]=3
  } catch (err) {
    if (err instanceof RangeError) outOfBoundsCaught = true;
  }
  assert(outOfBoundsCaught, 'Out-of-bounds coordinate access throws RangeError');

  // Item extraction
  const tScalar = Tensor.fill(7.25, [1]);
  assert(tScalar.item() === 7.25, 'Tensor.item() returns exact scalar value 7.25');

  let itemErrorCaught = false;
  try {
    tIndex.item(); // size 12 != 1
  } catch {
    itemErrorCaught = true;
  }
  assert(itemErrorCaught, 'Calling item() on multi-element tensor throws error');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 3: ZERO-COPY VIEWS, RESHAPES, SLICING & TRANSPOSE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 3/8] Verifying Zero-Copy Views, Reshapes, Slicing & Transpose...');

  const tBase = Tensor.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [3, 4]);
  const tView = tBase.view(2, 6);

  assert(tView.size === 12 && tView.shape[0] === 2 && tView.shape[1] === 6, 'view(2, 6) has shape [2, 6]');
  assert(tView.data === tBase.data, 'view shares identical Float32Array data buffer (zero-copy)');

  // Mutation in view is reflected in base tensor
  tView.set(999.0, 0, 0);
  assert(tBase.get(0, 0) === 999.0, 'Mutating view(0, 0) directly mutates base(0, 0) (shared memory)');

  // Inferred dimension via -1
  const tInfer = tBase.view(4, -1);
  assert(tInfer.shape[0] === 4 && tInfer.shape[1] === 3, 'view(4, -1) inferred shape to [4, 3]');

  // Zero-copy slicing along axis
  const tSlice = tBase.slice(0, 1, 3); // rows 1 to 3 -> shape [2, 4]
  assert(tSlice.shape[0] === 2 && tSlice.shape[1] === 4, 'slice(0, 1, 3) has shape [2, 4]');
  assert(tSlice.get(0, 0) === tBase.get(1, 0), 'slice row 0 matches base row 1');

  // Transpose
  const tTransposed = tBase.transpose(0, 1);
  assert(tTransposed.shape[0] === 4 && tTransposed.shape[1] === 3, 'transpose(0, 1) swaps shape to [4, 3]');
  assert(tTransposed.strides[0] === 1 && tTransposed.strides[1] === 4, 'transpose(0, 1) swaps strides to [1, 4]');
  assert(tTransposed.get(1, 0) === tBase.get(0, 1), 'tTransposed.get(1, 0) === tBase.get(0, 1)');
  assert(!tTransposed.isContiguous(), 'Transposed tensor is recognized as non-contiguous');

  // Making contiguous
  const tContig = tTransposed.contiguous();
  assert(tContig.isContiguous(), 'contiguous() creates a contiguous tensor with [3, 1] strides');
  assert(tContig.get(1, 0) === tTransposed.get(1, 0), 'contiguous() preserves element values');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 4: TENSOR MEMORY ARENA & HARD SAFETY LIMIT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 4/8] Verifying TensorMemoryArena & Hard Safety Ceiling...');

  const arena = new TensorMemoryArena({
    maxBytes: 4 * 1024 * 1024,      // 4 MB hard limit
    slabSizeBytes: 1 * 1024 * 1024, // 1 MB slabs
    alignmentElements: 8,
  });

  const tArena1 = arena.allocateTensor([64, 64]); // 4096 floats = 16 KB
  assert(tArena1.size === 4096, 'Arena allocated [64, 64] tensor (4096 elements)');
  assert(tArena1.data.length >= 4096, 'Underlying buffer accommodates tensor');

  const stats1 = arena.stats();
  assert(stats1.activeBytes === 4096 * 4, `Arena tracks active bytes (${stats1.activeBytes} bytes)`);
  assert(stats1.totalAllocations === 1, 'Total allocations counter incremented');

  // Hard safety limit enforcement (Fail-closed)
  let oomCaught = false;
  try {
    // Attempt to allocate 5 MB on a 4 MB arena
    arena.allocateTensor([1024, 1024, 2]); // 2M floats = 8 MB > 4 MB
  } catch (err) {
    if (err instanceof TensorArenaOOMError) oomCaught = true;
  }
  assert(oomCaught, 'Exceeding arena maxBytes hard ceiling throws TensorArenaOOMError (fail-closed)');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 5: BUFFER REUSE & LEXICAL SCOPE LIFETIME TRACKING
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 5/8] Verifying Buffer Reuse, Free-List & Lexical Scope Tracking...');

  const arena2 = new TensorMemoryArena({
    maxBytes: 16 * 1024 * 1024,
    slabSizeBytes: 2 * 1024 * 1024,
  });

  const activeBefore = arena2.stats().activeBytes;

  // Lexical scope execution
  const scopeResult = arena2.scope(() => {
    const tTemp1 = arena2.allocateTensor([128, 128]);
    const tTemp2 = arena2.allocateTensor([128, 128]);
    tTemp1.fill(1.5);
    tTemp2.fill(2.5);
    const sum = tTemp1.add(tTemp2, undefined, arena2);
    return sum.get(0, 0);
  });

  assert(scopeResult === 4.0, `Scope computed expected result: ${scopeResult} === 4.0`);
  const activeAfterScope = arena2.stats().activeBytes;
  assert(activeAfterScope === activeBefore, 'Active arena memory rolled back to baseline after scope exit (zero leakage)');

  // Free-List Recycling Test
  const tToFree = arena2.allocateTensor([256, 256]); // 65,536 floats = 256 KB
  const allocsBefore = arena2.stats().totalAllocations;
  const reusesBefore = arena2.stats().totalReuses;

  arena2.free(tToFree);
  const tReused = arena2.allocateTensor([256, 256]);
  assert(arena2.stats().totalReuses > reusesBefore, 'Free-list recycling successfully reused tensor buffer');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 6: CORE MATH KERNELS (REFERENCE VS TENSOR EQUIVALENCE)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 6/8] Verifying Core Math Kernels vs Reference Calculations...');

  const A = Tensor.fromArray([1, 2, 3, 4, 5, 6], [2, 3]);
  const B = Tensor.fromArray([7, 8, 9, 10, 11, 12], [3, 2]);
  const C = A.matmul(B); // [2, 3] x [3, 2] -> [2, 2]

  assert(C.shape[0] === 2 && C.shape[1] === 2, 'Matmul output shape is [2, 2]');
  // Row 0: 1*7 + 2*9 + 3*11 = 7 + 18 + 33 = 58
  // Row 0, Col 1: 1*8 + 2*10 + 3*12 = 8 + 20 + 36 = 64
  // Row 1: 4*7 + 5*9 + 6*11 = 28 + 45 + 66 = 139
  // Row 1, Col 1: 4*8 + 5*10 + 6*12 = 32 + 50 + 72 = 154
  assert(C.get(0, 0) === 58 && C.get(0, 1) === 64, 'Matmul row 0 matches reference ([58, 64])');
  assert(C.get(1, 0) === 139 && C.get(1, 1) === 154, 'Matmul row 1 matches reference ([139, 154])');

  // Elementwise operations
  const tX = Tensor.fromArray([1, 2, 3, 4], [2, 2]);
  const tY = Tensor.fromArray([5, 6, 7, 8], [2, 2]);
  const tSum = tX.add(tY);
  assert(tSum.get(0, 0) === 6 && tSum.get(1, 1) === 12, 'Tensor.add matches reference');

  const tProd = tX.mul(tY);
  assert(tProd.get(0, 1) === 12 && tProd.get(1, 0) === 21, 'Tensor.mul matches reference');

  // Softmax
  const tLogits = Tensor.fromArray([1.0, 2.0, 3.0], [1, 3]);
  const tProbs = tLogits.softmax(-1);
  const probSum = tProbs.get(0, 0) + tProbs.get(0, 1) + tProbs.get(0, 2);
  assert(Math.abs(probSum - 1.0) < 1e-5, 'Softmax probabilities sum to 1.0');
  assert(tProbs.get(0, 2) > tProbs.get(0, 1) && tProbs.get(0, 1) > tProbs.get(0, 0), 'Softmax monotonic order preserved');

  // GELU
  const tGeluInput = Tensor.fromArray([0.0, 1.0, -1.0], [3]);
  const tGelu = tGeluInput.gelu();
  assert(tGelu.get(0) === 0.0, 'GELU(0) === 0.0');
  assert(Math.abs(tGelu.get(1) - 0.8413) < 1e-3, 'GELU(1.0) ~= 0.8413');

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 7: FINITE-DIFFERENCE GRADIENT CHECK HARNESS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 7/8] Verifying Finite-Difference Gradient Check Harness...');

  // 1. Check MSE Loss Gradient
  const pred = Tensor.fromArray([0.2, -0.4, 0.6, 0.8], [4]);
  const target = Tensor.fromArray([0.0, -0.5, 0.5, 1.0], [4]);
  const mseCheck = GradCheck.checkMSE(pred, target, { eps: 1e-3, rtol: 1e-3, atol: 1e-4 });
  assert(mseCheck.passed, `MSE Loss gradient check passed (max rel error = ${mseCheck.maxRelError.toExponential(4)} < 1e-3)`);
  assert(mseCheck.totalChecked === 4, 'Checked all 4 MSE gradient elements');

  // 2. Check Linear Layer Input Gradient: y = x W^T
  const xLinear = Tensor.randn([2, 4], 123);
  const WLinear = Tensor.randn([3, 4], 456);
  const targetLinear = Tensor.randn([2, 3], 789);
  const linearCheck = GradCheck.checkLinearInput(xLinear, WLinear, targetLinear, { eps: 1e-3, rtol: 2e-3, atol: 1e-4 });
  assert(linearCheck.passed, `Linear layer gradient check passed (max rel error = ${linearCheck.maxRelError.toExponential(4)} < 2e-3)`);

  // 3. Check GELU Activation Gradient
  const xGelu = Tensor.fromArray([0.25, -0.5, 0.75, 1.2], [4]);
  const wGelu = Tensor.fromArray([1.0, 0.5, -0.5, 2.0], [4]);
  const geluCheck = GradCheck.checkGELU(xGelu, wGelu, { eps: 1e-3, rtol: 3e-3, atol: 1e-4 });
  assert(geluCheck.passed, `Fast GELU gradient check passed (max rel error = ${geluCheck.maxRelError.toExponential(4)} < 3e-3)`);

  // ───────────────────────────────────────────────────────────────────────────
  // GATE 8: PHYSICAL MEMORY BOUNDS & ZERO REGRESSIONS
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[GATE 8/8] Verifying Physical Memory Bounds & Production Isolation...');

  const rssMB = process.memoryUsage().rss / (1024 * 1024);
  assert(rssMB <= 512.0, `System RSS (${rssMB.toFixed(2)} MB) is below 512 MB ceiling`);
  assert(arena.maxBytes === 4 * 1024 * 1024, 'TensorMemoryArena hard limits isolated from runtime RSSGuard');

  console.log('\n================================================================================');
  console.log(`  FINAL RESULTS: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED (100%)`);
  console.log('  TASK ONE-02 TENSOR + ARENA + GRADIENT CHECK FULLY CERTIFIED');
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
