# ONE LANGUAGE v1.0.0-rc1 RELEASE NOTES

**Release Target:** `v1.0.0-rc1`  
**Date:** 2026-10-11  

---

## What's Included

### 1. Binary Language Protocol v1.0
- Complete deterministic bit-level encoder and decoder (`src/binary/`).
- Verified 369-symbol codebook with collision-free encoding.

### 2. Spatial Architecture & 369 Addressing
- Canonical 343-cell 3D spatial grid mapping (`0,0,0` to `6,6,6`).
- Full round-trip bijection between spatial indices and canonical addresses.
- `SpatialBridge` with fail-closed actuation locks protecting grid memory state.

### 3. Symbolic Reasoning Engine
- Breadth-first rule-based state explorer.
- Strict step budget, candidate budget, and recursion depth limits.
- Bounded pruning for arithmetic decrement and increment tasks.

### 4. Semantic Memory & ConceptGraph
- Knowledge graph storage for concepts, properties, and relationships.
- Multi-hop relationship inheritance traversal up to depth 3.
- Fail-safe pairwise concept relationship verification.

### 5. Hybrid Conversational Interface
- Single-turn intent parsing for arithmetic tasks, concept queries, greetings, and acknowledgments.
- Safe integration adapter for Native 5M-v2 language model (bounded output ≤ 45 tokens).
- Deterministic fallback text generation when neural inference is disabled or unavailable.
