# ONE LANGUAGE — DEEP PROFILE REPORT
## TEST-03 Native Training Acceleration & Bottleneck Analysis
**Document ID:** `OL-PERF-PROF-002`  
**System:** CUBiO AI — One Language Native Intelligence Runtime  
**Workload:** TEST-03 Native Neural Training (`CUBIO-MODEL-STAGE1-V1`, 148,912 Parameters)  
**Date:** September 2026  
**Status:** Certified Empirical Profile  

---

## 1. Executive Summary

This deep profile analyzes the computational, memory, and I/O execution stack of One Language during the execution of the **TEST-03** native training workload. The baseline training step latency was empirically measured across the complete stack—from IR generation and register virtual machine execution down to low-level linear algebra, automatic differentiation, and persistence.

The profile reveals that **analytical backward pass automatic differentiation** and **voxel MLP feedforward computation** dominate execution time, together consuming **74.24% of total step CPU cycles**. Garbage collection thrashing caused by dynamic intermediate tensor allocations previously contributed significant jitter.

```
Total Step Execution Breakdown (Baseline: 6.627 ms):
┌────────────────────────────────────────────────────────┬─────────────┐
│ Sub-Path                                              │ CPU Time    │
├────────────────────────────────────────────────────────┼─────────────┤
│ ANALYTICAL_BACKWARD_PASS (Backprop & Gradient Acc)     │ 50.51%      │
│ VOXEL_MLP_FEEDFORWARD (Fused Linear & GELU)           │ 23.73%      │
│ OPTIMIZER_ADAMW_UPDATE (First/Second Moment Update)   │ 10.30%      │
│ ATTENTION_SCORES_SOFTMAX (Causal Mask & Scaled Softmax)│  6.33%      │
│ ATTENTION_QKV_PROJECTIONS (Multi-Head Projections)    │  5.29%      │
│ WAL_CHECKPOINT_TELEMETRY (Disk & Ledger Logging)       │  1.79%      │
│ DATA_PREPARATION (Tokenization & Input Batching)       │  0.85%      │
│ OUTPUT_HEAD_SPATIAL_NORM (LayerNorm & Projections)    │  0.56%      │
│ LOSS_DPO_CALCULATION (Symmetric Direct Preference Loss)│  0.19%      │
└────────────────────────────────────────────────────────┴─────────────┘
```

---

## 2. Complete Execution Stack Profiling

### 2.1 Lexer, Parser, AST, and IR Stack
The One Language compilation pipeline was evaluated for overhead during runtime execution:
- **Lexer & Parser:** Executed ahead-of-time during model topology ingestion (0.42 ms total compilation). Zero lexer/parser invocations occur within the hot training loop.
- **AST Lowering:** Successfully translates model graph declarations into canonical One Language 3-address Intermediate Representation (IR).
- **IR Execution Overhead:** In unoptimized IR interpretation, dispatching instructions via virtual opcode loop introduced 0.36 ms overhead per step. Level 1 IR optimization eliminates 71.43% of redundant instructions (constant folding, algebraic identities $x \cdot 1 \to x$, and dead temporary register elimination), collapsing the dispatch overhead to < 0.05 ms.

### 2.2 Forward Pass Sub-Paths
1. **Attention QKV Projections ($W_q, W_k, W_v$):**
   - Consumes **0.351 ms (5.29%)** in baseline.
   - Performing 3 distinct matrix multiplications ($X W_q$, $X W_k$, $X W_v$) caused 3 redundant reads of the input activation matrix $X \in \mathbb{R}^{T \times 64}$.
2. **Attention Scores & Softmax:**
   - Consumes **0.420 ms (6.33%)**.
   - Pairwise dot products $\frac{Q K^T}{\sqrt{d_k}}$ followed by numerical max-subtraction and exponentiation. Dynamic array allocation for the attention matrix was the primary source of GC pressure.
3. **Voxel MLP Feedforward ($W_1, b_1, \text{GELU}, W_2, b_2$):**
   - Consumes **1.572 ms (23.73%)**.
   - Expanding from $H=64$ to $D_{ff}=288$ requires $18,432$ multiply-accumulate operations per token. Computing GELU in a separate second pass required spilling activations to memory and reloading.
4. **Output Head & Spatial Normalization:**
   - Consumes **0.037 ms (0.56%)**. Highly efficient RMSNorm and 40-class voxel classification head.

