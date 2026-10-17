/**
 * CUBiO AI — ONE LANGUAGE
 * =========================================================
 * Task 3: WASM SIMD (f32x4) Matmul Benchmark
 *
 * Compares current JS matmul vs WASM SIMD matmul on 256x256x1024 shapes:
 *   1. Forward: C = A x B ([256, 1024] x [1024, 256] -> [256, 256])
 *   2. Backward A^T * B: C = A^T x B ([1024, 256]^T x [1024, 256] = [256, 1024] x [1024, 256] -> [256, 256])
 *   3. Backward A * B^T: C = A x B^T ([256, 1024] x [256, 1024]^T = [256, 1024] x [1024, 256] -> [256, 256])
 */

import { createWasmSimdMatmul } from '../src/one/wasm/WasmSimdMatmul';

function benchmark() {
  console.log('='.repeat(80));
  console.log('TASK 3: WASM SIMD (f32x4) MATMUL VS CURRENT JS MATMUL (256x256x1024)');
  console.log('='.repeat(80));

  const M = 256;
  const K = 1024;
  const N = 256;
  const FLOPs = 2 * M * N * K; // 134,217,728 FLOPs (0.1342 GFLOP)
  const ITERS = 20;

  // Initialize data buffers
  const aData = new Float32Array(M * K);
  const bData = new Float32Array(K * N);
  const bDataT = new Float32Array(N * K); // for A x B^T: B is [N, K]
  const aDataT = new Float32Array(K * M); // for A^T x B: A is [M, K]
  const cDataJS = new Float32Array(M * N);

  // Deterministic seed PRNG
  let seed = 12345;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 4294967296.0 - 0.5) * 0.1;
  }

  for (let i = 0; i < aData.length; i++) aData[i] = rand();
  for (let i = 0; i < bData.length; i++) bData[i] = rand();
  for (let i = 0; i < bDataT.length; i++) bDataT[i] = rand();
  for (let i = 0; i < aDataT.length; i++) aDataT[i] = rand();

  // Create WASM instance (needs enough pages: 1 page = 64KB. Total floats = ~1M = 4MB = 64 pages)
  const wasm = createWasmSimdMatmul(256);
  const wasmMem = new Float32Array(wasm.memory.buffer);

  const ptrA = 0;
  const ptrB = ptrA + M * K * 4;
  const ptrC = ptrB + K * N * 4;

  const results: Array<{
    op: string;
    jsMs: number;
    jsGflops: number;
    wasmMs: number;
    wasmGflops: number;
    speedup: number;
    maxAbsDiff: number;
  }> = [];

  // =========================================================================
  // 1. FORWARD: C = A x B ([256, 1024] x [1024, 256] -> [256, 256])
  // =========================================================================
  console.log('\n[1] Benchmarking Forward Matmul: [256, 1024] x [1024, 256] -> [256, 256]...');
  
  // JS Implementation (Contiguous IKJ)
  function jsForward() {
    cDataJS.fill(0);
    for (let i = 0; i < M; i++) {
      const aOff = i * K;
      const cOff = i * N;
      for (let k = 0; k < K; k++) {
        const aVal = aData[aOff + k];
        const bOff = k * N;
        for (let j = 0; j < N; j++) {
          cDataJS[cOff + j] += aVal * bData[bOff + j];
        }
      }
    }
  }

  // Warmup
  for (let w = 0; w < 3; w++) jsForward();

  const t0_jsFwd = performance.now();
  for (let it = 0; it < ITERS; it++) jsForward();
  const jsFwdMs = (performance.now() - t0_jsFwd) / ITERS;
  const jsFwdGflops = (FLOPs / (jsFwdMs / 1000)) / 1e9;

  // WASM SIMD Forward
  wasmMem.set(aData, ptrA / 4);
  wasmMem.set(bData, ptrB / 4);

  function wasmForward() {
    wasmMem.fill(0, ptrC / 4, ptrC / 4 + M * N);
    wasm.matmulForward(ptrA, ptrB, ptrC, M, K, N);
  }

  // Warmup
  for (let w = 0; w < 3; w++) wasmForward();

  const t0_wasmFwd = performance.now();
  for (let it = 0; it < ITERS; it++) wasmForward();
  const wasmFwdMs = (performance.now() - t0_wasmFwd) / ITERS;
  const wasmFwdGflops = (FLOPs / (wasmFwdMs / 1000)) / 1e9;

  // Numerical parity
  let maxDiffFwd = 0;
  for (let i = 0; i < M * N; i++) {
    const diff = Math.abs(cDataJS[i] - wasmMem[ptrC / 4 + i]);
    if (diff > maxDiffFwd) maxDiffFwd = diff;
  }

  results.push({
    op: 'Forward (A x B)',
    jsMs: jsFwdMs,
    jsGflops: jsFwdGflops,
    wasmMs: wasmFwdMs,
    wasmGflops: wasmFwdGflops,
    speedup: jsFwdMs / wasmFwdMs,
    maxAbsDiff: maxDiffFwd,
  });

  // =========================================================================
  // 2. BACKWARD A^T * B: C = A^T x B ([1024, 256]^T x [1024, 256] -> [256, 256])
  // =========================================================================
  console.log('[2] Benchmarking Backward Matmul (A^T * B): [1024, 256]^T x [1024, 256] -> [256, 256]...');
  // A is [M=1024, K=256] -> A^T is [256, 1024]
  // B is [M=1024, N=256]
  // C is [K=256, N=256]
  const M_atb = 1024, K_atb = 256, N_atb = 256;

  function jsAtB() {
    cDataJS.fill(0);
    for (let m = 0; m < M_atb; m++) {
      const aOff = m * K_atb;
      const bOff = m * N_atb;
      for (let k = 0; k < K_atb; k++) {
        const aVal = aDataT[aOff + k];
        const cOff = k * N_atb;
        for (let j = 0; j < N_atb; j++) {
          cDataJS[cOff + j] += aVal * bData[bOff + j];
        }
      }
    }
  }

  for (let w = 0; w < 3; w++) jsAtB();
  const t0_jsAtb = performance.now();
  for (let it = 0; it < ITERS; it++) jsAtB();
  const jsAtbMs = (performance.now() - t0_jsAtb) / ITERS;
  const jsAtbGflops = (FLOPs / (jsAtbMs / 1000)) / 1e9;

  wasmMem.set(aDataT, ptrA / 4);
  wasmMem.set(bData, ptrB / 4);

  function wasmAtB() {
    wasmMem.fill(0, ptrC / 4, ptrC / 4 + K_atb * N_atb);
    wasm.matmulAtB(ptrA, ptrB, ptrC, M_atb, K_atb, N_atb);
  }

  for (let w = 0; w < 3; w++) wasmAtB();
  const t0_wasmAtb = performance.now();
  for (let it = 0; it < ITERS; it++) wasmAtB();
  const wasmAtbMs = (performance.now() - t0_wasmAtb) / ITERS;
  const wasmAtbGflops = (FLOPs / (wasmAtbMs / 1000)) / 1e9;

  let maxDiffAtb = 0;
  for (let i = 0; i < K_atb * N_atb; i++) {
    const diff = Math.abs(cDataJS[i] - wasmMem[ptrC / 4 + i]);
    if (diff > maxDiffAtb) maxDiffAtb = diff;
  }

  results.push({
    op: 'Backward (A^T * B)',
    jsMs: jsAtbMs,
    jsGflops: jsAtbGflops,
    wasmMs: wasmAtbMs,
    wasmGflops: wasmAtbGflops,
    speedup: jsAtbMs / wasmAtbMs,
    maxAbsDiff: maxDiffAtb,
  });

  // =========================================================================
  // 3. BACKWARD A * B^T: C = A x B^T ([256, 1024] x [256, 1024]^T -> [256, 256])
  // =========================================================================
  console.log('[3] Benchmarking Backward Matmul (A * B^T): [256, 1024] x [256, 1024]^T -> [256, 256]...');
  const M_abt = 256, K_abt = 1024, N_abt = 256;

  function jsAbT() {
    cDataJS.fill(0);
    for (let i = 0; i < M_abt; i++) {
      const aOff = i * K_abt;
      const cOff = i * N_abt;
      for (let j = 0; j < N_abt; j++) {
        let sum = 0.0;
        const bOff = j * K_abt;
        for (let k = 0; k < K_abt; k++) {
          sum += aData[aOff + k] * bDataT[bOff + k];
        }
        cDataJS[cOff + j] = sum;
      }
    }
  }

  for (let w = 0; w < 3; w++) jsAbT();
  const t0_jsAbt = performance.now();
  for (let it = 0; it < ITERS; it++) jsAbT();
  const jsAbtMs = (performance.now() - t0_jsAbt) / ITERS;
  const jsAbtGflops = (FLOPs / (jsAbtMs / 1000)) / 1e9;

  wasmMem.set(aData, ptrA / 4);
  wasmMem.set(bDataT, ptrB / 4);

  function wasmAbT() {
    wasmMem.fill(0, ptrC / 4, ptrC / 4 + M_abt * N_abt);
    wasm.matmulAbT(ptrA, ptrB, ptrC, M_abt, K_abt, N_abt);
  }

  for (let w = 0; w < 3; w++) wasmAbT();
  const t0_wasmAbt = performance.now();
  for (let it = 0; it < ITERS; it++) wasmAbT();
  const wasmAbtMs = (performance.now() - t0_wasmAbt) / ITERS;
  const wasmAbtGflops = (FLOPs / (wasmAbtMs / 1000)) / 1e9;

  let maxDiffAbt = 0;
  for (let i = 0; i < M_abt * N_abt; i++) {
    const diff = Math.abs(cDataJS[i] - wasmMem[ptrC / 4 + i]);
    if (diff > maxDiffAbt) maxDiffAbt = diff;
  }

  results.push({
    op: 'Backward (A * B^T)',
    jsMs: jsAbtMs,
    jsGflops: jsAbtGflops,
    wasmMs: wasmAbtMs,
    wasmGflops: wasmAbtGflops,
    speedup: jsAbtMs / wasmAbtMs,
    maxAbsDiff: maxDiffAbt,
  });

  // =========================================================================
  // PRESENT MEASURED RESULTS TABLE
  // =========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('MEASURED RESULTS: WASM SIMD (f32x4) VS CURRENT JS MATMUL');
  console.log('Shapes: 256x256x1024 (134,217,728 FLOPs per matmul)');
  console.log('='.repeat(80));
  console.table(
    results.map(r => ({
      'Operation': r.op,
      'JS (ms)': r.jsMs.toFixed(2) + ' ms',
      'JS (GFLOP/s)': r.jsGflops.toFixed(2),
      'WASM SIMD (ms)': r.wasmMs.toFixed(2) + ' ms',
      'WASM SIMD (GFLOP/s)': r.wasmGflops.toFixed(2),
      'Speedup': r.speedup.toFixed(2) + 'x',
      'Max Parity Diff': r.maxAbsDiff.toExponential(4),
    }))
  );
  console.log('='.repeat(80));
}

benchmark();
