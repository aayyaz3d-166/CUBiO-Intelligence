# ONE LANGUAGE — AUTHORITATIVE KEYWORD INVENTORY
**Specification Lock:** Phase 1 (v0.1)  
**Standard:** Forensic Code Inspection of `src/one/oneLexer.ts` & `src/one/oneParser.ts`

---

## 1. Master Keyword Directory

| Keyword | Category | Lexer Token | Parser Status | Meaning & Semantic Usage |
| :--- | :--- | :--- | :---: | :--- |
| `node` | Declarative | `KEYWORD_NODE` | **IMPLEMENTED** | Declares an in-memory spatial computing node |
| `@Space` | Spatial | `KEYWORD_SPACE` | **IMPLEMENTED** | Defines 3D continuous coordinates $(x, y, z) \in [0, 1]^3$ |
| `@Grid777` | Spatial | `KEYWORD_GRID777` | **IMPLEMENTED** | Maps node to discrete $7\times 7\times 7$ voxel lattice $(i, j, k) \in [0..6]^3$ |
| `@Slice` | Spatial | `KEYWORD_SLICE` | **IMPLEMENTED** | Range query over spatial volume $([x_1..x_2, y_1..y_2, z_1..z_2])$ |
| `@memview` | Memory | `KEYWORD_MEMVIEW` | **IMPLEMENTED** | Maps zero-copy shared memory buffer in MB to a node |
| `stream` | Communication | `KEYWORD_STREAM` | **IMPLEMENTED** | Directional streaming pipe from source to target node |
| `align` | Spatial | `KEYWORD_ALIGN` | **IMPLEMENTED** | Harmonic alignment target coordinate for spatial mesh |
| `checkpoint` | Checkpoint | `KEYWORD_CHECKPOINT` | **IMPLEMENTED** | Named state recovery checkpoint anchor |
| `seal` | Cryptography | `KEYWORD_SEAL` | **IMPLEMENTED** | Generates deterministic FNV-1a / PQC cryptographic snapshot |
| `@seal` | Cryptography | `KEYWORD_SEAL` | **IMPLEMENTED** | Decorator form of cryptographic snapshot directive |
| `funnel` | Communication | `KEYWORD_FUNNEL` | **IMPLEMENTED** | Container block for streaming funnels |
| `channel` | Communication | `KEYWORD_CHANNEL` | **IMPLEMENTED** | Container block for distributed priority channels |
| `@gossip` | Communication | `KEYWORD_GOSSIP` | **IMPLEMENTED** | Declares channel as priority gossip broadcast |
| `rss_max` | Memory | `KEYWORD_RSS_MAX` | **IMPLEMENTED** | Sets global resident set size memory ceiling (MB) |
| `@assert_rss`| Memory | `KEYWORD_ASSERT_RSS` | **IMPLEMENTED** | Compile-time assertion of maximum static memory budget |
| `@actuation_lock`| Security | `KEYWORD_ACTUATION_LOCK` | **IMPLEMENTED** | Toggles fail-closed physical hardware actuation lock |
| `true` | Literal | `KEYWORD_TRUE` | **IMPLEMENTED** | Boolean literal true |
| `false` | Literal | `KEYWORD_FALSE` | **IMPLEMENTED** | Boolean literal false |
| `module` | Modular | `KEYWORD_MODULE` | **SPECIFIED** | Declares a namespace and compilation unit |
| `struct` | Type | `KEYWORD_STRUCT` | **SPECIFIED** | Declares a composite data structure |
| `const` | Declaration | `KEYWORD_CONST` | **SPECIFIED** | Declares an immutable constant value |
| `native` | System | `KEYWORD_NATIVE` | **SPECIFIED** | Marks class or function as bound to native runtime |
| `class` | Object | `KEYWORD_CLASS` | **SPECIFIED** | Declares an object-oriented class structure |
| `constructor`| Object | `KEYWORD_CONSTRUCTOR`| **SPECIFIED** | Class initialization method |
| `method` | Function | `KEYWORD_METHOD` | **SPECIFIED** | Declares a member method within a class |
| `let` | Declaration | `KEYWORD_LET` | **SPECIFIED** | Declares a mutable variable |
| `for` | Control Flow | `KEYWORD_FOR` | **SPECIFIED** | Iterative loop construct |
| `if` | Control Flow | `KEYWORD_IF` | **SPECIFIED** | Conditional execution block |
| `else` | Control Flow | `KEYWORD_ELSE` | **SPECIFIED** | Alternative conditional execution block |
| `private` | Visibility | `KEYWORD_PRIVATE` | **SPECIFIED** | Restricts member visibility to defining class |
| `public` | Visibility | `KEYWORD_PUBLIC` | **SPECIFIED** | Exposes member visibility globally |
| `Cast` | Intrinsics | `KEYWORD_CAST` | **SPECIFIED** | Explicit type conversion operator |
| `Sqrt` | Intrinsics | `KEYWORD_SQRT` | **SPECIFIED** | Mathematical square root intrinsic |
| `Clamp` | Intrinsics | `KEYWORD_CLAMP` | **SPECIFIED** | Value bounding clamp intrinsic |
| `Int` | Type | `TYPE_INT` | **SPECIFIED** | General integer primitive type |
| `Int32` | Type | `TYPE_INT32` | **SPECIFIED** | 32-bit signed integer primitive type |
| `Float32` | Type | `TYPE_FLOAT32` | **SPECIFIED** | 32-bit IEEE 754 floating point primitive type |
| `Bool` | Type | `TYPE_BOOL` | **SPECIFIED** | Boolean primitive type |
| `Void` | Type | `TYPE_VOID` | **SPECIFIED** | Void return type for procedures |

---

## 2. Status Definitions

- **IMPLEMENTED:** Recognized by both `oneLexer.ts` and `oneParser.ts`, represented in the AST, and executed by `CubiOVirtualMachine.ts`.
- **SPECIFIED:** Token recognized by `oneLexer.ts` and used in canonical `.one` programs, with parsing scheduled for subsequent phases.
- **PLANNED:** Reserved for future architectural milestones (e.g. `use`, `remember`, `recall`, `match`).
