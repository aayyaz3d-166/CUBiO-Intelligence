# CUBiO / AGI ONE — Gate CNL-P26.3 Test Report
**Protocol ID:** `CUBIO-P26.3-SPATIAL-QUANTUM-MAPPER-001`  
**Execution Spec:** Gate CNL-P26.3 v1.0  
**Test Suite File:** `f:\ONE language\src\core\test_spatial_quantum_mapper.ts`  
**Status:** 25/25 TESTS PASSED (100.0%)  
**Execution Time:** 4.20 ms mean per full 343-cell lattice update  
**Date:** 2026-09-08  

---

## 1. Test Execution Summary

```text
================================================================================
CUBiO / AGI ONE -- GATE CNL-P26.3 DETERMINISTIC TEST SUITE
Target: 25 Mandated Test Scenarios (Section 24)
================================================================================
  ✓ PASS [TEST-01] 343-Cell Count Exactness: Lattice initialized with exactly 343 cells (7x7x7)
  ✓ PASS [TEST-02] Canonical Cell IDs Monotonicity: cell_id runs 0..342 strictly sequentially without gaps
  ✓ PASS [TEST-03] Canonical Coordinate Mapping: cellId = i * 49 + j * 7 + k holds strictly for all cells with i,j,k in [0..6]
  ✓ PASS [TEST-04] Canonical Address369 Mapping (26..368): address369 is strictly [26..368] and display_index is [1..343]
  ✓ PASS [TEST-05] Duplicate-Cell Rejection: Caught expected LatticeValidationError
  ✓ PASS [TEST-06] Missing-Cell Rejection: Caught expected LatticeValidationError
  ✓ PASS [TEST-07] Deterministic Seed Reproducibility: Same seed yields bit-identical vectors; different seeds diverge
  ✓ PASS [TEST-08] State-Vector Dimensionality Invariant: Enforces requested dimensions (12, 343) and rejects negative dimensions
  ✓ PASS [TEST-09] Probability Normalization (Softmax Sum ~ 1.0): Sum of probabilities = 1.00000000, delta = 0
  ✓ PASS [TEST-10] Probability Bounds Invariant [0.0, 1.0]: Every normalized probability is finite and within [0.0, 1.0]
  ✓ PASS [TEST-11] Canonical Phase Domain [-π, π): All wrapped angles strictly reside within half-open interval [-π, π)
  ✓ PASS [TEST-12] Resonance Invariant Bounds [0.0, 1.0]: Computed intent resonance strictly normalized between 0.0 and 1.0
  ✓ PASS [TEST-13] NaN Value Rejection (Fail Closed): Caught expected NumericalInstabilityError
  ✓ PASS [TEST-14] Infinity Value Rejection (Fail Closed): Caught expected NumericalInstabilityError
  ✓ PASS [TEST-15] Empty Vector Rejection: Caught expected StateDimensionError
  ✓ PASS [TEST-16] Deterministic Replay Parity (REPRODUCIBLE_CANONICAL_REPLAY): Snapshots bit-identical across runs. Hash: acb732fc3ead3d23...
  ✓ PASS [TEST-17] Canonical Hash Stability: SHA-256 hash invariant over identical input ordering: acb732fc3ead3d23...
  ✓ PASS [TEST-18] Hash Mutation Detection: Single cell resonance delta strictly causes canonical hash to change
  ✓ PASS [TEST-19] Snapshot Deep Immutability: Snapshot and lattice matrix are deeply frozen via Object.freeze
  ✓ PASS [TEST-20] Physical Hardware Independence: Reported simulation_status = COMPUTED, evidence_class = SIMULATED, physical_signal = UNAVAILABLE
  ✓ PASS [TEST-21] Zero Math.random() Usage (Mulberry32 PRNG): Pure PRNG generation produces bit-identical sequences for identical seeds
  ✓ PASS [TEST-22] Zero Network Dependency Audit: Module executes with zero socket, HTTP, or network dependency
  ✓ PASS [TEST-23] Zero Browser / DOM / WebGL Dependency Audit: Module executes in sovereign headless environment with zero DOM / WebGL
  ✓ PASS [TEST-24] 7x7x7 Coordinate Completeness: All 343 coordinate combinations (0..6)^3 are uniquely present in the matrix
  ✓ PASS [TEST-25] Performance Baseline (<20ms / update): Mean full 343-cell lattice update latency: 4.200 ms (target < 20ms)
================================================================================
TOTAL P26.3 TESTS: 25/25 PASSED (100.0%)
================================================================================
```

