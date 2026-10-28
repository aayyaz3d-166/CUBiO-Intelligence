# ONE LANGUAGE — BACKWARD COMPATIBILITY CONTRACT
**Specification Lock:** Phase 1  
**Status:** Mandatory Architectural Constraint  
**Standard:** Zero Silent Breaking Changes

---

## 1. Absolute Preservation Guarantee

All existing ONE Language Declarative Spatial DSL programs currently parsed by `OneParser.ts` and executed by `CubiOVirtualMachine.ts` are **guaranteed 100% backward compatible**.

No changes introduced in Phase 1 or subsequent v0.x releases may break:
1. `node <Id> { @Space(...); @Grid777(...); @memview(...); align => (...); checkpoint <id>; seal "..."; }`
2. `funnel <Id> { stream <Src> -> <Tgt> : <Mb>; @gossip; }`
3. `channel <Id> { stream <Src> -> <Tgt> : <Mb>; @gossip; }`
4. `rss_max = <limit>;`, `@assert_rss(<limit>);`, `@actuation_lock(<bool>);`
5. `@Slice ([x_min..x_max, y_min..y_max, z_min..z_max]);`
6. `CanonicalAddress369` indexing range `[0..368]` (`[26..368]` for spatial voxels)
7. `dist/bin/spatial_engine.rv64.bin` binary header layout (64-byte header, magic `0x3690B4E0`)

---

## 2. Syntax Compatibility Mapping

| Existing Syntax (v0.0) | v0.1 Status | Planned v0.2 Evolution | Compatibility Action |
| :--- | :---: | :---: | :--- |
| `rss_max = 512;` | Active | Active | Fully preserved |
| `@assert_rss(256);` | Active | Active | Fully preserved |
| `@actuation_lock(true);` | Active | Active | Fully preserved |
| `node <Name> { ... }` | Active | Extended with methods | Fully preserved |
| `funnel <Name> { ... }` | Active | Unified with channels | Fully preserved |
| `channel <Name> { ... }`| Active | Unified with streams | Fully preserved |
| `@Space(x, y, z);` | Active | Active | Fully preserved |
| `@Grid777(i, j, k);` | Active | Active | Fully preserved |
| `@memview(mb);` | Active | Active | Fully preserved |
| `align => (x, y, z);` | Active | Active | Fully preserved |
| `seal "path.3dmemory";` | Active | Active | Fully preserved |

---

## 3. Migration Strategy for Computational Grammar

When Phase 2 introduces `let`, `if`, `for`, `function`, and `struct` parsing into `OneParser.ts`, the parser will employ a **Dual-Mode Disambiguation Strategy**:

1. **Top-Level Declarative Directives:** Directives like `node`, `funnel`, `channel`, and `rss_max` will continue to be parsed into the existing `NodeDeclarationNode` and `FunnelDeclarationNode` AST structures.
2. **Top-Level Computational Declarations:** Keywords like `module`, `struct`, `function`, and `let` will be parsed into new AST nodes (`ModuleDeclarationNode`, `FunctionDeclarationNode`, `VariableDeclarationNode`) without interfering with declarative node blocks.
3. **Internal Node Logic:** Future versions will allow spatial nodes to contain executable member methods alongside `@Space` and `@Grid777` properties.

---

## 4. Deprecation Policy

1. No existing syntax may be deprecated without a minimum of **two minor version notices** (e.g. v0.1 notice for v0.3 removal).
2. Any deprecation must be preceded by an automated CLI migration tool (`one migrate <source>`).
3. In Phase 1, **ZERO syntax constructs are deprecated**.
