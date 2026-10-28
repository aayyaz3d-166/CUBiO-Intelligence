# ONE Intelligence — Repository Baseline & Releases Audit

> **Document:** `REPOSITORY_BASELINE_AND_RELEASES.md`  
> **Mode:** Strict READ-ONLY Forensic Inspection  
> **Scope:** Repository A (`F:\ONE language`) & Repository B (`F:\one-binary-reasoning`)  
> **Timestamp:** 2026-10-28T12:45:00+05:00  

---

## 1. Repository A: ONE Language

### 1.1 Git Metadata & Baseline State
- **Local Filesystem Path:** `F:\ONE language`
- **Active Working Branch:** `integration/v1.0.1-local`
- **HEAD Commit SHA:** `fcce5745428e0637ef53d278453aed12cc4bcde2`
  - *Commit Message:* `merge: integrate feat/v1.0.1-command-syntax into integration/v1.0.1-local`
- **Working Tree Status:** Clean test baseline; documentation files synchronized.
- **Git Remotes:**
  - `origin`: `https://github.com/aayyaz3d-166/ONE-language-` (fetch & push)
  - `new-origin`: `https://github.com/aayyaz3d-166/ONE-language.git` (fetch & push)
- **Local Branches:**
  - `feat/v1.0.1-command-syntax`
  - `integration/v1.0.1-local` (active)
  - `main`
  - `stabilization/phase-1-fixes`
- **Remote Tracking Branches:**
  - `new-origin/HEAD -> new-origin/stabilization/phase-1-fixes`
  - `new-origin/feat/v1.0.1-command-syntax`
  - `new-origin/stabilization/phase-1-fixes`
  - `origin/stabilization/phase-1-fixes`
- **Available Git Tags:**
  - `v0.1.0-baseline`
  - `v1.0.0` (Points to commit `2cf25533c5165964f4757cf1f660c991d3e628ed`)
  - `v1.0.1` (Points to commit `5f9dc99b9aa90f76edabbc21f4caa3a456a765c3`)

### 1.2 Protected Release Artifact Inventory & Checksums

