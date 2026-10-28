# ONE LANGUAGE — UNIFIED INTERMEDIATE REPRESENTATION (IR) SPECIFICATION
**Document Version:** 1.0.0  
**Phase:** Phase 2 Unified Compiler Lock  
**Standard:** Serializable, Typed, Deterministic Intermediate Representation  
**Rule:** `CODE + TESTS + RUNTIME EVIDENCE > DOCUMENTATION > CLAIMS`  

---

## 1. Overview

The **Unified IR** is the canonical intermediate target emitted by the ONE Language Unified Compiler pipeline. It bridges the high-level Unified AST into a linear, typed, and easily inspectable instruction stream.

> [!IMPORTANT]
> The presence of IR instructions does **NOT** imply that the current CubiO Virtual Machine executes general-purpose arithmetic or jumps in Phase 2. VM execution of computational opcodes belongs strictly to **Phase 3 (Runtime / VM)**.

---

## 2. IR Architecture & Data Model

Every IR program consists of:
1. `version`: Semantic IR version (e.g., `0.1.0-IR`).
2. `declarativeMetadata`: Optional spatial metadata (RSS limits, assertion limits, actuation lock).
3. `instructions`: An ordered array of `IRInstruction` records.

### 2.1 Instruction Structure
```typescript
export interface IRInstruction {
  index: number;                           // 0-indexed sequential position
  opcode: IROpcode;                        // Instruction mnemonic
  destination?: IROperand;                 // Target register or variable
  sources: IROperand[];                    // Operand inputs
  metadata?: Record<string, unknown>;      // Diagnostic & debug annotations
}
```

### 2.2 Operands
An operand (`IROperand`) represents values flowing through the pipeline:
* `register`: Virtual register (`r1`, `r2`, `r3`, ...)
* `variable`: Named variable or symbol (`x`, `y`, `result`)
* `constant`: Immediate literal value (`10`, `"hello"`, `true`, `null`)
* `label`: Branch target label (`func_add`, `else_1`, `endif_1`)
* `spatial_payload`: Structured payload for spatial commands (coordinates, memory views, seals)

---

## 3. Opcode Repertoire

| Opcode | Destination | Sources | Description |
| :--- | :--- | :--- | :--- |
| `CONST` | Register / Label | Immediate | Loads constant immediate into virtual register or marks label |
| `LOAD` | Register | Variable / Reg | Loads value of variable or register into destination |
| `STORE` | Variable / Memory | Register | Stores register value into variable or memory binding |
| `MOVE` | Register | Register | Copies value between registers |
| `ADD` | Register | Reg1, Reg2 | Numerical addition / string concatenation |
| `SUB` | Register | Reg1, Reg2 | Numerical subtraction / unary negation |
| `MUL` | Register | Reg1, Reg2 | Numerical multiplication |
| `DIV` | Register | Reg1, Reg2 | Numerical floating-point / integer division |
| `MOD` | Register | Reg1, Reg2 | Modulo remainder |
| `CMP` | Register | Reg1, Reg2 | Comparison or logical test (`==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`) |
| `CALL` | Register | Callee, Args...| Invokes function and stores return value |
| `RETURN` | - | Optional Reg | Exits current function with optional return value |
| `JUMP` | Label | - | Unconditional branch to label |
| `JUMP_IF` | Label | Condition Reg | Conditional branch if condition evaluates to false |
| `PRINT` | - | Register | Emits value to standard output or telemetry log |
| `SPATIAL_OP`| - | SpatialPayload | Encapsulates Declarative Spatial operation (Node, Funnel, Channel, Seal, Slice) |

---

## 4. Inspection Format (`--emit-ir`)

The compiler provides an inspectable disassembly view:
```text
; --- ONE Language Unified IR (Version 0.1.0-IR) ---
; Declarative Limits: RSS=512MB, AssertRSS=256MB, ActuationLock=true

000 CONST      r1, 10
001 STORE      x, r1
002 CONST      r2, 20
003 STORE      y, r2
004 LOAD       r3, x
005 LOAD       r4, y
006 ADD        r5, r3, r4
007 STORE      z, r5
008 LOAD       r6, z
009 PRINT      r6
```

---

## 5. Declarative Spatial IR Representation

Declarative Spatial DSL constructs are represented via `SPATIAL_OP` instructions preserving full metadata:
```text
000 SPATIAL_OP [SpatialNode LatticeCore] ; {"nodeType":"Node"}
001 SPATIAL_OP [SpatialNode SpatialStream] ; {"nodeType":"Funnel"}
002 SPATIAL_OP [SpatialNode GossipRelay] ; {"nodeType":"Channel"}
003 SPATIAL_OP [SpatialNode Data] ; {"nodeType":"Seal"}
004 SPATIAL_OP [SpatialNode Data] ; {"nodeType":"Slice"}
```
This guarantees that spatial invariants (Address369, 7x7x7 quantization, fail-closed locks) remain completely unperturbed.
