# ONE LANGUAGE — SYNTAX REFERENCE v0.1
**Specification Lock:** Phase 1  
**Authority:** Language Designer & Compiler Architect

---

## 1. Lexical Rules

- **Whitespace:** Space, horizontal tab, and newline are treated as token separators.
- **Comments:** Single-line comments begin with `//` and extend to the end of the line.
- **Identifiers:** Match `/[a-zA-Z_@][a-zA-Z0-9_@]*/`.
- **Numeric Literals:**
  - Standard integers: `10`, `512`, `0`
  - Floating-point numbers: `0.333`, `1.204f`, `6.626e-34`
- **String Literals:** Enclosed in double quotes (`"..."`) or single quotes (`'...'`).

---

## 2. Declarative Spatial Syntax (Implemented)

### Memory Gating
```one
rss_max = 512;
@assert_rss(256);
@actuation_lock(true);
seal "checkpoint_alpha.3dmemory";
```

### Spatial Node Block
```one
node AlphaCore {
    @Space(0.125, 0.250, 0.375);
    @Grid777(1, 2, 3);
    @memview(64);
    align => (0.1, 0.2, 0.3);
    checkpoint stage1;
    seal "node_alpha.3dmemory";
}
```

### Communication Funnels & Gossip
```one
funnel DataStream {
    stream AlphaCore -> BetaReceiver : 128;
    @gossip(9);
}

channel EmergencyBroadcast {
    stream AlphaCore -> BetaReceiver : 16;
    @gossip(1);
}
```

---

## 3. Computational Syntax (Implemented in Phase 2)
*Status:* **IMPLEMENTED (Phase 2 via ComputationalParser.ts)**

### Variables & Bindings
```one
let counter: Int32 = 0;
let mut_voltage: Float32 = 230.0f;
const MAX_VOLTAGE: Float32 = 400.0f;
```

### Conditional Execution
```one
if (mut_voltage > MAX_VOLTAGE) {
    print("SURGE_DETECTED");
} else {
    print("VOLTAGE_NOMINAL");
}
```

### Iteration Loops
```one
for (let i: Int32 = 0; i < 7; i = i + 1) {
    process_voxel(i);
}
```

### Function Declarations
```one
function calculate_skin_depth(frequency_hz: Float32, conductivity: Float32): Float32 {
    let mu0: Float32 = 1.256637e-6f;
    let pi: Float32 = 3.14159265f;
    return 1.0f / Sqrt(pi * frequency_hz * mu0 * conductivity);
}
```

### Structs & Enums
```one
enum StabilityStatus {
    STABLE,
    TRANSIENT,
    CRITICAL
}

struct GridState {
    frequency_hz: Float32;
    voltage_rms: Float32;
    status: StabilityStatus;
}
```
