# ONE LANGUAGE — SECURITY MODEL SPECIFICATION v1.0.1
**Specification Status:** LOCKED / CERTIFIED (Task 20, 24, 25, 27)  
**Authority:** Principal Security Engineer & Protocol Auditor

---

## 1. Foundational Security Principles

ONE LANGUAGE enforces a **Zero-Trust, Fail-Closed Security Posture** across compilation, packaging, VM dispatch, and reasoning:

1. **Permanent Hardware Actuation Lock:** Physical hardware actuation switches and output pins are locked closed by default. The static property `is_actuation_blocked = true` and container header flag `ACTUATION_LOCK = true` are immutable. Read-only sensor telemetry is permitted; physical actuation raises immediate fail-closed error `E8005` or `E7010`.
2. **Strict Address369 Spatial Memory Partitioning:** Low-level addressable memory registers in ONE Language are strictly bounded within $[0..368]$. Direct access to reserved registers $[369..511]$ or $> 511$ is rejected fail-closed.
3. **Hard Hardware Memory Gating:** Peak physical RSS memory is strictly capped at **512 MB**. Allocations breaching this cap trigger instantaneous eviction or fatal process termination.
4. **Deterministic Sandboxing:** Pure computational routines execute with zero unseeded entropy, guaranteeing reproducible execution traces ($\sigma^2 = 0.0$).
5. **No Dynamic Code Synthesis:** Dynamic evaluation primitives (`eval()`, `new Function()`, reflective arbitrary class loading) are strictly prohibited.
6. **Headless Offline Independence:** The core CLI, compiler, and VM execute 100% offline without requiring background daemon processes, WebSocket listeners, or graphical UI subsystems.

---

## 2. Address369 Spatial Memory Partition Matrix

Memory in the ONE Language execution fabric is partitioned deterministically:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          ONE LANGUAGE ADDRESS369 MEMORY SPACE                          │
├─────────────────────┬───────────────────────────────────────┬──────────────────────────┤
│ Range               │ Purpose / Classification              │ Access Policy            │
├─────────────────────┼───────────────────────────────────────┼──────────────────────────┤
│ [0..25]             │ 26 Symbolic Registers                 │ Read / Write (Bounded)   │
│                     │ - Reserved keywords, primitives,      │ - Checked bounds         │
│                     │   root symbol bindings                │                          │
├─────────────────────┼───────────────────────────────────────┼──────────────────────────┤
│ [26..368]           │ 343 Spatial Lattice Voxel Cells       │ Read / Write (Voxel Grid)│
│                     │ - 7x7x7 discrete coordinate space     │ - Mapped to (x, y, z)    │
│                     │ - Offset formula: 26 + x + 7y + 49z   │ - Center (3,3,3) = #197  │
├─────────────────────┼───────────────────────────────────────┼──────────────────────────┤
│ [369..511]          │ Reserved Guard Band                   │ STRICTLY FORBIDDEN       │
│                     │ - Preserved for future system micro-  │ - Throws E8005 / E2004   │
│                     │   architecture expansion              │ - Fail-Closed Static/VM  │
├─────────────────────┼───────────────────────────────────────┼──────────────────────────┤
│ > 511               │ Out-of-Bounds Address Space           │ HARD COMPILATION PANIC   │
└─────────────────────┴───────────────────────────────────────┴──────────────────────────┘
```

### Voxel Coordinate Mapping Formula
For discrete coordinates $(x, y, z) \in [0..6]^3$:
$$\text{Address} = 26 + x + 7y + 49z$$
- Minimum spatial address: $(0, 0, 0) \to 26$
- Maximum spatial address: $(6, 6, 6) \to 26 + 6 + 42 + 294 = 368$
- Center voxel: $(3, 3, 3) \to 26 + 3 + 21 + 147 = 197$

---

## 3. Capability & Gating Matrix

| Subsystem | Security Boundary | Enforcement Mechanism | Failure Mode |
| :--- | :--- | :--- | :--- |
| **Actuation** | Physical Actuation Bus | `is_actuation_blocked: true`, `ACTUATION_LOCK` header flag | `E8005: Actuation safety violation` |
| **Memory** | 512 MB Physical Envelope | `RSSGuard.allocate()`, `ExtremeMemoryVMAdapter` | `E7011: Memory ceiling exceeded` |
| **Spatial Bounds** | $7 \times 7 \times 7$ Grid $[0..6]^3$ | Static coordinate assertion & `Address369` bounds | `E7012` / `E7013` Boundary Exception |
| **Call Stack** | Maximum 512 Frames | Call frame stack counter in `UnifiedVM` | `E5006: Call stack depth limit exceeded` |
| **Instruction Budget**| 100,000 Instructions default | `instructionQuota` cycle decrement | `E5004` / `E5007` Quota Depleted |
| **I/O Input** | Standard Input Stream | EOF check on stream read | `E5012: Input stream exhausted` |
| **Module Sandbox** | Workspace Root | `validatePath()` prevents `../` path traversal | `E4001: Path traversal attempt` |
| **IPC Bridge** | JSON-RPC Frames | Token redaction filter (`[REDACTED_SECRET]`) | Secret leakage prevented |
| **Snapshots** | Cryptographic Provenance | SHA-256 + 8-layer Merkle Root (`0x369_SEAL`) | Determinism verification fail |

---

## 4. IPC Bridge & Subsystem Isolation

The `AgiOneIPCBridge` mediates communication between the core execution engine and external consumers (such as the 3D Memory Studio):

1. **Sensitive Data Redaction:**
   All environment variables, keys, and tokens matching sensitive patterns (`TOKEN`, `KEY`, `SECRET`, `AUTH`, `PASS`) are redacted to `[REDACTED_SECRET]` before transmission.
2. **Disconnected Resilience:**
   If the 3D Memory Studio or external client disconnects or fails to respond, the core engine continues execution uninterrupted without throwing unhandled exceptions or leaking socket handles.
3. **No Unsanctioned Ports:**
   Network listeners are strictly opt-in and disabled by default. Core compiler operations never bind TCP/UDP ports.
