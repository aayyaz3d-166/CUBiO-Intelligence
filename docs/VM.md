# ONE LANGUAGE — SPECIFICATION: UNIFIED VM & RUNTIME
**Document ID:** `ONE-SPEC-015`  
**Version:** `0.1.0-VM`  
**Status:** `LOCKED / IMPLEMENTED (Phase 3)`  
**Authors:** Senior VM Engineer & Compiler Runtime Architect  

---

## 1. Scope & Purpose

The **ONE Language Unified Virtual Machine (UnifiedVM)** is the execution engine for the unified intermediate representation (`UnifiedIRProgram`). It provides a deterministic, secure, stack-and-frame-based execution runtime for all computational programs while maintaining strict boundary separation from and bit-exact compatibility with the declarative spatial engine (`CubiOVirtualMachine`).

---

## 2. VM Architecture

```text
                  UnifiedIRProgram (Instructions 0..N)
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   Index Builder       │
                     │  - Labels (name → PC) │
                     │  - Functions Registry │
                     └───────────┬───────────┘
                                 │
                                 ▼
   ┌───────────────────────────────────────────────────────────┐
   │                       UnifiedVM                           │
   │                                                           │
   │   Program Counter (PC) ──► flat instruction array         │
   │                                                           │
   │   Top-Level Environment:                                  │
   │     • globals: Map<string, VMValue>                       │
   │     • globalRegisters: Map<string, VMValue>               │
   │                                                           │
   │   Call Stack (max depth: 512):                            │
   │     ┌───────────────────────────────────────────────┐     │
   │     │ Frame 0 (top-level invocation)                │     │
   │     ├───────────────────────────────────────────────┤     │
   │     │ Frame 1 (nested function call)                │     │
   │     │   • returnPC                                  │     │
   │     │   • locals: Map<string, VMValue>              │     │
   │     │   • registers: Map<string, VMValue>           │     │
   │     │   • operandStack: VMValue[]                   │     │
   │     │   • returnDestRegister                        │     │
   │     └───────────────────────────────────────────────┘     │
   │                                                           │
   │   Guards & Limits:                                        │
   │     • Max Instructions: 1,000,000 (E5007)                 │
   │     • Max Call Depth:   512 (E5006)                       │
   │     • Zero eval() / Zero Function() / Zero host-escape   │
   └───────────────────────────────────────────────────────────┘
```

---

## 3. Supported Opcodes

| Category | Opcodes | Description |
|---|---|---|
| **Data Movement** | `CONST` | Loads numeric/string/boolean/null scalar, array literal, or object literal |
| | `LOAD` | Loads variable from local activation record or global environment; advances for-in iterators |
| | `STORE` | Stores value into local activation record or global variable |
| | `MOVE` | Copies operand value between registers |
| **Arithmetic** | `ADD` | Numeric addition or string concatenation |
| | `SUB` | Numeric subtraction |
| | `MUL` | Numeric multiplication |
| | `DIV` | Numeric division with E5001 division-by-zero check |
| | `MOD` | Numeric modulo with E5001 modulo-by-zero check |
| **Comparisons** | `CMP` | General comparison with operator metadata (`==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `\|\|`, `!`) |
| | `EQ`, `NE` | Direct equality and inequality comparisons |
| | `LT`, `LTE` | Direct less-than and less-than-or-equal comparisons |
| | `GT`, `GTE` | Direct greater-than and greater-than-or-equal comparisons |
| **Branching** | `JUMP` | Unconditional jump to indexed label target |
| | `JUMP_IF` | Conditional jump evaluating operand truthiness |
| | `JUMP_IF_FALSE` | Jump if condition operand evaluates to false |
| **Subroutines** | `CALL` | Pushes call frame, binds parameters, and jumps to entry PC |
| | `RETURN` | Pops call frame, sets return value in caller destination register, restores PC |
| **I/O & Spatial** | `PRINT` | Formats and appends stringified value to output buffer |
| | `SPATIAL_OP` | Preserved declarative spatial instruction (handled by CubiO VM) |

---

## 4. Runtime Diagnostic Codes (E5000 Series)

| Code | Error Condition | Trigger |
|---|---|---|
| `E5000` | Unspecified VM Fault | Internal interpreter fault |
| `E5001` | Arithmetic Division/Modulo by Zero | `a / 0` or `a % 0` |
| `E5002` | Unknown Opcode or Undefined Label | Corrupt instruction or missing jump target |
| `E5003` | Type Mismatch in Arithmetic Opcode | Non-numeric operand provided to arithmetic op |
| `E5004` | Undefined Variable or Register | Read of uninitialized identifier |
| `E5005` | Undefined Function Target | `CALL` to unregistered symbol |
| `E5006` | Maximum Call Depth Exceeded | Infinite recursion (> 512 frames) |
| `E5007` | Maximum Instruction Count Exceeded | Infinite loop (> 1,000,000 instructions executed) |

---

## 5. Declarative & Sovereign Security

1. **Host Isolation:** No access to Node.js `fs`, `child_process`, `net`, or `process` from user programs.
2. **Zero Eval Guarantee:** Neither `eval()` nor `Function()` exists in the compiler, VM, or runtime pipeline.
3. **Fail-Closed Guarantees:** Any invalid state immediately aborts and returns an error descriptor with the exact offending PC.
