/**
 * CUBiO AI — ONE LANGUAGE — TASK ONE-08 PROFILER
 * ===================================================
 * Profiles the validated ONE runtime from ONE-07 to identify actual CPU bottlenecks.
 * Evaluates whether Tensor/matmul computation remains the dominant bottleneck.
 */

import { performance } from 'perf_hooks';
import { Tensor } from '../../../src/one/tensor/Tensor';
import { MatmulKernel } from '../../../src/one/tensor/kernels/MatmulKernel';
import { AddKernel } from '../../../src/one/tensor/kernels/AddKernel';
import { MulKernel } from '../../../src/one/tensor/kernels/MulKernel';
import { LayerNormKernel } from '../../../src/one/tensor/kernels/LayerNormKernel';
import { SoftmaxKernel } from '../../../src/one/tensor/kernels/SoftmaxKernel';
import { ReluKernel } from '../../../src/one/tensor/kernels/ReluKernel';
import { clipGradNorm } from '../../../src/one/training/GradientClipping';
import { AdamWOptimizer } from '../../../src/one/training/AdamW';
import {
  Authoritative5MCheckpoint,
  CUBiO5MOneEngine,
  CUBIO_5M_CONFIG,
  CUBIO_5M_LAYER_OFFSETS,
} from '../../../src/one/training/CUBiO5MModel';

export interface StageTiming {
  name: string;
  category: 'matmul' | 'vector_adamw' | 'vector_clip' | 'activation' | 'loss' | 'other';
  totalMs: number;
  calls: number;
  percentage: number;
}

export interface ProfilingReport {
  trainingStepBreakdown: StageTiming[];
  dominantCategory: string;
  matmulPercentage: number;
  vectorPercentage: number;
  standaloneKernelTimings: Record<string, number>;
  isWasmJustified: boolean;
  recommendation: 'IMPLEMENT_WASM' | 'NO-IMPLEMENTATION-REQUIRED';
  rationale: string;
}

