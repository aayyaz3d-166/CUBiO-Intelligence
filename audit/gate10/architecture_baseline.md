# ONE LANGUAGE — GATE 10: ARCHITECTURE BASELINE DOCUMENT

This document records the frozen architecture boundaries based on actual source code inspection.

### Phase 1 — Spatial Bridge & Address Mapping
- **GridMemory:** 7×7×7 = 343 cells — `IMPLEMENTED`, `TESTED`
- **OneAddress369 mapping:** `IMPLEMENTED`, `TESTED`
- **Locked write behavior:** `IMPLEMENTED`, `TESTED` (fail-closed, reads allowed, writes denied)

### Phase 2 — Binary Language Protocol
- **3/6/9-bit protocol:** `IMPLEMENTED`, `TESTED`
- **Opcode mapping:** `IMPLEMENTED`, `TESTED`
- **MSB-first behavior:** `IMPLEMENTED`, `TESTED`
- **9-bit address range:** `IMPLEMENTED`, `TESTED`
- **Reserved addresses 369–511:** `IMPLEMENTED`, `TESTED` (documented fail-closed handling)

### Phase 3 — Symbolic Reasoning
- **Rule-based reasoning:** `IMPLEMENTED`, `TESTED`
- **State exploration:** `IMPLEMENTED`, `TESTED`
- **Candidate evaluation:** `IMPLEMENTED`, `TESTED`
- **Search budgets:** `IMPLEMENTED`, `TESTED`
- **Cycle detection:** `IMPLEMENTED`, `TESTED`
- **Termination states:** `IMPLEMENTED`, `TESTED`

### Phase 4 — Memory
- **Working memory:** `IMPLEMENTED`, `TESTED`
- **Episodic memory:** `IMPLEMENTED`, `TESTED`
- **Semantic memory:** `IMPLEMENTED`, `TESTED`
- **Procedural memory:** `IMPLEMENTED`, `TESTED`
- **Retention policies:** `IMPLEMENTED`, `TESTED`
- **Validated promotion:** `IMPLEMENTED`, `TESTED`

### Phase 5 — Hybrid Conversation Engine
- **Intent parsing:** `IMPLEMENTED`, `TESTED`
- **Hybrid dispatch:** `IMPLEMENTED`, `TESTED`
- **Concept lookup:** `IMPLEMENTED`, `TESTED`
- **Symbolic result validation:** `IMPLEMENTED`, `TESTED`
- **Conversational fallback:** `IMPLEMENTED`, `TESTED`

### Neural Model
- **Trained model location:** `E:\3D memory studio\data\checkpoints\one_lm_v1\one_lm_best.cubiomodel` — `IMPLEMENTED`, `TESTED`
- **Adapter availability:** `IMPLEMENTED`
- **Inference status:** `NOT_IMPLEMENTED` (uses 369 spatial tokens, not natural language)
- **Known limitations:** documented in `F:\ONE language\audit\gate10\known_limitations.md`

### Neural Inference Status
- **Opt-in only:** all response paths default to symbolic/deterministic
- Neural inference not enabled in read-only test configuration
