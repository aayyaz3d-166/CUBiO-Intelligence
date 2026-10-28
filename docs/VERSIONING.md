# ONE LANGUAGE — VERSIONING SPECIFICATION v0.1
**Specification Lock:** Phase 1  
**Authority:** Language Architect & Systems Engineer

---

## 1. Versioning Hierarchy

ONE LANGUAGE tracks four distinct architectural versions:

```text
┌─────────────────────────────────────────────────────────┐
│  ONE LANGUAGE SPECIFICATION (Language Specification v0.1) │
├─────────────────────────────────────────────────────────┤
│  ONE COMPILER               (one-compiler v1.0.0)       │
├─────────────────────────────────────────────────────────┤
│  CUBIO VIRTUAL MACHINE      (cubio-vm v1.0.0)           │
├─────────────────────────────────────────────────────────┤
│  BYTECODE FORMAT            (cubio-ast-bin v1.0)        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Versioning Matrix (Phase 1 Baseline)

| Component | Current Version | Target v0.2 Milestone | Stability Tier |
| :--- | :---: | :---: | :--- |
| **Language Specification** | `0.1.0` | `0.2.0` | Active Specification Lock |
| **Compiler Toolchain** | `1.0.0` | `1.1.0` | Stable (Phase 1 Certified) |
| **Virtual Machine** | `1.0.0` | `1.1.0` | Stable (Phase 1 Certified) |
| **Bytecode Format** | `1.0.0` | `1.1.0` | Magic `0x3690B4E0` |
| **Canonical Address369** | `1.0.0` | `1.0.0` | Permanent (369 Slots) |

---

## 3. Compatibility Invariants

1. **Forward Compatibility:** Future v0.x compilers must successfully compile all valid v0.1 programs.
2. **Bytecode Compatibility:** Changes to binary header structures require incrementing the format version (`0x00_01_00_00`).
