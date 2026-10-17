# ONE LANGUAGE — RUNTIME & VM ARCHITECTURE v0.1
**Specification Lock:** Phase 1  
**Authority:** VM Architect & Runtime Engineer

---

## 1. Virtual Machine Architecture (`src/core/engine/cubioVM.ts`)

The **CubiO Virtual Machine** executes `ExecutableCubiOAST` packages through a synchronous deterministic instruction dispatch loop.

### Core VM State Components
- `rssGuard: RSSGuard`: Active in-memory byte counter enforcing the hard 512 MB ceiling.
- `activeNodes: Map<string, RuntimeSpatialNode>`: Active spatial nodes with 3D coordinates, checkpoints, and zero-copy memory views.
- `activeStreams: Map<string, RuntimeFunnelStream>`: Active data streams and priority gossip channels.
- `activeSlices: RuntimeSpatialSlice[]`: Registered spatial volume range queries.
- `sealedSnapshots: Map<string, string>`: Cryptographic state hashes (`0x369_<hex>_SEAL`).
- `actuationLocked: boolean`: Global hardware safety lock.

---

## 2. Implemented Opcode Directory

| Opcode | Payload | VM Action | Memory Impact |
| :--- | :--- | :--- | :---: |
| `SET_RSS_GUARD` | `{ limitMb, byteCap }` | Initializes `RSSGuard` with specified byte cap | None |
| `ASSERT_RESOURCE_LIMITS` | `{ actuationLock }` | Sets `this.actuationLocked` flag | None |
| `ALLOC_SPATIAL_NODE` | `{ nodeId, coordinate, checkpoints, seals }` | Instantiates and registers `RuntimeSpatialNode` | +64 KB |
| `ALLOC_VOXEL_GRID` | `{ nodeId, grid777, cellIndex }` | Associates node with 7x7x7 voxel index | None |
| `MAP_ZERO_COPY_VIEW` | `{ nodeId, viewSizeBytes, viewSizeMb }` | Allocates `SharedArrayBuffer` & maps `Uint8Array` view | +ViewSize |
| `ALIGN_HARMONIC` | `{ nodeId, targetCoordinate, harmonicMesh }` | Computes geometric distance scaling & stores lock | None |
| `OPEN_FUNNEL_STREAM` | `{ funnelId, from, to, bufferMb, priority }` | Registers directional stream pipeline | +BufferBytes |
| `OPEN_GOSSIP_CHANNEL` | `{ channelId, from, to, bufferMb, priority }` | Registers priority gossip broadcast channel | +BufferBytes |
| `SEAL_CRYPTOGRAPHIC_SNAPSHOT` | `{ targetPath, scope, nodeId }` | Serializes state and computes deterministic hash | None |
| `QUERY_SPATIAL_SLICE` | `{ xRange, yRange, zRange }` | Evaluates coordinate containment across active nodes | None |

---

## 3. Target Computational Opcodes (Phase 2 Roadmap)

To enable general-purpose computation in future phases, the instruction set will be extended with:

```text
Stack & Variable:  PUSH, POP, LOAD, STORE
Arithmetic:        ADD, SUB, MUL, DIV, MOD
Comparison:        CMP_EQ, CMP_NE, CMP_LT, CMP_GT
Control Flow:      JUMP, JUMP_IF_TRUE, JUMP_IF_FALSE
Subroutine:        CALL, RETURN
Native Primitives: SPATIAL_DISTANCE, HARMONIC_RESONANCE, PQC_SEAL
```

---

## 4. Deterministic Execution Guarantee

- Every VM run executes with **zero external nondeterministic sources** (zero `Math.random()`, zero unseeded clocks).
- Determinism variance is strictly verified as:
  $$\sigma^2 = 0.0$$
