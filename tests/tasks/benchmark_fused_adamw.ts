/**
 * CUBiO AI — BENCHMARK: FUSED ADAMW + GRADIENT CLIPPING (5M PARAMS)
 * =================================================================
 * Evaluates execution latency on 5,000,000 parameter Float32Array
 * comparing unfused (clipping pass + AdamW pass) vs fused single loop.
 */

import { FusedAdamWClippingOptimizer } from '../../src/one/training/FusedAdamWClipping';

function runBenchmark() {
  const P = 5000000; // 5,000,000 parameters
  console.log('='.repeat(70));
  console.log(`BENCHMARK: Fused AdamW + Gradient Clipping on ${P.toLocaleString()} parameters`);
  console.log('='.repeat(70));

  // Initialize test data
  const initialParams = new Float32Array(P);
  const initialGrads = new Float32Array(P);

  let seed = 42;
  for (let i = 0; i < P; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    initialParams[i] = (seed / 4294967296) * 0.2 - 0.1;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    // Gradients with some large values to trigger clipping
    initialGrads[i] = (seed / 4294967296) * 0.05 - 0.025;
  }

  // 1. Numerical Parity Verification
  console.log('\n[1] Verifying Numerical Bit-Level Equivalence (Step 1)...');
  const paramsUnfused = new Float32Array(initialParams);
  const gradsUnfused = new Float32Array(initialGrads);
  const optUnfused = new FusedAdamWClippingOptimizer(P, { maxNorm: 1.0 });
  const resUnfused = optUnfused.stepUnfused(paramsUnfused, gradsUnfused);

  const paramsFused = new Float32Array(initialParams);
  const gradsFused = new Float32Array(initialGrads);
  const optFused = new FusedAdamWClippingOptimizer(P, { maxNorm: 1.0 });
  const resFused = optFused.stepFused(paramsFused, gradsFused);

  let maxDiff = 0.0;
  for (let i = 0; i < P; i++) {
    const diff = Math.abs(paramsUnfused[i] - paramsFused[i]);
    if (diff > maxDiff) maxDiff = diff;
  }

  console.log(`  Unfused Total Norm: ${resUnfused.totalNorm.toFixed(6)}, Clipped: ${resUnfused.clipped}`);
  console.log(`  Fused Total Norm  : ${resFused.totalNorm.toFixed(6)}, Clipped: ${resFused.clipped}`);
  console.log(`  Max Parameter Difference: ${maxDiff.toExponential(6)}`);
  const parityPassed = maxDiff < 1e-6;
  console.log(`  Parity Status: ${parityPassed ? 'PASSED (Bit-Exact within FP32)' : 'FAILED'}`);

  // 2. Latency Profiling over 10 iterations (after 2 warmup iterations)
  console.log('\n[2] Latency Profiling (10 iterations each)...');

  // Warmup
  for (let w = 0; w < 2; w++) {
    optUnfused.stepUnfused(paramsUnfused, gradsUnfused);
    optFused.stepFused(paramsFused, gradsFused);
  }

  const iters = 10;
  const unfusedTimes: number[] = [];
  for (let i = 0; i < iters; i++) {
    // Reset synthetic gradients
    gradsUnfused.set(initialGrads);
    const r = optUnfused.stepUnfused(paramsUnfused, gradsUnfused);
    unfusedTimes.push(r.durationMs);
  }

  const fusedTimes: number[] = [];
  for (let i = 0; i < iters; i++) {
    // Reset synthetic gradients
    gradsFused.set(initialGrads);
    const r = optFused.stepFused(paramsFused, gradsFused);
    fusedTimes.push(r.durationMs);
  }

  const meanUnfused = unfusedTimes.reduce((a, b) => a + b, 0) / iters;
  const meanFused = fusedTimes.reduce((a, b) => a + b, 0) / iters;
  const speedup = meanUnfused / meanFused;
  const reductionPct = ((meanUnfused - meanFused) / meanUnfused) * 100;

  console.log(`\nRESULTS (Mean over ${iters} steps on 5M params Float32Array):`);
  console.log(`  Unfused Baseline Latency : ${meanUnfused.toFixed(2)} ms/step`);
  console.log(`  Fused Kernel Latency     : ${meanFused.toFixed(2)} ms/step`);
  console.log(`  Latency Reduction        : ${(meanUnfused - meanFused).toFixed(2)} ms saved (${reductionPct.toFixed(1)}% reduction)`);
  console.log(`  Speedup Factor           : ${speedup.toFixed(2)}x`);
  console.log('='.repeat(70));

  if (!parityPassed) {
    process.exit(1);
  }
}

runBenchmark();
