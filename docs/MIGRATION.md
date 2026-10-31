# ONE LANGUAGE — MIGRATION, COMPATIBILITY & ROLLBACK GUIDE
**Specification Status:** LOCKED / VERIFIED (Task 27)  
**Target Release:** v1.0.1 (from v1.0.0)  
**Authority:** Architecture Review Board & Release Management

---

## 1. Release Evolution & Overview

This document provides migration guidance, compatibility policies, and emergency rollback procedures for updating from ONE Language v1.0.0 to v1.0.1.

| Release | Release Scope & Primary Milestones | Status |
| :--- | :--- | :--- |
| **v1.0.0** | Initial sovereign language release. Core lexer, AST parser, UnifiedVM, standalone `one.exe` packaging, initial VS Code extension, basic Address369 bounds. | **FROZEN / BASELINE** |
| **v1.0.1** | Five-tier architecture orchestration, Time-travel state manager (WAL), ExtremeMemory 64 KB demand paging, verified Binary Reasoning Bridge integration, comprehensive command syntax (`one set`, `one make`, `one up/down`). | **RELEASE CANDIDATE (Frozen in `dist/v1.0.1-rc/`)** |

---

## 2. New Language Features in v1.0.1

ONE Language v1.0.1 introduces ergonomic verb constructs designed for high-clarity declarative and computational authoring:

### 2.1 Grammar & Syntax Additions

| Syntax Construct | Semantics | v1.0.0 Equivalent |
| :--- | :--- | :--- |
| **`one's <id> = <expr>;`** | Declares and binds an immutable variable | `const <id> = <expr>;` |
| **`one set <id> = <expr>;`** | Updates the value of an existing mutable variable | `<id> = <expr>;` |
| **`one up <id>;`** | Increments a numeric variable by 1 | `<id> = <id> + 1;` |
| **`one down <id>;`** | Decrements a numeric variable by 1 | `<id> = <id> - 1;` |
| **`one in <id>;`** | Reads the next token from the standard input stream | Built-in stream read |
| **`one out <expr>;`** | Emits an expression string to standard output | `print(<expr>);` |
| **`one make <fn>(...) { ... }`** | Declares a named subroutine | `function <fn>(...) { ... }` |
| **`one way { ... }`** | Scoped procedural execution block | Scoped block `{ ... }` |
| **`one done;`** | Explicit block / pipeline delimiter | Block closing |
| **`one stop;`** | Exits the innermost loop immediately | `break;` |

### 2.2 Example v1.0.1 Program
```one
one make calculateTrajectory(initialVelocity: number, steps: number): number {
  let altitude = 0;
  for i in [1, 2, 3, 4, 5] {
    one set altitude = altitude + initialVelocity;
    one up initialVelocity;
  }
  return altitude;
}

let result = calculateTrajectory(10, 5);
one out "Final Altitude: " + string(result);
```

---

## 3. Backward Compatibility & Invariants

ONE Language v1.0.1 maintains **100% backward compatibility** with programs written for v1.0.0:

1. **Syntax Retention:** All existing v1.0.0 syntax (functions, structs, loops, let/const, modules) compiles without deprecation or semantic shift.
2. **ONEX Container Compatibility:** The `.ox` container format preserves the 64-byte binary header. Container files compiled with v1.0.0 tools unpack and execute cleanly on the v1.0.1 UnifiedVM.
3. **Fail-Closed Safety Invariants:**
   - Physical actuation remains permanently locked (`ACTUATION_LOCK: true`, `isActuationBlocked: true`).
   - Access to reserved Address369 registers `[369..511]` is strictly rejected (`E8005` / `E2004`).
   - Memory RSS ceiling remains bounded at 512 MB.

---

## 4. Known Limitations & Phase 2 Deferred Items

The following architectural items are explicitly documented as current limitations and scheduled for future phases:

1. **Post-Quantum Cryptography Implementation:**
   - *Current State:* Cryptographic state seals and OMail messages use SHA3-512 and SHA-256 HMAC Merkle roots.
   - *Phase 2 Plan:* Transition to NIST FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA) post-quantum lattice algorithms.
2. **WASM SIMD Acceleration:**
   - *Current State:* 64-byte aligned SIMD memory access is emulated via Node.js typed array arenas.
   - *Phase 2 Plan:* Implement direct WebAssembly LLVM backend with native 128/256-bit SIMD intrinsics.
3. **Repository Workspace Structure:**
   - *Current State:* `F:\ONE language` and `F:\one-binary-reasoning` operate as companion repositories with continuous CI substrate parity verification.
   - *Phase 2 Plan:* Merge into an npm monorepo workspace after external downstream consumers have adopted versioned packages.

---

## 5. Rollback Procedures

If an unexpected regression or deployment incompatibility occurs during v1.0.1 rollout, follow these certified rollback steps:

### 5.1 In-Process WAL & State Rollback
To revert in-memory VM state to a prior verified checkpoint:
```typescript
import { TimeTravelStateManager } from './src/one/data/TimeTravelStateManager';

// Revert to known snapshot hash or ID
const restored = timeTravelManager.rollbackTo(targetSnapshotId);
console.log(`State restored. Sequence: ${restored.walSequenceNumber}`);
```

### 5.2 Restoring Baseline Release Binaries
If a newly built binary diverges, restore the frozen baseline release artifacts:
```powershell
# Restore v1.0.0 standalone executable
Copy-Item "dist/v1.0.0-archive/one.exe" "dist/one.exe" -Force

# Or restore verified v1.0.1 Release Candidate binary
Copy-Item "dist/v1.0.1-rc/one.exe" "dist/one.exe" -Force
```

### 5.3 Git Working Directory Reset
```powershell
# Verify branch status
git status

# Discard uncommitted working directory changes
git restore .

# Revert to clean v1.0.0 release tag
git checkout v1.0.0
```
