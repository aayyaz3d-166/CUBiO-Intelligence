# ONE LANGUAGE — FORMAL SEMANTICS SPECIFICATION v0.1
**Specification Lock:** Phase 1  
**Authority:** Principal Language Architect & Static Analysis Engineer

---

## 1. Declarative Spatial Semantics (Implemented)

### 1.1 Node Registration & Identity Uniqueness
- **Semantic Rule:** Node identifiers inhabit a global flat symbol table within each program compilation unit.
- **Invariant:** Duplicate node identifiers throw a compile-time failure:
  $$\forall\ n_1, n_2 \in \text{Nodes},\quad n_1.\text{id} = n_2.\text{id} \implies n_1 = n_2$$
- **Runtime Allocation:** Each registered node allocates a 64 KB baseline runtime descriptor in the VM's `RSSGuard`.

### 1.2 Coordinate Normalization Bounds
- **Semantic Rule:** All `@Space(x, y, z)` coordinates must lie strictly within the closed unit cube $[0.0, 1.0]^3$:
  $$\forall\ c \in \{x, y, z\},\quad 0.0 \le c \le 1.0$$
- **Violation Behavior:** Values outside $[0.0, 1.0]$ halt compilation with `[Spatial Bound Error]`.

### 1.3 Discrete Voxel Lattice Quantization (`@Grid777`)
- **Semantic Rule:** Every discrete index $(i, j, k)$ must be an integer within $[0..6]$.
- **Address Mapping:**
  $$\text{CellIndex} = i + 7j + 49k \in [0..342]$$
- **Spatial Equivalence:**
  $$(x, y, z) = \left( \frac{i}{6}, \frac{j}{6}, \frac{k}{6} \right)$$

### 1.4 Streaming Funnel & Gossip Semantics
- **Referential Integrity:** Every `stream Source -> Target` must reference declared nodes. Unresolved endpoints throw `[Compiler Error] Funnel '...' references undefined node`.
- **Memory Allocation:** Stream buffer memory ($\text{bufferMb} \times 1024 \times 1024$) is statically checked against the global RSS limit and dynamically reserved upon VM initialization.

---

## 2. Memory Ceilings & Fail-Closed Gating

### 2.1 The Hard 512 MB Physical Envelope
- **Compile-Time Constraint:**
  $$\sum \text{NodeDescriptors} + \sum \text{StreamBuffers} + \sum \text{ZeroCopyViews} \le \min(\text{rss\_max}, \text{@assert\_rss}, 512\text{ MB})$$
- **Violation Behavior:** If static allocations exceed the declared memory ceiling, the compiler halts immediately and refuses to emit bytecode.

### 2.2 Permanent Hardware Actuation Lock
- **Semantic Rule:** When `@actuation_lock(true)` is specified (or by default in sovereign mode), write access to physical hardware switches or actuators is permanently disabled.
- **Runtime Behavior:** Any command attempting physical actuation raises `ActuationBlockedError` and halts execution.

---

## 3. Cryptographic State Snapshot Sealing

### 3.1 Deterministic State Invariant ($\sigma^2 = 0.0$)
- **Snapshot Evaluation:** When `seal "<path>"` is executed, the entire runtime state (active nodes, coordinates, grid indices, stream buffers, and allocated bytes) is serialized into a canonical JSON representation.
- **Hash Evaluation:** A deterministic FNV-1a / SHA3-512 cryptographic digest is generated and recorded. Identical runtime states produce bit-for-bit identical hashes across replay cycles.

---

## 4. Computational Semantics (Implemented in Phase 2)

### 4.1 Lexical Scoping & Shadowing
- **Hierarchical Envelopes:** Scopes form a strict tree ($\text{Global} \to \text{Function} \to \text{Block}$).
- **Shadowing:** An inner function or block scope may declare an identifier matching an outer variable without mutating the outer binding.
- **Leakage Prevention:** Identifiers declared within inner blocks are inaccessible outside the block boundary, throwing diagnostic `E3004: Undefined identifier`.

### 4.2 Constant Immutability
- Identifiers declared with `const` require an immediate initializer and become strictly immutable in that scope. Reassignment attempts throw `E3008: Cannot reassign to constant`.

### 4.3 Static Type Safety & Conversion Invariance
- Arithmetic operators (`+`, `-`, `*`, `/`, `%`) require numerical operands.
- Implicit coercions between `number` and `string` are forbidden; string concatenation requires both operands to be `string`.
- Conditional tests in `if` and `while` must evaluate to `boolean`.

### 4.4 Function Call & Return Invariance
- Function calls must supply arguments exactly matching parameter arity (`E3005: Argument count mismatch`).
- The `return` statement is strictly prohibited outside of an enclosing function body (`E3003`).