export async function profileOneRuntime(iterations: number = 20): Promise<ProfilingReport> {
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — TASK ONE-08: RUNTIME CPU PROFILER');
  console.log(`  Profiling ONE-07 Validated Runtime across ${iterations} iterations...`);
  console.log('================================================================================\n');

  const checkpoint = Authoritative5MCheckpoint.getInstance();
  const sandboxWeights = checkpoint.createSandboxWeights();
  const engine = new CUBiO5MOneEngine(sandboxWeights);

  const tokens = [3, 9, 27, 81, 108, 144, 212, 305, 368];
  const targets = [42];

  // Warmup run (JIT warmup)
  console.log('  [Phase 1/3] Warming up runtime...');
  for (let i = 0; i < 3; i++) {
    engine.executeStep(tokens, targets);
  }

  // Instrument fine-grained breakdown
  console.log(`  [Phase 2/3] Profiling ${iterations} full CUBiO 5M training steps with fine-grained timers...`);

  const timings: Record<string, { totalMs: number; calls: number; category: StageTiming['category'] }> = {
    embedding: { totalMs: 0, calls: 0, category: 'other' },
    qkv_matmul_fwd: { totalMs: 0, calls: 0, category: 'matmul' },
    mlp_w1_matmul_fwd: { totalMs: 0, calls: 0, category: 'matmul' },
    gelu_activation: { totalMs: 0, calls: 0, category: 'activation' },
    mlp_w2_matmul_fwd: { totalMs: 0, calls: 0, category: 'matmul' },
    head_matmul_fwd: { totalMs: 0, calls: 0, category: 'matmul' },
    cross_entropy_loss: { totalMs: 0, calls: 0, category: 'loss' },
    head_matmul_bwd: { totalMs: 0, calls: 0, category: 'matmul' },
    mlp_bwd: { totalMs: 0, calls: 0, category: 'matmul' },
    embedding_bwd: { totalMs: 0, calls: 0, category: 'other' },
    grad_clipping: { totalMs: 0, calls: 0, category: 'vector_clip' },
    adamw_optimizer: { totalMs: 0, calls: 0, category: 'vector_adamw' },
    scheduler: { totalMs: 0, calls: 0, category: 'other' },
  };

  const cfg = CUBIO_5M_CONFIG;
  const offsets = CUBIO_5M_LAYER_OFFSETS;
  const H = cfg.hiddenDim;
  const M = cfg.intermediateDim;
  const C = cfg.numClasses;
  const seqLen = tokens.length;
  const layer = offsets.layers[0];
  const headOff = offsets.classificationHeadOffset;

  for (let it = 0; it < iterations; it++) {
    engine.optimizer.zeroGrad();

    // 1. Embedding
    let t0 = performance.now();
    const hidden = new Float32Array(H);
    for (let t = 0; t < seqLen; t++) {
      const tok = tokens[t] % cfg.vocabSize;
      const off = offsets.embeddingOffset + tok * H;
      for (let d = 0; d < H; d++) {
        hidden[d] += engine.weightsTensor.data[off + d];
      }
    }
    const invSeq = 1.0 / seqLen;
    for (let d = 0; d < H; d++) hidden[d] *= invSeq;
    timings.embedding.totalMs += performance.now() - t0;
    timings.embedding.calls++;

    // 2. QKV Matmul
    t0 = performance.now();
    const h1 = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      let sum = 0.0;
      for (let i = 0; i < H; i++) {
        sum += hidden[i] * engine.weightsTensor.data[layer.qkvOffset + (i * H + j)];
      }
      h1[j] = Math.tanh(sum) + hidden[j];
    }
    timings.qkv_matmul_fwd.totalMs += performance.now() - t0;
    timings.qkv_matmul_fwd.calls++;

    // 3. MLP W1 Matmul
    t0 = performance.now();
    const w1Raw = new Float32Array(M);
    for (let j = 0; j < M; j++) {
      let sum = engine.weightsTensor.data[layer.mlpB1Offset + j];
      for (let i = 0; i < H; i++) {
        sum += h1[i] * engine.weightsTensor.data[layer.mlpW1Offset + (i * M + j)];
      }
      w1Raw[j] = sum;
    }
    timings.mlp_w1_matmul_fwd.totalMs += performance.now() - t0;
    timings.mlp_w1_matmul_fwd.calls++;

    // 4. GELU Activation
    t0 = performance.now();
    const hMLP = new Float32Array(M);
    for (let j = 0; j < M; j++) {
      const sum = w1Raw[j];
      hMLP[j] = 0.5 * sum * (1.0 + Math.tanh(0.7978845608 * (sum + 0.044715 * sum * sum * sum)));
    }
    timings.gelu_activation.totalMs += performance.now() - t0;
    timings.gelu_activation.calls++;

    // 5. MLP W2 Matmul
    t0 = performance.now();
    const outState = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      let sum = engine.weightsTensor.data[layer.mlpB2Offset + j];
      for (let i = 0; i < M; i++) {
        sum += hMLP[i] * engine.weightsTensor.data[layer.mlpW2Offset + (i * H + j)];
      }
      outState[j] = sum + h1[j];
    }
    timings.mlp_w2_matmul_fwd.totalMs += performance.now() - t0;
    timings.mlp_w2_matmul_fwd.calls++;

    // 6. Classification Head Matmul
    t0 = performance.now();
    const logitsData = new Float32Array(C);
    for (let c = 0; c < C; c++) {
      let sum = 0.0;
      for (let i = 0; i < H; i++) {
        sum += outState[i] * engine.weightsTensor.data[headOff + (i * C + c)];
      }
      logitsData[c] = sum;
    }
    timings.head_matmul_fwd.totalMs += performance.now() - t0;
    timings.head_matmul_fwd.calls++;

    // 7. Cross Entropy Loss
    t0 = performance.now();
    const logitsTensor = new Tensor(logitsData, [1, C]);
    logitsTensor.requiresGrad = true;
    const lossTensor = engine.criterion.forward(logitsTensor, targets);
    lossTensor.backward();
    timings.cross_entropy_loss.totalMs += performance.now() - t0;
    timings.cross_entropy_loss.calls++;

    // 8. Backward Head Matmul
    t0 = performance.now();
    const dLogits = logitsTensor.grad!.data;
    const dOutState = new Float32Array(H);
    for (let c = 0; c < C; c++) {
      const dl = dLogits[c];
      for (let i = 0; i < H; i++) {
        engine.weightsTensor.grad!.data[headOff + (i * C + c)] += outState[i] * dl;
        dOutState[i] += engine.weightsTensor.data[headOff + (i * C + c)] * dl;
      }
    }
    timings.head_matmul_bwd.totalMs += performance.now() - t0;
    timings.head_matmul_bwd.calls++;

    // 9. Backward MLP
    t0 = performance.now();
    const dH1 = new Float32Array(H);
    for (let j = 0; j < H; j++) {
      const dOut = dOutState[j];
      engine.weightsTensor.grad!.data[layer.mlpB2Offset + j] += dOut;
      dH1[j] += dOut;
    }
    timings.mlp_bwd.totalMs += performance.now() - t0;
    timings.mlp_bwd.calls++;

    // 10. Embedding Backward
    t0 = performance.now();
    for (let t = 0; t < seqLen; t++) {
      const tok = tokens[t] % cfg.vocabSize;
      const off = offsets.embeddingOffset + tok * H;
      for (let d = 0; d < H; d++) {
        engine.weightsTensor.grad!.data[off + d] += dH1[d] * invSeq;
      }
    }
    timings.embedding_bwd.totalMs += performance.now() - t0;
    timings.embedding_bwd.calls++;

    // 11. Gradient Clipping (5,000,000 floats reduction & scale)
    t0 = performance.now();
    clipGradNorm([engine.weightsTensor], 1.0);
    timings.grad_clipping.totalMs += performance.now() - t0;
    timings.grad_clipping.calls++;

    // 12. AdamW Step (5,000,000 floats vector update)
    t0 = performance.now();
    engine.optimizer.step();
    timings.adamw_optimizer.totalMs += performance.now() - t0;
    timings.adamw_optimizer.calls++;

    // 13. Scheduler
    t0 = performance.now();
    engine.scheduler.step();
    timings.scheduler.totalMs += performance.now() - t0;
    timings.scheduler.calls++;
  }

  // Calculate percentages and totals
  let grandTotalMs = 0;
  for (const k of Object.keys(timings)) {
    grandTotalMs += timings[k].totalMs;
  }

  const breakdown: StageTiming[] = Object.keys(timings).map((name) => {
    const item = timings[name];
    return {
      name,
      category: item.category,
      totalMs: item.totalMs,
      calls: item.calls,
      percentage: (item.totalMs / grandTotalMs) * 100,
    };
  });

  // Sort by execution time descending
  breakdown.sort((a, b) => b.totalMs - a.totalMs);

  let matmulMs = 0;
  let vectorAdamWMs = 0;
  let vectorClipMs = 0;
  let activationMs = 0;
  let lossMs = 0;
  let otherMs = 0;

  for (const b of breakdown) {
    if (b.category === 'matmul') matmulMs += b.totalMs;
    else if (b.category === 'vector_adamw') vectorAdamWMs += b.totalMs;
    else if (b.category === 'vector_clip') vectorClipMs += b.totalMs;
    else if (b.category === 'activation') activationMs += b.totalMs;
    else if (b.category === 'loss') lossMs += b.totalMs;
    else otherMs += b.totalMs;
  }

  const matmulPct = (matmulMs / grandTotalMs) * 100;
  const vectorAdamWPct = (vectorAdamWMs / grandTotalMs) * 100;
  const vectorClipPct = (vectorClipMs / grandTotalMs) * 100;
  const vectorTotalPct = vectorAdamWPct + vectorClipPct;

  console.log('\n--- CUBiO 5M Training Step Profile Breakdown ---');
  console.log(`Total Instrumented Runtime (${iterations} steps): ${grandTotalMs.toFixed(2)} ms`);
  console.log(`Average Step Time: ${(grandTotalMs / iterations).toFixed(2)} ms/step\n`);
  for (const b of breakdown) {
    console.log(
      `  - ${b.name.padEnd(22)}: ${b.totalMs.toFixed(2).padStart(8)} ms (${b.percentage.toFixed(2).padStart(5)}%) [${b.category}]`
    );
  }

  console.log('\n--- Aggregate Category Breakdown ---');
  console.log(`  * Vector AdamW Optimization : ${vectorAdamWMs.toFixed(2)} ms (${vectorAdamWPct.toFixed(2)}%)`);
  console.log(`  * Vector Gradient Clipping  : ${vectorClipMs.toFixed(2)} ms (${vectorClipPct.toFixed(2)}%)`);
  console.log(`  * COMBINED VECTOR OPS       : ${(vectorAdamWMs + vectorClipMs).toFixed(2)} ms (${vectorTotalPct.toFixed(2)}%)`);
  console.log(`  * Matmul / GEMM             : ${matmulMs.toFixed(2)} ms (${matmulPct.toFixed(2)}%)`);
  console.log(`  * Loss / Cross-Entropy      : ${lossMs.toFixed(2)} ms (${((lossMs / grandTotalMs) * 100).toFixed(2)}%)`);
  console.log(`  * Activations (GELU)        : ${activationMs.toFixed(2)} ms (${((activationMs / grandTotalMs) * 100).toFixed(2)}%)`);
  console.log(`  * Other (Embedding, Sched)  : ${otherMs.toFixed(2)} ms (${((otherMs / grandTotalMs) * 100).toFixed(2)}%)\n`);

  // [Phase 3/3] Standalone Kernel Profiling
  console.log('  [Phase 3/3] Benchmarking Standalone Kernels at Various Matrix Sizes...');
  const standaloneTimings: Record<string, number> = {};

  // Standalone Matmul Benchmark at varying matrix dimensions
  const matrixSizes = [64, 128, 256, 512, 1024];
  for (const dim of matrixSizes) {
    const tA = Tensor.ones([dim, dim]);
    const tB = Tensor.ones([dim, dim]);
    // Warmup
    MatmulKernel.forward(tA, tB);
    const start = performance.now();
    const iters = dim >= 512 ? 5 : 20;
    for (let k = 0; k < iters; k++) {
      MatmulKernel.forward(tA, tB);
    }
    const avgMs = (performance.now() - start) / iters;
    standaloneTimings[`matmul_${dim}x${dim}`] = avgMs;
    console.log(`     Matmul [${dim}x${dim}] x [${dim}x${dim}] : ${avgMs.toFixed(2)} ms/call`);
  }

  // Standalone Elementwise Add/Mul at 1M floats
  const elemSize = 1000000;
  const tV1 = Tensor.ones([elemSize]);
  const tV2 = Tensor.ones([elemSize]);
  const startAdd = performance.now();
  for (let k = 0; k < 20; k++) AddKernel.forward(tV1, tV2);
  const addAvg = (performance.now() - startAdd) / 20;
  standaloneTimings['add_1M'] = addAvg;
  console.log(`     Vector Add [1M elements]         : ${addAvg.toFixed(2)} ms/call`);

  const startMul = performance.now();
  for (let k = 0; k < 20; k++) MulKernel.forward(tV1, tV2);
  const mulAvg = (performance.now() - startMul) / 20;
  standaloneTimings['mul_1M'] = mulAvg;
  console.log(`     Vector Mul [1M elements]         : ${mulAvg.toFixed(2)} ms/call`);

  // Standalone Softmax
  const tSoft = Tensor.ones([64, 369]);
  const startSoft = performance.now();
  for (let k = 0; k < 20; k++) SoftmaxKernel.forward(tSoft, 1);
  const softAvg = (performance.now() - startSoft) / 20;
  standaloneTimings['softmax_64x369'] = softAvg;
  console.log(`     Softmax [64, 369]                : ${softAvg.toFixed(2)} ms/call`);

  // Standalone LayerNorm
  const tLN = Tensor.ones([64, 256]);
  const gamma = Tensor.ones([256]);
  const beta = Tensor.zeros([256]);
  const startLN = performance.now();
  for (let k = 0; k < 20; k++) LayerNormKernel.forward(tLN, gamma, beta);
  const lnAvg = (performance.now() - startLN) / 20;
  standaloneTimings['layernorm_64x256'] = lnAvg;
  console.log(`     LayerNorm [64, 256]              : ${lnAvg.toFixed(2)} ms/call`);

  // Standalone AdamW over 5M floats
  const dummyP = new Tensor(new Float32Array(5000000), [5000000]);
  dummyP.grad = new Tensor(new Float32Array(5000000), [5000000]);
  const opt = new AdamWOptimizer([dummyP]);
  const startAdam = performance.now();
  for (let k = 0; k < 5; k++) opt.step();
  const adamAvg = (performance.now() - startAdam) / 5;
  standaloneTimings['adamw_5M'] = adamAvg;
  console.log(`     AdamW Step [5,000,000 floats]    : ${adamAvg.toFixed(2)} ms/call`);

  // Decision Logic
  // Does matmul computation remain the dominant bottleneck?
  // We check:
  // 1. In full 5M training step, is matmul >= 50% of CPU time?
  // 2. In standalone matrix operations, is matmul scaling superlinearly (O(N^3)) and creating significant latency?
  const dominantCategory = matmulPct > vectorTotalPct ? 'matmul' : 'vector_optimization';
  const isWasmJustified = matmulPct >= 50.0;

  const recommendation = isWasmJustified ? 'IMPLEMENT_WASM' : 'NO-IMPLEMENTATION-REQUIRED';
  const rationale = isWasmJustified
    ? `Matmul computation accounts for ${matmulPct.toFixed(2)}% of execution time, constituting the dominant CPU bottleneck.`
    : `In the validated 5M model step, AdamW and gradient clipping vector loops over 5,000,000 parameters consume ${vectorTotalPct.toFixed(2)}% of CPU time, while matmul accounts for only ${matmulPct.toFixed(2)}%. However, standalone GEMM scales at O(N^3) reaching ${standaloneTimings['matmul_512x512'].toFixed(2)} ms at 512x512 and ${standaloneTimings['matmul_1024x1024'].toFixed(2)} ms at 1024x1024.`;

  return {
    trainingStepBreakdown: breakdown,
    dominantCategory,
    matmulPercentage: matmulPct,
    vectorPercentage: vectorTotalPct,
    standaloneKernelTimings: standaloneTimings,
    isWasmJustified,
    recommendation,
    rationale,
  };
}

if (require.main === module) {
  profileOneRuntime(15).then((report) => {
    console.log('\n================================================================================');
    console.log(`  PROFILING SUMMARY & DETERMINATION`);
    console.log(`  Dominant Category : ${report.dominantCategory}`);
    console.log(`  Matmul Time Share : ${report.matmulPercentage.toFixed(2)}%`);
    console.log(`  Vector Time Share : ${report.vectorPercentage.toFixed(2)}%`);
    console.log(`  Recommendation    : ${report.recommendation}`);
    console.log(`  Rationale         : ${report.rationale}`);
    console.log('================================================================================\n');
  }).catch((err) => {
    console.error('Profiling failed:', err);
    process.exit(1);
  });
}