---

## 2. Test Suite Matrix

| ID | Test Name | Focus Area | Result |
|---|---|---|:---:|
| **TEST-01** | 343-Cell Count Exactness | Verify exact $7\times 7\times 7 = 343$ array allocation | **PASS** |
| **TEST-02** | Canonical Cell IDs Monotonicity | Verify cellId $0..342$ monotonic without gaps | **PASS** |
| **TEST-03** | Canonical Coordinate Mapping | Verify $\text{cellId} = i \cdot 49 + j \cdot 7 + k$ | **PASS** |
| **TEST-04** | Canonical Address369 Mapping | Verify spatial address $26..368$ and display index $1..343$ | **PASS** |
| **TEST-05** | Duplicate-Cell Rejection | Fail closed on duplicate cell_id injection | **PASS** |
| **TEST-06** | Missing-Cell Rejection | Fail closed on truncated array ($<343$) | **PASS** |
| **TEST-07** | Deterministic Seed Reproducibility | PRNG bit-identical output for same seed | **PASS** |
| **TEST-08** | State-Vector Dimensionality Invariant | Verify dimensions (12, 343) and reject negative | **PASS** |
| **TEST-09** | Probability Normalization | Verify softmax sum $\sum p_i = 1.00000000$ | **PASS** |
| **TEST-10** | Probability Bounds Invariant | Verify $0.0 \le p_i \le 1.0$ for all cells | **PASS** |
| **TEST-11** | Canonical Phase Domain | Verify $[-\pi, \pi)$ half-open interval wrapping | **PASS** |
| **TEST-12** | Resonance Invariant Bounds | Verify $0.0 \le r \le 1.0$ normalized bounds | **PASS** |
| **TEST-13** | NaN Value Rejection | Fail closed on NaN input | **PASS** |
| **TEST-14** | Infinity Value Rejection | Fail closed on $\pm\infty$ input | **PASS** |
| **TEST-15** | Empty Vector Rejection | Fail closed on empty array input | **PASS** |
| **TEST-16** | Deterministic Replay Parity | Full bit-identical snapshot replay verified | **PASS** |
| **TEST-17** | Canonical Hash Stability | SHA-256 invariant on identical inputs | **PASS** |
| **TEST-18** | Hash Mutation Detection | Single cell resonance delta changes canonical hash | **PASS** |
| **TEST-19** | Snapshot Deep Immutability | Deep `Object.freeze` blocks all mutations | **PASS** |
| **TEST-20** | Physical Hardware Independence | `simulation_status=COMPUTED, physical_signal=UNAVAILABLE` | **PASS** |
| **TEST-21** | Zero Math.random() Usage | Deterministic Mulberry32 verified across 1000 trials | **PASS** |
| **TEST-22** | Zero Network Dependency Audit | Headless execution without sockets/HTTP | **PASS** |
| **TEST-23** | Zero Browser Dependency Audit | Headless execution without DOM/WebGL | **PASS** |
| **TEST-24** | 7x7x7 Coordinate Completeness | All 343 tuples $(i,j,k)$ uniquely present | **PASS** |
| **TEST-25** | Performance Baseline | $4.20\text{ ms} < 20\text{ ms}$ full lattice update | **PASS** |