All artifacts in [`dist/v1.0.1-rc/`](file:///F:/ONE%20language/dist/v1.0.1-rc) were verified against their on-disk SHA-256 digests and manifest metadata:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        RELEASE CANDIDATE (v1.0.1-rc) INVENTORY                         │
├──────────────────────────┬───────────┬───────────────────────────────────┬─────────────┤
│ Artifact Name            │ Size      │ Authoritative SHA-256 Digest      │ Status      │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ one.exe                  │ 102059520B│ 479186CA87F55781825DF05F5603AC3747│ FROZEN      │
│                          │(97.33 MB) │ ADA4C2E9AA78DE9E3CD233A993020E    │ Protected   │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ one-language-1.0.1.vsix  │ 2047908 B │ 33C8F6C59FD04ACAFC514D0D7BE4CC80ED│ FROZEN      │
│                          │ (1.95 MB) │ 397352348A7425FAFA349AC00C5B0D    │ Protected   │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ one-language-1.0.1-src.zip 1996348 B │ 925FB6CF562378AFB824FE6709740018C5│ FROZEN      │
│                          │ (1.90 MB) │ 54238B069E5BEB5144260851846ED5    │ Protected   │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ one.exe.manifest.json    │ 402 bytes │ Declares size, target, actuation  │ Match       │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ one-language-1.0.1.vsix. │ 670 bytes │ Declares extension ID, features,  │ Match       │
│ manifest.json            │           │ supported engines (^1.80.0)       │             │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ one-language-1.0.1-src.  │ 236 bytes │ Declares file count (559 files),  │ Match       │
│ zip.manifest.json        │           │ build timestamp, and sha256       │             │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ cli-bundle.cjs           │ 10506575 B│ Bundled CommonJS CLI module       │ Validated   │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ sea-prep.blob            │ 10506645 B│ Single Executable Application blob│ Validated   │
├──────────────────────────┼───────────┼───────────────────────────────────┼─────────────┤
│ sea-config.json          │ 170 bytes │ Node SEA build configuration      │ Validated   │
└──────────────────────────┴───────────┴───────────────────────────────────┴─────────────┘
```

#### Historical v1.0.0 Artifacts Preserved in `dist/`:
- `dist/one-language-1.0.0-src.zip`: 1,384,778 bytes (SHA-256: `45A564AF28D6C4ED8BF7D2317349EE390DF6BB5EA0979A0066BB0DC51044FE49`).
- `dist/one-language-0.1.0.vsix`: 1,731,207 bytes.

### 1.3 Directory & Codebase Layout
- `src/one/` (249 files): Unified production compiler, VM, AST, IR, tensor engine, autograd, VIG, memory, orchestration.
- `src/core/` (28 files): CubiO core engine, checkpoints, WAL, RSS guard, thread pool, streaming funnels.
- `src/studio/` (13 files): 3D Memory Studio, voxel/particle renderers, `IntelligenceCoreMaster.tsx`.
- `src/vm/` (8 files): Spatial prototype VM (`cubioVM.ts`, `bitAgent.ts`, `entropyEngine.ts`, `gridMemory.ts`).
- `src/binary/` (6 files): Binary Language codec, codebook, triangle mapper, protocol types.
- `src/mesh/`, `src/mail/`, `src/net/`: Optional subsystems (distributed mesh, OMail, decentralized DNS).
- `editors/vscode/` (12 files): VS Code language extension (manifest, grammar, snippets, icon).
- `tests/` (54 files): Comprehensive integration and unit test suites.
- `packages/` (12 files): 5 modular packages (`ast-emitter`, `nlp-parser`, `pqc-lattice`, `sovereign-cli`, `time-travel`).
- `scripts/` (10 files): Standalone exe builder, VS Code packager, test runners.

### 1.4 Dependencies & Toolchain Prerequisites
- **Node.js Runtime:** `v24.14.1` (x64) certified (supports ESM loader).
- **TypeScript:** `5.4.5` (via `devDependencies`).
- **ESBuild:** `0.20.2` (via `devDependencies`).
- **Runtime Dependencies:** **ZERO** (`dependencies` is omitted in `package.json`; 100% self-contained).

---

## 2. Repository B: ONE Binary Reasoning Intelligence

### 2.1 Git Metadata & Baseline State
- **Local Filesystem Path:** `F:\one-binary-reasoning`
- **Active Working Branch:** `main`
- **HEAD Commit SHA:** `61bf3cb1f997ac22a7e44e4b6cbd416f30015054`
  - *Commit Message:* `docs: add project logo and update repository branding`
- **Initial Commit SHA:** `39017a9e5cc7422d60ddc796b22f95fcdf606c49`
- **Working Tree Status:** 100% Clean (`nothing to commit, working tree clean`).
- **Git Remotes:**
  - `origin`: `https://github.com/aayyaz3d-166/ONE-Binary-Reasoning-Intelligence.git` (fetch & push)
- **Local Branches:** `main` (active).
- **Available Git Tags:** None currently created.

### 2.2 Directory & Codebase Layout
- `src/binary/` (6 files): `binaryCodebook.ts`, `binaryDecoder.ts`, `binaryEncoder.ts`, `triangleMapper.ts`, `types.ts`, `index.ts`.
- `src/reasoning/` (6 files): `CandidateEvaluator.ts`, `ReasoningEngine.ts`, `RuleRegistry.ts`, `StateExplorer.ts`, `types.ts`, `index.ts`.
- `src/integration/` (3 files): `BinaryReasoningBridge.ts`, `ReasoningSession.ts`, `index.ts`.
- `src/shared/` (1 file): `address369.ts` (100% byte-for-byte identical to ONE Language canonical definition).
- `tests/` (4 test suites):
  - `tests/binary/binary_language.test.ts` (11 tests)
  - `tests/reasoning/reasoning_engine.test.ts` (5 suites)
  - `tests/integration/bridge_e2e.test.ts` (5 tests)
  - `tests/reasoning/reasoning_benchmark.ts` (7 deterministic benchmarks)
- `.github/workflows/ci.yml`: GitHub Actions CI running `npm run typecheck`, `npm test`, and `npm run test:benchmark`.

### 2.3 Dependencies & Toolchain Prerequisites
- **Node.js Runtime:** `v24.14.1` (x64) certified.
- **TypeScript:** `5.4.5` (via `devDependencies`).
- **Runtime Dependencies:** **ZERO** (relying solely on standard ECMAScript / Node.js primitives: `ArrayBuffer`, `DataView`, `TextEncoder`, `TextDecoder`, `performance.now()`).

---

## 3. Remote vs. Local Verification Boundary

| Item | Local Status | Remote GitHub Status | Audit Note |
| :--- | :--- | :--- | :--- |
| **Commit `fcce574` (ONE)** | Locally present & checked | Pushed to `origin` | Verified on active branch |
| **Commit `61bf3cb` (OBR)** | Locally present & checked | Matches `origin/main` | Clean working tree |
| **Tag `v1.0.1` (ONE)** | Points to `5f9dc99` | Present on remote | Commit `5f9dc99` is ancestor of `fcce574` |
| **Tag `v1.0.0` (ONE)** | Points to `2cf2553` | Present on remote | Immutable baseline release anchor |
| **Protected Binaries** | Verified in `dist/v1.0.1-rc/` | Not committed to Git | Stored in local distribution staging |
