# ONE LANGUAGE — KNOWN LIMITATIONS (v1.0 CANDIDATE)

**Document ID:** `GATE-26-KNOWN-LIMITATIONS`  
**Date:** 2026-10-11  

---

## 1. Environmental & Runner Limitations

1. **Native ESM Module Resolution in Node v24/v26:**
   - `package.json` specifies `"type": "module"`. Under current Node.js ESM specifications, extensionless imports (e.g. `import ... from './file'`) fail with `ERR_MODULE_NOT_FOUND`.
   - The test suites require a loader flag or configuration adjustment to execute out-of-the-box in clean modern Node.js environments.

## 2. Architectural & Functional Limitations

1. **Single-Turn Request-Response Model:**
   - The conversational engine does not maintain session-scoped dialogue history across multiple turns. Follow-up queries (e.g. "tell me more about it") are not resolved.
2. **Search Optimization Bounds:**
   - The symbolic reasoning engine relies on bounded Breadth-First Search (BFS). While goal-directed pruning prevents budget exhaustion for simple arithmetic chains, complex heuristic search (Gate 12) is not implemented.
3. **Language Generation Vocabulary:**
   - Spatial token vocabulary model (CUBIO-MODEL-STAGE1-V1) cannot generate natural English. Natural language conversational output is handled via Native 5M-v2 adapter (bounded to 45 tokens) or fallback templates.
4. **Developer UI / Explorer Prototype:**
   - The Explorer UI in `src/one_net/ui/` is not connected to end-to-end integration tests and is excluded from the v1.0 release scope.
5. **No Claims of General Intelligence:**
   - Passing tests verify specific deterministic and bounded capabilities only. The system does not exhibit open-domain reasoning or unconstrained generalization.
