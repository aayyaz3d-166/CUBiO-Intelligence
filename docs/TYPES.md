# ONE LANGUAGE — TYPE SYSTEM SPECIFICATION v0.1
**Specification Lock:** Phase 1  
**Authority:** Language Architect & Compiler Engineer

---

## 1. Type Architecture Overview

ONE LANGUAGE features a **two-tier typing model**:
1. **DSL Layer (Implemented):** Implicit, structurally validated types for spatial coordinates, identifiers, memory caps, and byte buffers.
2. **Computational Layer (Specified):** Statically typed primitives, explicit conversions, and user-defined structural composites (`struct`, `enum`).

---

## 2. Primitive Types

| Type Name | Bit Width | Representation | Default Value | Notes |
| :--- | :---: | :--- | :---: | :--- |
| `Int32` | 32 bits | Two's complement integer | `0` | Standard integer for indexing and counts |
| `Int64` | 64 bits | Two's complement integer | `0` | High-precision timestamps and raw byte counters |
| `Float32` | 32 bits | IEEE 754 single-precision | `0.0f` | High-throughput spatial coordinates and physics |
| `Float64` | 64 bits | IEEE 754 double-precision | `0.0d` | Planck-Einstein constants and high-precision QED |
| `Bool` | 8 bits | `0x01` (true), `0x00` (false) | `false` | Logical boolean flags |
| `String` | Variable | UTF-8 encoded string literal | `""` | File paths, identifiers, and telemetry status codes |
| `Void` | 0 bits | No value | N/A | Return type for non-returning methods |

---

## 3. Spatial & Native Types

### 3.1 `SpatialCoordinate`
Continuous 3-space point normalized within the unit cube $[0.0, 1.0]^3$:
```text
struct SpatialCoordinate {
    x: Float32; // In range [0.0, 1.0]
    y: Float32; // In range [0.0, 1.0]
    z: Float32; // In range [0.0, 1.0]
}
```

### 3.2 `Grid777Coordinate`
Discrete lattice coordinates within the $7\times 7\times 7 = 343$ cell voxel mesh:
```text
struct Grid777Coordinate {
    i: Int32; // Discrete index in [0..6]
    j: Int32; // Discrete index in [0..6]
    k: Int32; // Discrete index in [0..6]
    cellIndex: Int32; // Exact linear address: i + 7*j + 49*k in [0..342]
}
```

### 3.3 `Address369`
Canonical hardware register address in range `[0..368]`:
- `[0..25]`: Symbolic registers ('A' through 'Z')
- `[26..368]`: Spatial voxel lattice cells (343 cells)
- Display Index conversion: $\text{DisplayIndex} = \text{InternalAddress} + 1 \in [1..369]$.

---

## 4. Type Conversions & Casting

### 4.1 Strict No-Implicit-Coercion Rule
ONE LANGUAGE forbids implicit type coercion. Mixing an `Int32` with a `Float32` in arithmetic without an explicit cast is a compile-time error.

### 4.2 Explicit Casting (`Cast<T>`)
```one
let count: Int32 = 7;
let ratio: Float32 = Cast<Float32>(count) / 6.0f;
```

---

## 5. Equality & Null Semantics

1. **Primitive Equality (`==`):** Bit-exact value equality for integers and booleans. Floating-point comparison uses standard IEEE 754 semantics.
2. **Deterministic Zero-Null Policy:** Uninitialized pointers are strictly disallowed. Optional spatial values must be explicitly marked via boolean presence flags (e.g. `is_rf_null: Bool`) rather than ambiguous null references.
