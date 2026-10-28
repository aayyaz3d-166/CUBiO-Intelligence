# ONE LANGUAGE — V1.0 RELEASE SCOPE DEFINITION

**Document ID:** `GATE-26-V1-RELEASE-SCOPE`  
**Date:** 2026-10-11  
**Authoritative Repository:** `F:\ONE language`  
**Status:** PROPOSED FOR REVIEW & FORMAL APPROVAL  

---

## 1. Capability Breakdown & Classification

Every capability in the ONE LANGUAGE repository is evaluated against verified source code and reproducible test evidence:

| # | Capability Area | Specific Feature | Classification | Justification & Evidence |
|---|---|---|---|---|
| 1 | Binary Protocol | Binary Encoding & Decoding | **SUPPORTED** | `src/binary/binaryEncoder.ts`, `binaryDecoder.ts`, `binaryCodebook.ts`. Bit-level protocol compliant with frozen specifications. |
| 2 | Spatial Mapping | 369-Address Spatial Grid bijection | **SUPPORTED** | `src/one/address369_canonical.ts`, `src/one/spatial/OneAddress369.ts`. 343 spatial cells (0,0,0 to 6,6,6) bijectively mapped to addresses 26..368. |
| 3 | Spatial VM | SpatialBridge actuation lock & GridMemory | **SUPPORTED** | `src/one/spatial/SpatialBridge.ts`, `src/vm/gridMemory.ts`. Fail-closed write actuation lock verified. |
| 4 | Symbolic Reasoning | Bounded rule search & state exploration | **SUPPORTED** | `src/one/intelligence/reasoning/`. Deterministic BFS, cycle detection, strict step budget enforcement. |
| 5 | Concept Graph | Knowledge graph upsert & relationship traversal | **SUPPORTED** | `src/one/intelligence/memory/ConceptGraph.ts`. Multi-hop property inheritance and safe pairwise validation. |
| 6 | Conversational Interface | Single-turn pattern parsing & symbolic routing | **LIMITED** | `src/one/intelligence/hybrid/IntentParser.ts`, `HybridConversationEngine.ts`. Single-turn only; no multi-turn context retention across requests. |
| 7 | Reasoning Traces | Structured derivation replay & export | **NOT IMPLEMENTED** | Gate 13 not executed. Candidates are logged in `derivation` snapshots but replayable execution trace API is not finalized. |
| 8 | Multi-Turn Dialogue Memory | Session-scoped entity references & follow-ups | **NOT IMPLEMENTED** | Gate 14 not executed. No session state carried across requests. |
| 9 | Neural-Symbolic Reasoning | Language model guided symbolic execution | **NOT IMPLEMENTED** | Gate 16 not executed. Model adapter vocabulary (369 spatial tokens) or Native 5M bounded text operates as wording only, not reasoning. |
| 10 | Explorer Developer UI | Web-based inspector console & graph viewer | **EXPERIMENTAL / UNVERIFIED** | Gate 18/19 not executed. Prototype exists in `src/one_net/ui/` but is not wired into the release pipeline or E2E tested. |
| 11 | Developer SDK & Public API | Stable typed client library and public endpoints | **NOT IMPLEMENTED** | Gate 23 not executed. No standalone SDK package published. |
| 12 | Continuous Learning | Online adaptation & feedback loop | **NOT IMPLEMENTED** | Gate 25 not executed. Production weights are frozen; continuous training is strictly prohibited. |

---

## 2. In-Scope for Proposed v1.0 Release

1. Core Binary Language v1.0 codec (`src/binary/`).
2. Canonical 369 Spatial Addressing & VM Bridge (`src/one/address369_canonical.ts`, `src/one/spatial/`).
3. Core Symbolic Reasoning Engine (`src/one/intelligence/reasoning/`).
4. Selective Memory & ConceptGraph (`src/one/intelligence/memory/`).
5. Bounded Hybrid Conversation Router (Single-Turn) (`src/one/intelligence/hybrid/`).

---

## 3. Explicitly Excluded from v1.0 Scope

- Multi-turn conversational dialogue memory (Deferred to v1.1).
- Explainable reasoning trace replays (Deferred to v1.1).
- Interactive Explorer UI & REST API (Deferred to v1.2).
- Public Developer SDK (Deferred to v1.2).
- Neural training or open-domain language generation (Out of scope).

---

## 4. Required Approvals

Before any public release candidate can be packaged or distributed, explicit user authorization is required for:
1. Formal acceptance of this scope definition.
2. Authorization of a runner fix for the ESM module resolution issue in clean environments.
