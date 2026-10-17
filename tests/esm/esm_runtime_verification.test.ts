/**
 * ONE Language — Native ESM Runtime Verification Suite
 * Module: Tensor.backward() and UnifiedVM.execute() ESM Compatibility
 * Path: tests/esm/esm_runtime_verification.test.ts
 */

import { Tensor } from '../../src/one/tensor/Tensor';
import { AutogradOps } from '../../src/one/tensor/autograd/AutogradOps';
import { AutogradTape } from '../../src/one/tensor/autograd/AutogradTape';
import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import { UnifiedVM } from '../../src/one/vm/UnifiedVM';
import { SpatialBridge } from '../../src/one/spatial/SpatialBridge';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runESMRuntimeTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE LANGUAGE — NATIVE ESM RUNTIME VERIFICATION SUITE');
  console.log('='.repeat(80));

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Tensor.backward() under native ESM
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Verifying Tensor.backward() under native ESM...');

  assert(AutogradTape.isRecording() === true, 'AutogradTape must have recording active');

  const a = new Tensor(new Float32Array([1, 2, 3, 4]), [2, 2]);
  a.requiresGrad = true;

  const b = new Tensor(new Float32Array([2, 0, 0, 2]), [2, 2]);
  b.requiresGrad = true;

  const c = AutogradOps.matmul(a, b);
  assert(c.shape[0] === 2 && c.shape[1] === 2, 'Matmul output shape must be [2, 2]');
  assert(c.data[0] === 2 && c.data[1] === 4 && c.data[2] === 6 && c.data[3] === 8, 'Forward matmul data match');

  const rootGrad = new Tensor(new Float32Array([1, 1, 1, 1]), [2, 2]);
  c.backward(rootGrad);

  assert(a.grad !== null, 'a.grad must be populated after backward()');
  assert(b.grad !== null, 'b.grad must be populated after backward()');

  const aGradExpected = [2, 2, 2, 2];
  const bGradExpected = [4, 4, 6, 6];

  for (let i = 0; i < 4; i++) {
    assert(Math.abs(a.grad!.data[i] - aGradExpected[i]) < 1e-5, `a.grad[${i}] must equal ${aGradExpected[i]}`);
    assert(Math.abs(b.grad!.data[i] - bGradExpected[i]) < 1e-5, `b.grad[${i}] must equal ${bGradExpected[i]}`);
  }
  console.log('  ✓ Tensor.backward() backward adjoint propagation verified bit-exact.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Tensor Convenience Operator Methods & Scalar Reduction
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Verifying Tensor convenience operators and scalar backward()...');

  const x = new Tensor(new Float32Array([1, 2, 3, 4]), [2, 2]);
  x.requiresGrad = true;

  const two = new Tensor(new Float32Array([2, 2, 2, 2]), [2, 2]);
  const y = new Tensor(new Float32Array([10, 20, 30, 40]), [2, 2]);
  y.requiresGrad = true;

  const x2 = x.mul(two);
  const h = x2.add(y);
  const loss = h.sum();

  assert(Math.abs(loss.data[0] - 120.0) < 1e-5, 'Loss value must equal 120');

  loss.backward();

  assert(x.grad !== null && y.grad !== null, 'Gradients must be computed');
  for (let i = 0; i < 4; i++) {
    assert(Math.abs(x.grad!.data[i] - 2.0) < 1e-5, `x.grad[${i}] must equal 2.0`);
    assert(Math.abs(y.grad!.data[i] - 1.0) < 1e-5, `y.grad[${i}] must equal 1.0`);
  }
  console.log('  ✓ Convenience operator graph (mul -> add -> sum) backward verified bit-exact.');

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: UnifiedVM.execute() with SpatialBridge & Builtins
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Verifying UnifiedVM.execute() under native ESM...');

  const compiler = new UnifiedCompiler();

  const scriptArithmetic = `
    let valA = 10;
    let valB = 32;
    let sumVal = valA + valB;
    print sumVal;
  `;
  const compArith = compiler.compile(scriptArithmetic);
  assert(compArith.success && compArith.ir !== undefined, 'Arithmetic script must compile');

  const vmArith = new UnifiedVM();
  const resArith = vmArith.execute(compArith.ir!);
  assert(resArith.success, 'Arithmetic script must execute cleanly');
  assert(resArith.output[0] === '42', 'Arithmetic script output must be 42');
  console.log('  ✓ UnifiedVM core arithmetic & print execution verified.');

  const bridge = new SpatialBridge({ actuationLock: false });
  const scriptSpatial = `
    spatial.set(3, 3, 3, 369);
    let readBack = spatial.get(3, 3, 3);
    print readBack;
  `;
  const compSpatial = compiler.compile(scriptSpatial);
  assert(compSpatial.success && compSpatial.ir !== undefined, 'Spatial script must compile');

  const vmSpatial = new UnifiedVM();
  const resSpatial = vmSpatial.execute(compSpatial.ir!, { spatialBridge: bridge });
  assert(resSpatial.success, 'Spatial script must execute cleanly');
  assert(resSpatial.output[0] === '369', 'Spatial script output must be 369');
  console.log('  ✓ UnifiedVM spatial bridge integration verified.');

  console.log('\n' + '='.repeat(80));
  console.log('  ALL NATIVE ESM RUNTIME SUITES PASSED (100%)');
  console.log('='.repeat(80));
}

// Auto-execute if invoked as entrypoint
runESMRuntimeTests();
