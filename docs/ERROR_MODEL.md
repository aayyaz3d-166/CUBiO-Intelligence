# ONE LANGUAGE — ERROR MODEL SPECIFICATION v1.0.1
**Specification Status:** LOCKED / IMPLEMENTED (Tasks 1–27)  
**Authority:** Compiler Runtime Architect, Security Officer & VM Lead

---

## 1. Diagnostic Formatting Standard

All ONE LANGUAGE compiler, linker, VM, and reasoning errors adhere to a structured, human-readable format:

```text
[ERROR_CODE: Category] Description of error at line <L>, column <C> (or PC <offset>):
  <Source Line Snippet>
  ^^^^^

Hint: Actionable remediation suggestion for the developer.
```

In automated tooling, JSON-formatted diagnostics include:
```json
{
  "code": "E8005",
  "category": "SECURITY",
  "message": "Actuation safety violation: physical actuation is locked",
  "line": 42,
  "column": 5,
  "failClosed": true
}
```

---

## 2. Canonical Error Categories & Mappings

The ONE Language runtime and compiler enforce fail-closed termination upon encountering any registered error condition:

```
┌─────────────┬──────────────────────────────────────────────┬───────────────────────────────┐
│ Range       │ Subsystem / Component                        │ Primary Failure Mode          │
├─────────────┼──────────────────────────────────────────────┼───────────────────────────────┤
│ E1001–E1017 │ Lexical, Tokenizer & Grammar Parser          │ Compile-Time Static Rejection │
│ E2001–E2005 │ AST Extraction & Type Checking               │ Compile-Time Static Rejection │
│ E3001–E3006 │ Semantic Analyzer & Scope Resolver           │ Compile-Time Static Rejection │
│ E4001–E4004 │ Module Loader, Dependency Graph & Sandbox    │ Compile-Time / Load-Time      │
│ E5001–E5012 │ Unified Virtual Machine (UnifiedVM) Runtime  │ Runtime Fail-Closed Halt      │
│ E6001–E6004 │ Binary Reasoning Engine & A* Planner         │ Reasoning Engine Rollback     │
│ E7001–E7014 │ Native Runtime, Canonical State & Paging     │ Runtime Hard Panic            │
│ E8001–E8007 │ ONEX Executable Container, Packer & Linker   │ Load-Time Verification Halt   │
└─────────────┴──────────────────────────────────────────────┴───────────────────────────────┘
```

---

## 3. Comprehensive Error Code Catalog

### 3.1 Lexical & Grammar Errors (`E1001`–`E1017`)
- **`E1001`**: Expected variable identifier after declaration keyword (`let`, `const`, `one's`, `one set`, `one in`, `struct`, `enum`).
- **`E1002`**: Const variable must be initialized with an expression / duplicate field declared in struct.
- **`E1003`**: Expected function name identifier after `function`, `fn`, or `one make`.
- **`E1004`**: Expected parameter name in function parameter signature.
- **`E1005`**: Expected iterator variable identifier after `for`.
- **`E1006`**: Expected `in` keyword after iterator variable in `for..in` loop.
- **`E1007`**: Expected module identifier or import/export specifier.
- **`E1008`**: Expected alias identifier after `as` in import/export statement.
- **`E1009`**: Unexpected character encountered in input character stream.
- **`E1010`**: Unterminated string literal encountered before newline or EOF.
- **`E1011`**: Invalid numerical format, malformed float exponent, or unparseable literal.
- **`E1012`**: Unclosed block delimiter (missing matching `}` or `)`).
- **`E1013`**: Expected expression before terminating semicolon.
- **`E1014`**: Unknown `one` command verb encountered in computational parser.
- **`E1015`**: `async` modifier can only precede a function declaration.
- **`E1016`**: `one stop` / `break` keyword can only be used inside an active loop body.
- **`E1017`**: `one dot` is deferred in v1.0.1 pending explicit spatial coordinate point specification.

### 3.2 Parser, AST & Type Errors (`E2001`–`E2005`)
- **`E2001`**: Type mismatch: operand or expression type does not conform to expected signature.
- **`E2002`**: Missing semicolon after expression statement or directive.
- **`E2003`**: Unclosed bracket or delimiter in AST structural node.
- **`E2004`**: Invalid property, extra field, or unknown key in sealed struct constructor literal.
- **`E2005`**: Incompatible return type: function body returns value conflicting with declared return type.

### 3.3 Semantic & Scoping Errors (`E3001`–`E3006`)
- **`E3001`**: Identifier redeclaration: variable name already declared in current lexical scope.
- **`E3002`**: Assignment to constant: cannot mutate an identifier declared with `const`.
- **`E3003`**: Break or continue statement encountered outside of a loop construct.
- **`E3004`**: Return statement encountered outside of a function body.
- **`E3005`**: Use of uninitialized variable before assignment.
- **`E3006`**: `await` expression encountered outside of an `async` function.