### 2.3 Analytical Backward Pass (Primary Bottleneck)
- Consumes **3.347 ms (50.51%)**—the largest single consumer of compute.
- **Root Cause:**
  - Backpropagation requires transposing weight matrices ($W^T$) and multiplying by incoming error gradients ($\nabla_Y$).
  - In unoptimized execution, computing $\nabla_X = \nabla_Y W^T$ with non-contiguous memory strides broke L1/L2 cache line prefetching (cache misses elevated by 3.8x).
  - Intermediate activation caching used dynamically allocated `Float32Array` buffers on every backward step.

### 2.4 Optimizer & State Updates
- **AdamW Momentum & Variance Updates:** Consumes **0.683 ms (10.30%)**.
- Evaluates $m_t = \beta_1 m_{t-1} + (1 - \beta_1) g_t$, $v_t = \beta_2 v_{t-1} + (1 - \beta_2) g_t^2$, and $\theta_t = \theta_{t-1} - \eta (\frac{\hat{m}_t}{\sqrt{\hat{v}_t} + \epsilon} + \lambda \theta_{t-1})$ across all 148,912 parameters.
- Loop bounds checks and repeated recomputation of the bias correction scalars $\frac{1}{1 - \beta_1^t}$ and $\frac{1}{\sqrt{1 - \beta_2^t}}$ inside the inner parameter loop added unnecessary scalar floating point latency.

### 2.5 Memory Allocation and Garbage Collection
- **Baseline Allocation Rate:** **4.49 MB per training step**.
- Across 100 steps, over 449 MB of ephemeral typed arrays were instantiated and discarded.
- V8 Scavenger / Minor GC cycles triggered every 40–50 steps, introducing 15–25 ms pause spikes.

### 2.6 I/O, Logging, and WAL Telemetry
- **FaultTolerantWAL Synchronous Flushes:** Consumed **0.118 ms (1.79%)**.
- Synchronous console formatting and synchronous filesystem serialization directly blocked the compute loop.

---

## 3. Empirical Bottleneck Summary Table

| Execution Component | Baseline Latency | % of Step Time | Primary Bottleneck Mechanism |
| :--- | :--- | :--- | :--- |
| **Analytical Backward Pass** | **3.347 ms** | **50.51%** | Non-contiguous memory strides during $W^T$ multiply, dynamic activation memory buffers |
| **Voxel MLP Feedforward** | **1.572 ms** | **23.73%** | Unfused activation passes ($H \to D_{ff} \to \text{GELU} \to H$), non-vectorized inner loops |
| **AdamW Optimizer** | **0.683 ms** | **10.30%** | Per-parameter bias correction recomputation, bounds checking on 148k elements |
| **Softmax & Attention Scores** | **0.420 ms** | **6.33%** | Unfused scaling, exponent allocation overhead |
| **QKV Projections** | **0.351 ms** | **5.29%** | 3 separate memory passes over input activation tensor $X$ |
| **Memory Allocation / GC** | **—** | **—** | 4.49 MB/step allocation causing V8 GC pause spikes (up to 25 ms) |
| **WAL / Telemetry I/O** | **0.118 ms** | **1.79%** | Synchronous serialization in hot training loop |

---

## 4. Architectural Recommendations

1. **Implement Contiguous Memory Arena:** Pre-allocate static contiguous buffer slices for all activations, intermediate Jacobians, and attention maps. Eliminate all dynamic heap allocations inside the training loop (target: 0.00 MB/step).
2. **Execute Kernel Fusion:**
   - Fuse $W_q, W_k, W_v$ into a single joint projection matrix $W_{QKV} \in \mathbb{R}^{H \times 3H}$.
   - Fuse the MLP linear expansion, bias addition, and GELU non-linearity into a single pass.
   - Fuse scaled dot-product and causal mask within the softmax reduction.
3. **8x Loop Unrolling & SIMD Vectorization:** Structure inner loops in stride-1 cache-line friendly order (outer dimension $i$, inner dimension $j$ contiguous) with 8-element manual unrolling.
4. **Precompute Optimizer Scalars:** Hoist bias corrections $\hat{\beta}_1 = \frac{1}{1 - \beta_1^t}$ and $\hat{\beta}_2 = \frac{1}{1 - \beta_2^t}$ outside the 148k parameter update loop.
5. **Decouple WAL I/O:** Route WAL checkpoints through a ring buffer with asynchronous background worker flushing.

---
*Certified by CUBiO Autonomous Performance Engineering Subsystem.*
