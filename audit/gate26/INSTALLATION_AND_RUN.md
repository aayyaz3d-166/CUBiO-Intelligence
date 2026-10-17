# ONE LANGUAGE — INSTALLATION AND RUN

**Gate ID:** `GATE-26-ONE-LANGUAGE-V1-RELEASE`  
**Date:** 2026-10-11  
**Repository:** `F:\ONE language`  
**Mode:** RELEASE QUALIFICATION — EVIDENCE-DRIVEN

---

## 1. Prerequisites

| Requirement | Details |
|-------------|---------|
| Operating System | Windows 11 (MSYS2 MinGW64 path present) |
| Node.js | v26.7.0 (https://nodejs.org/) |
| npm | Bundled with Node.js (v10.2.4+) |
| TypeScript | ^5.4.5 (devDependency) |
| ts-node | ^10.9.2 (devDependency) |
| node_modules | `npm install` required |

**No external network services or API keys are required.**

---

## 2. Installation

```powershell
# 1. Clone or extract the repository
cd F:\ONE language

# 2. Install dependencies (devDependencies only)
npm install

# 3. Build (TypeScript compile)
npx tsc
```

**Note:** The repository defines `"type": "module"` in package.json. The compiled output in dist/ is CommonJS. The test runner uses npx ts-node --transpile-only (TypeScript, no type-checking).

---

## 3. Startup Commands

### 3.1 Using the sovereign native binary (one.exe)

From README.md:
```powershell
.\one.exe inspect "rss_max = 512; node Sector_01 { @Space(0.3, 0.6, 0.9); checkpoint init; }"
.\one.exe compile program.one
.\one.exe run program.one
```

### 3.2 Using the TypeScript test runner

```powershell
npx ts-node --transpile-only src/one/test_one_language.ts
npx ts-node --transpile-only src/core/test_phase2_execution.ts
npx ts-node --transpile-only src/test_phase3_streaming.ts
npx ts-node --transpile-only src/core/test_phase4_checkpointing.ts
npx ts-node --transpile-only src/mesh/test_phase5_mesh.ts
```

### 3.3 Using the Explorer UI server (separate HTTP server)

```powershell
# The Explorer UI is a separate Node.js HTTP server (src/one_net/ui/)
# It is NOT wired into the release build (see V1_RELEASE_SCOPE.md).

cd F:\ONE language\src\one_net\ui
node server.js
# Server listens on http://127.0.0.1:8080
```

**Note:** The Explorer UI server is an experimental, isolated HTTP server. It is not part of the v1.0 release scope.

---

## 4. Supported Capabilities

| Capability | Status |
|------------|--------|
| Binary encoding and decoding (`binaryEncoder.ts`, `binaryDecoder.ts`) | SUPPORTED |
| 369-address spatial mapping and grid operations (`OneAddress369`, `GridMemory`) | SUPPORTED |
| Bounded symbolic reasoning (`RuleRegistry`, `StateExplorer`, `CandidateEvaluator`, `ReasoningEngine`) | SUPPORTED |
| Concept graph queries (`ConceptGraph.ts`) | SUPPORTED |
| Conversation parsing and fallback (`HybridConversationEngine.ts`, `IntentParser.ts`) | LIMITED (single-request, no multi-turn context) |

**Not included in v1.0 release scope:**

- Reasoning traces (NOT IMPLEMENTED)
- Dialogue memory (NOT IMPLEMENTED)
- Neural integration (NOT IMPLEMENTED — blocked)
- Explorer UI (EXPERIMENTAL / PARTIALLY IMPLEMENTED)
- API (EXPERIMENTAL / PARTIALLY IMPLEMENTED)

---

## 5. Test and Benchmark Instructions

```powershell
# Phase 1
npx ts-node --transpile-only tests/phase1_bridge_verification.test.ts

# Phase 2
npx ts-node --transpile-only tests/binary/phase2_binary_language.test.ts

# Phase 3
npx ts-node --transpile-only tests/reasoning/phase3_reasoning_engine.test.ts

# Phase 4
npx ts-node --transpile-only tests/memory/phase4_memory_layer.test.ts

# Gate 4
npx ts-node --transpile-only tests/hybrid/phase5_gate4_native5m_integration.test.ts

# Gate 6
npx ts-node --transpile-only tests/hybrid/phase5_gate6_conversational_quality.test.ts

# Gate 8
npx ts-node --transpile-only tests/hybrid/phase5_gate8_reasoning_relationship_conversational.test.ts
```

**Known issue (not authorized to fix):** The test command above fails with ERR_MODULE_NOT_FOUND / ERR_UNSUPPORTED_DIR_IMPORT in the current environment because the test files import ../src/... directory paths and Node 26 ESM does not support directory imports without explicit .ts extensions or a --experimental-strip-types flag.

---

## 6. Known Limitations

See KNOWN_LIMITATIONS.md for the full list.

| Limitation | Impact |
|------------|--------|
| Goal-directed search efficiency | Parser recognition only |
| Multi-turn dialogue context | Not implemented |
| Neural inference | NOT IMPLEMENTED (vocab=369 spatial tokens) |
| Frontend/backend integration | No integrated E2E test suite |
| Module resolution | Directory imports not supported by Node 26 ESM |

---

## 7. Troubleshooting and Recovery

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Test command fails with ERR_MODULE_NOT_FOUND | Test files import ../src/... directory paths; Node 26 ESM does not support directory imports | Fix test imports to use explicit .ts extensions (require authorization) |
| Test command fails with ERR_UNSUPPORTED_DIR_IMPORT | npm/ts-node ESM resolver rejects directory imports | Fix test imports to use explicit .ts extensions (require authorization) |
| one.exe not found | The sovereign native binary is not distributed in this repository | Download the native binary from the official release package (separate artifact, not included in this release) |
| node_modules missing | Dependencies not installed | Run npm install |
| Builder not found after npm install | DevDependencies not installed | Run npm install |
| Permissions error on one.exe | Windows execution policy | Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned |

---

## 8. Version and Changelog

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-10-11 | v1.0 release qualification gate (GATE 26). Scope provisional; Gates 12–25 not run. Test command not reproducible in current environment. |

---

## 9. License and Third-Party Notices

| License | Notes |
|---------|-------|
| MIT | Source in src/one_net/ui/ and its tests |
| RESTRICTIONS.md | Redistribution terms (no model weights, no datasets, no checkpoints) |

See LICENSE and RESTRICTIONS.md for full terms.

---

## 10. Model and Dataset Provenance

| Artifact | Provenance |
|----------|-----------|
| Checkpoint | E:/3D memory studio/data/checkpoints/one_lm_v1/one_lm_best.cubiomodel (19,594,556 bytes, SHA-256 2D35BB53A226FD369C3B282C1EA6A0D039F66A3557D31A77EAC72ED8C9DBF948) |
| Binary protocol | src/binary/binaryCodebook.ts, binaryDecoder.ts, binaryEncoder.ts (protected hashes match Audit Manifest) |

**No model weights or datasets are distributed in this release.**

---

## 11. Recovery Instructions

If the release fails to build or tests fail:

1. Record the error output (this is the audit trail).
2. Do not modify protected files or model checkpoints without authorization.
3. Restore from the audit/gate10/ baseline manifests.
4. Re-run the documented test command after fixing the module-resolution blocker (directory imports → explicit .ts extensions).
5. Re-run the test suite and record the results in RELEASE_TEST_RESULTS.json.
