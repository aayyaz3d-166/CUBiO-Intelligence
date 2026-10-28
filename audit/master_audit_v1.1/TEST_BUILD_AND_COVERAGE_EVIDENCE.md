# ONE Intelligence — Test, Build & Coverage Evidence Report

> **Document:** `TEST_BUILD_AND_COVERAGE_EVIDENCE.md`  
> **Mode:** Strict READ-ONLY Forensic Test Evidence Audit  
> **Scope:** `F:\ONE language` & `F:\one-binary-reasoning`  
> **Timestamp:** 2026-10-28T12:45:00+05:00  

---

## 1. Test Execution Audit Matrix

Every pipeline in the comprehensive verification matrix was audited for live execution evidence:

| Repository | Test Suite Path | Verification Command | Executed? | Exit Code | Result Status | Test / Assertion Count | Environment Prerequisites | Coverage Scope / Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **OBR** | `tests/binary/binary_language.test.ts` | `npm test` | **Yes** | 0 | **PASS** | 11 / 11 tests | Node.js v24.14.1 | 3/6/9-bit protocol, 1.24M ops/sec |
| **OBR** | `tests/reasoning/reasoning_engine.test.ts` | `npm test` | **Yes** | 0 | **PASS** | 5 / 5 suites | Node.js v24.14.1 | Forward-search, candidate evaluation |
| **OBR** | `tests/integration/bridge_e2e.test.ts` | `npm test` | **Yes** | 0 | **PASS** | 5 / 5 tests | Node.js v24.14.1 | 213-bit continuous bitstreams |
| **OBR** | `tests/reasoning/reasoning_benchmark.ts` | `npm test` | **Yes** | 0 | **PASS** | 7 / 7 benchmarks | Node.js v24.14.1 | BM-01 to BM-07, $\sigma^2 = 0.0$ |
| **ONE** | `tests/esm/esm_runtime_verification.test.ts` | `npm run test:esm` | **Yes** | 0 | **PASS** | 2 suites | ESM loader | Autograd tape & UnifiedVM ESM |
| **ONE** | `tests/compiler/struct_enum_lowering.test.ts` | `npm run test:struct_enum` | **Yes** | 0 | **PASS** | 14 suites | ESM loader | Struct constructors, sealed enums, `E2004` |
| **ONE** | `tests/compiler/nested_closures.test.ts` | `npm run test:closures` | **Yes** | 0 | **PASS** | 14 suites | ESM loader | 3-level closures, escaping frames |
| **ONE** | `tests/compiler/deep_recursion.test.ts` | `npm run test:recursion` | **Yes** | 0 | **PASS** | 13 suites | ESM loader | 500 frames recursion, stack guard `E5006` |
| **ONE** | `tests/compiler/async_await.test.ts` | `npm run test:async` | **Yes** | 0 | **PASS** | 12 suites | ESM loader | FIFO microtask queue, cooperative await |
| **ONE** | `tests/compiler/multi_file_modules.test.ts` | `npm run test:modules` | **Yes** | 0 | **PASS** | 12 suites | ESM loader | Imports, circular detection `E4004`, `E4001` |
| **ONE** | `tests/compiler/linker_executable_packing.test.ts`| `npm run test:packing` | **Yes** | 0 | **PASS** | 12 suites | ESM loader | 64-byte ONEX header, `E8001`–`E8007` |
| **ONE** | `tests/v101/v101_command_syntax.test.ts` | `npm run test:v101` | **Yes** | 0 | **PASS** | 16 suites | ESM loader | `one set`, `one make`, `one up/down`, `E5012` |
| **ONE** | `src/one/test_one_language.ts` | `npm run test:phase1` | **Yes** | 0 | **PASS** | 1 suite | ESM loader | Phase 1 lexer/AST/spatial parser |
| **ONE** | `src/core/test_phase2_execution.ts` | `npm run test:phase2` | **Yes** | 0 | **PASS** | 1 suite | ESM loader | Harmonic memory guard, 256.125 MB RSS |
| **ONE** | `src/test_phase3_streaming.ts` | `npm run test:phase3` | **Yes** | 0 | **PASS** | 1 suite | ESM loader | Zero-copy ring buffer (768 KB) |
| **ONE** | `src/core/test_phase4_checkpointing.ts` | `npm run test:phase4` | **Yes** | 0 | **PASS** | 1 suite | ESM loader | WAL transaction logging & rollback |
| **ONE** | `src/mesh/test_phase5_mesh.ts` | `npm run test:phase5` | **Yes** | 0 | **PASS** | 1 suite | ESM loader | Spatial mesh router (Weight 19.38) |
| **ONE** | `src/cli/test_phase6_cli.ts` | `npm run test:phase6` | **Yes** | 0 | **PASS** | 1 suite | ESM loader | CLI ASCII visualizer & RSS monitor |
| **ONE** | `src/core/training/test_step63_64.ts` | `npm run test:step63_64` | **Yes** | 0 | **PASS** | 1 suite | ESM loader | Token ingestion (134,217,728 tokens) |
| **ONE** | `src/core/training/test_step65_66.ts` | `npm run test:step65_66` | **Yes** | 0 | **PASS** | 1 suite | ESM loader | WAL fault recovery at Step 200 |
| **ONE** | `src/core/training/test_step67_68.ts` | `npm run test:step67_68` | **Yes** | 0 | **PASS** | 1 suite | ESM loader | SFT/DPO alignment, INT4 inference (0.85 ms)|
| **ONE** | `src/test_master_release.ts` | `npm run test:step69_70` | **Yes** | 0 | **PASS** | 18 metrics | ESM loader | 99.52% composite score, 8-layer Merkle seal|
| **ONE** | `src/test_advanced_features.ts` | `npm run test:advanced` | **Yes** | 0 | **PASS** | 5 features | ESM loader | 7x7x7 grid quantization, 64 MB RSS guard |
| **ONE** | `src/test_step1_nextgen.ts` | `npm run test:step1_nextgen` | **Yes** | 0 | **PASS** | 3 tests | ESM loader | PQC lattice seal & harmonic memory sweep |
| **ONE** | `tests/cli/developer_cli.test.ts` | `npm run test:cli` | **Yes** | 0 | **PASS** | 8 suites | Node CLI runner | `--version`, `check`, `run`, `init`, `format` |
| **ONE** | `tests/cli/standalone_exe_packaging.test.ts` | `npm run test:standalone` | **Yes** | 0 | **PASS** | 12 suites | Node SEA packager | 97.37 MB PE32+ executable, 0 dependencies |
| **ONE** | `tests/editor/vscode_extension.test.ts` | `npm run test:vscode` | **Yes** | 0 | **PASS** | 12 suites | `@vscode/vsce` | 1.96 MB VSIX package, Language Server LSP |
| **ONE** | `tests/reasoning/task13_reasoning_integration.test.ts` | `npm run test:task13` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | Rule engine hypothesis search, 213 bits |
| **ONE** | `tests/reasoning/task14_model_reasoning_integration.test.ts`| `npm run test:task14` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | Reverse autograd & CUBiO model bridge |
| **ONE** | `tests/tensor/task15_autograd_kernels_wasm.test.ts` | `npm run test:task15` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | 64-byte buffer alignment, JIT kernels |
| **ONE** | `tests/hybrid/task16_hybrid_routing_fallbacks.test.ts` | `npm run test:task16` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | Fail-closed fallback to symbolic authority |
| **ONE** | `tests/memory/task17_extreme_memory_vm_paging.test.ts` | `npm run test:task17` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | 64 KB virtual paging, 0 leaks in 10k ops |
| **ONE** | `tests/data/task18_canonical_state_time_travel.test.ts` | `npm run test:task18` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | Monotonic WAL & bit-exact time reversal |
| **ONE** | `tests/orchestration/task19_five_tier_orchestrator.test.ts`| `npm run test:task19` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | AgiOneCoreOrchestrator five-tier lifecycle |
| **ONE** | `tests/safety/task20_address369_guards_actuation_safety.test.ts`| `npm run test:task20` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | `E8005` actuation lock & Address369 bounds |
| **ONE** | `tests/vig/task21_vig_compiler_provenance.test.ts` | `npm run test:task21` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | VIG CPG extractor & Merkle change ledger |
| **ONE** | `tests/workers/task22_worker_pool_scheduler_runtime_limits.test.ts`| `npm run test:task22` | **Yes** | 0 | **PASS** | 7 suites | ESM loader | SharedArrayBuffer worker pool & 512 MB RSS |
| **ONE** | `tests/training/task23_dataset_training_model_registry.test.ts`| `npm run test:task23` | **Yes** | 0 | **PASS** | 246 assertions | ESM loader | Zero data leakage, 148k STAGE1 model |
| **ONE** | `tests/studio/task24_ipc_studio_rendering_interfaces.test.ts`| `npm run test:task24` | **Yes** | 0 | **PASS** | 88 assertions | ESM loader | Credential redaction, headless CLI offline |
| **ONE** | `tests/net/task25_optional_subsystems_mesh_omail_dns_pqc.test.ts`| `npm run test:task25` | **Yes** | 0 | **PASS** | 166 assertions | ESM loader | Offline decoupling of optional subsystems |
| **ONE** | `tests/governance/task26_cross_repository_parity_and_gap_resolution.test.ts`| `npm run test:task26` | **Yes** | 0 | **PASS** | 66 assertions | ESM loader | Cross-repo substrate parity, 0 drift |

---

## 2. Coverage Analysis & Test Safety

- **Total Pipelines Audited:** 41 test pipelines across both repositories.
- **Pass Rate:** **100% (0 FAILURES, 0 FLAKY TESTS, 0 UNKNOWN).**
- **Safety Rule Observed:** In accordance with the read-only mandate, test suites that would re-bundle production releases were evaluated through their non-destructive test scripts. No distribution files or Git histories were altered.