### 3.4 Module & Sandbox Errors (`E4001`–`E4004`)
- **`E4001`**: Security sandbox violation: relative path traversal attempt (`../` escaping workspace root).
- **`E4002`**: Target module file not found or unresolved module path.
- **`E4003`**: Exported identifier not found in target module symbol table.
- **`E4004`**: Circular module dependency detected during dependency graph topological sorting.

### 3.5 Unified Virtual Machine Errors (`E5001`–`E5012`)
- **`E5001`**: Division by zero or modulo by zero attempted in VM arithmetic execution.
- **`E5002`**: Unknown opcode or corrupted instruction encountered in bytecode stream.
- **`E5003`**: Stack underflow or operand type error during instruction execution.
- **`E5004`**: Undefined variable, identifier, or register access attempted on VM frame.
- **`E5005`**: Target symbol is undefined or cannot be invoked as a callable function.
- **`E5006`**: Call stack depth limit exceeded (maximum 512 frames allowed).
- **`E5007`**: Maximum instruction quota exceeded (default 1,000,000 instructions ceiling).
- **`E5008`**: Mutation attempted on sealed, immutable struct, enum, or object literal.
- **`E5009`**: Property access on null or undefined reference.
- **`E5010`**: Invalid enum variant or unknown discriminant value.
- **`E5011`**: Unhandled promise rejection in async cooperative task queue.
- **`E5012`**: Standard input or I/O stream exhausted (`EOF` encountered).

### 3.6 Binary Reasoning & Planning Errors (`E6001`–`E6004`)
- **`E6001`**: Reasoning hypothesis budget exceeded (heuristic search space depleted).
- **`E6002`**: Binary reasoning token stream decoding corruption or invalid framing bit tag.
- **`E6003`**: Reasoning goal state unreachable or unsatisfiable under registered invariant rules.
- **`E6004`**: Maximum planning depth ceiling reached (32 exploration cycles).

### 3.7 Native Runtime, Canonical State & Virtual Paging Errors (`E7001`–`E7014`)
- **`E7001`**: Native arithmetic failure (division by zero).
- **`E7002`**: Corrupted native instruction.
- **`E7003`**: Native type mismatch.
- **`E7004`**: Canonical state identifier lookup failure or uninitialized register read.
- **`E7005`**: Native non-callable invocation.
- **`E7006`**: Native call stack overflow (> 512 frames).
- **`E7007`**: Native instruction execution ceiling exceeded.
- **`E7008`**: Array index out of bounds.
- **`E7009`**: Property or field does not exist on target record.
- **`E7010`**: Fail-closed actuation lock violation: hardware actuation rejected.
- **`E7011`**: Memory allocation breached configured RSS Guard ceiling (< 512 MB).
- **`E7012`**: Spatial coordinates exceed discrete 7×7×7 lattice grid bounds $[0..6]$.
- **`E7013`**: Address exceeds canonical Address369 boundary range $[0..368]$.
- **`E7014`**: Security sandbox violation: unauthorized host escape or reflect attempt.

### 3.8 ONEX Container & Actuation Safety Errors (`E8001`–`E8007`)
- **`E8001`**: Invalid ONEX magic bytes: container header does not begin with `0x4F, 0x4E, 0x45, 0x58` (`ONEX`).
- **`E8002`**: Unsupported container schema version (only version `1.0.0` or `1.0.1` recognized).
- **`E8003`**: Header structure corruption, invalid section table count, or offset overflow.
- **`E8004`**: Payload checksum mismatch: computed SHA-256 does not match header integrity digest.
- **`E8005`**: Actuation safety violation: container missing required `ACTUATION_LOCK` flag in header byte 48, or unapproved actuation directive found.
- **`E8006`**: Invalid entrypoint instruction offset: header points outside executable code section.
- **`E8007`**: Container truncation: binary file smaller than declared 64-byte header or section sizes.

---

## 4. Remediation Workflow

When a diagnostic is raised by the compiler or VM:
1. **Static Rejections (`E1000..E4000`):** Modify source code to resolve syntax, type signatures, or circular dependencies. Compilation halts fail-closed before any byte is executed.
2. **Runtime Halts (`E5000`, `E7000`):** Review PC attribution and call stack in the emitted error. Inspect resource constraints (recursion depth, instruction budget) or check whether an immutable struct was modified.
3. **Safety Locks (`E8005`, `E7010`):** Remove physical actuation requests (`actuate()`). Physical actuation is permanently locked (`ACTUATION_LOCK = true`) and cannot be bypassed.
