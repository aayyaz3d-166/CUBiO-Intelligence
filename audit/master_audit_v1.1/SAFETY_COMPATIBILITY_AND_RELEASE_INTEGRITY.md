# ONE Intelligence — Safety, Compatibility & Release Integrity Audit

> **Document:** `SAFETY_COMPATIBILITY_AND_RELEASE_INTEGRITY.md`  
> **Mode:** Strict READ-ONLY Forensic Safety & Release Audit  
> **Scope:** `F:\ONE language` & `F:\one-binary-reasoning`  
> **Timestamp:** 2026-10-28T12:45:00+05:00  

---

## 1. Permanent Safety Invariants & Diagnostic Enforcement

The audit verified all safety controls against live test execution and source definitions:

### 1.1 ACTUATION_LOCK & Error E8005
- **Definition:** The static property `is_actuation_blocked: true` is hardcoded across `SovereignWebGateway.ts`, `UnifiedVM.ts`, `AgiOneCoreOrchestrator.ts`, and `ExtremeMemoryVMAdapter.ts`.
- **Enforcement Mechanism:**
  1. Compile-Time: The compiler rejects actuation AST nodes fail-closed.
  2. Container-Packing: Byte 48 of the 64-byte ONEX header requires the `ACTUATION_LOCK` flag (`0x01`). Omitting this flag triggers `ExecutableValidator` panic.
  3. Runtime: Attempting physical actuation throws `OneVMError` with code `E8005: Actuation safety violation: physical actuation is locked`.
- **Test Evidence:** `tests/safety/task20_address369_guards_actuation_safety.test.ts` asserts `E8005` rejection under negative test vectors (100% pass).

### 1.2 Input Exhaustion Error E5012
- **Prior Report Correction:** Phase 0B mistakenly labeled `E5012` as an actuation lockout error.
- **Verified Source Reality:** `E5012` is defined in `UnifiedVM.ts#L840` as:
  `[E5012] Input stream exhausted: no mock inputs or input handler available`.
- **Enforcement Mechanism:** When the standard input stream reaches EOF or when mock queues are depleted, the VM halts fail-closed instead of fabricating empty strings or looping infinitely.
- **Test Evidence:** `tests/v101/v101_command_syntax.test.ts` (Suite 4) validates that reading from an empty input stream throws `E5012`.

### 1.3 Address369 Canonical Spatial Boundary Partition
- **Symbolic Partition `[0..25]`:** 26 registers (`A` through `Z`). Verified bounded in `src/one/address369_canonical.ts` and `src/shared/address369.ts`.
- **Spatial Grid Partition `[26..368]`:** 343 cells in a $7 \times 7 \times 7$ lattice.
  $$\text{Address} = 26 + x + 7y + 49z \quad (x, y, z \in [0..6])$$
  Center voxel $(3, 3, 3)$ strictly corresponds to Address **197** (display index #198).
- **Reserved Partition `[369..511]`:** 143 reserved registers. Direct access attempts are intercepted fail-closed with `E8005` or `E2004`.
- **Out-of-Bounds `> 511`:** Fatal compilation rejection.

### 1.4 Runtime Resource Ceilings
- **Physical RSS Memory Ceiling:** Clamped at **512 MB**. Evaluated during high-volume array allocation tests; `ExtremeMemoryVMAdapter` provides 64 KB demand paging to prevent memory overflow.
- **Call Stack Recursion Ceiling:** Set to **500 frames**. Frame 501 triggers `E5006: Call stack depth limit exceeded`.
- **Instruction Budget Quota:** Default **100,000 instructions**. Infinite loops are intercepted cleanly with `E5004`/`E5007: Instruction quota exceeded`.
- **Reasoning Step Ceilings:** Clamped to **32 planning depth cycles** in `ReasoningEngine.ts`.

---

## 2. Backward Compatibility & Syntax Preservation

- **v1.0.0 $\to$ v1.0.1 Compatibility:**
  1. All valid v1.0.0 programs using C-style syntax (`let`, `const`, `fn`, `function`, `print`, `if/else`, `while`, `return`) compile and execute identically under v1.0.1.
  2. New v1.0.1 minimal command syntax (`one set`, `one make`, `one up/down`, `one in/out`, `one way/done/stop`) lowers directly into existing canonical AST and IR nodes.
  3. `.ox` containers compiled with v1.0.0 unpack and execute seamlessly on the v1.0.1 `UnifiedVM`.

---

## 3. Release Artifact Integrity & SHA-256 Audit

All release candidate files in [`dist/v1.0.1-rc/`](file:///F:/ONE%20language/dist/v1.0.1-rc) were computed and verified bit-for-bit:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FROZEN RELEASE CANDIDATE (v1.0.1-rc) HASHES                     │
├──────────────────────────┬───────────┬───────────────────────────────────┬─────────────┤
│ Artifact Path            │ Size      │ Computed Cryptographic SHA-256    │ Audit Match │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ dist/v1.0.1-rc/one.exe   │ 102059520B│ 479186CA87F55781825DF05F5603AC3747│ 100% Exact  │
│                          │(97.33 MB) │ ADA4C2E9AA78DE9E3CD233A993020E    │ Match       │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ dist/v1.0.1-rc/          │ 2047908 B │ 33C8F6C59FD04ACAFC514D0D7BE4CC80ED│ 100% Exact  │
│ one-language-1.0.1.vsix  │ (1.95 MB) │ 397352348A7425FAFA349AC00C5B0D    │ Match       │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ dist/v1.0.1-rc/          │ 1996348 B │ 925FB6CF562378AFB824FE6709740018C5│ 100% Exact  │
│ one-language-1.0.1-src.zip (1.90 MB) │ 54238B069E5BEB5144260851846ED5    │ Match       │
└──────────────────────────┴───────────┴───────────────────────────────────┴─────────────┘
```

#### Historical v1.0.0 Release Baseline Preserved:
- `dist/one-language-1.0.0-src.zip`: `45A564AF28D6C4ED8BF7D2317349EE390DF6BB5EA0979A0066BB0DC51044FE49` (Preserved intact).
- Baseline Git Tag: `v1.0.0` $\to$ Commit `2cf25533c5165964f4757cf1f660c991d3e628ed` (Immutable).
