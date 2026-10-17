# ONE LANGUAGE — COMPILER PIPELINE SPECIFICATION v0.1
**Specification Lock:** Phase 1  
**Authority:** Compiler Engineer & Language Architect

---

## 1. Compiler Architecture (`src/one/oneCompiler.ts`)

The compiler transforms a parsed `ProgramNode` into an executable bytecode package (`ExecutableCubiOAST`).

```text
┌───────────────────────────┐
│     Source Code (.one)    │
└─────────────┬─────────────┘
              │ Lexical Analysis (OneLexer)
              ▼
┌───────────────────────────┐
│       Token Stream        │
└─────────────┬─────────────┘
              │ Grammar Routing (GrammarRouter)
              ▼
┌───────────────────────────┬───────────────────────────┐
│    Declarative Parser     │   Computational Parser    │
│       (OneParser)         │   (ComputationalParser)   │
└─────────────┬─────────────┴─────────────┬─────────────┘
              └─────────────┬─────────────┘
                            ▼
              ┌───────────────────────────┐
              │        Unified AST        │
              └─────────────┬─────────────┘
                            │ Semantic Analysis & Scopes (SemanticAnalyzer)
                            ▼
              ┌───────────────────────────┐
              │    Static Type Checker    │
              │  (Type inference & E2000) │
              └─────────────┬─────────────┘
                            │ IR Lowering (IRLowering)
                            ▼
              ┌───────────────────────────┐
              │        Unified IR         │
              │ (16 Typed Linear Opcodes) │
              └───────────────────────────┘
```

---

## 2. Compilation Stages

### Stage 1: Memory Budget Calculation
- Reads `rss_max` and `@assert_rss`.
- Computes effective memory cap:
  $$\text{effectiveCap} = \min(\text{rss\_max}, \text{assert\_rss})$$
- Asserts $\text{effectiveCap} \le 512\text{ MB}$.

### Stage 2: Node Lowering & Spatial Invariant Checking
- Iterates over `ast.nodes`.
- Verifies uniqueness of node identifiers.
- Validates that coordinates $(x, y, z)$ satisfy $0.0 \le x, y, z \le 1.0$.
- Calculates 64 KB baseline allocation per node.
- Lowers into `ALLOC_SPATIAL_NODE` instructions.

### Stage 3: Discrete Lattice Quantization
- If node specifies `@Grid777(i, j, k)`, verifies $i, j, k \in [0..6]$.
- Calculates discrete cell index $i + 7j + 49k \in [0..342]$.
- Lowers into `ALLOC_VOXEL_GRID` instructions.

### Stage 4: Zero-Copy Memory View Mapping
- If node specifies `@memview(mb)`, reserves buffer bytes in static calculation.
- Lowers into `MAP_ZERO_COPY_VIEW` instructions.

### Stage 5: Streaming Funnel & Gossip Routing
- Verifies source and target nodes exist in the symbol set.
- Computes stream buffer allocation ($\text{bufferMb} \times 1024 \times 1024$).
- Lowers into `OPEN_FUNNEL_STREAM` or `OPEN_GOSSIP_CHANNEL` instructions.

### Stage 6: Static Allocation Ceiling Assertion
- Asserts that total static allocations do not exceed the declared limit.
- If $\sum \text{Allocations} > \text{limit}$, compilation halts fail-closed.
