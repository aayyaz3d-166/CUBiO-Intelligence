# ONE LANGUAGE — KNOWN ISSUES AND BLOCKERS RANKED BY SEVERITY

**Audit Scope:** Gates 10–26  
**Date:** 2026-10-11  

---

## Severity 1: Critical (Release Blockers)

1. **Clean-Environment Test Execution Failure (ESM Module Resolution)**
   - *Impact:* Automated test commands (`npx ts-node --transpile-only tests/...`) fail immediately with `ERR_MODULE_NOT_FOUND` under Node v24/v26 because `package.json` declares `"type": "module"` and imports omit `.ts` extensions.
   - *Action Needed:* Authorized update to test runner invocation (e.g. using a loader or script alias) to allow reproducible out-of-the-box test execution.

2. **Unverified Gates 11–25 in Pipeline**
   - *Impact:* Gates 11 through 25 have not been formally run or documented in dedicated audit suites.
   - *Action Needed:* Formally narrow the v1.0 release scope to exclude unimplemented research/UI features, or execute remaining gates.

3. **Pending Formal Scope Sign-Off**
   - *Impact:* v1.0 release cannot be tagged or published without explicit stakeholder approval of `V1_RELEASE_SCOPE.md`.

---

## Severity 2: High (Architectural Limitations)

1. **Single-Turn Limitation:**
   - The conversation engine processes each request in isolation. Multi-turn dialogue, pronoun resolution, and contextual follow-ups are not implemented.

2. **Explorer UI Integration Gap:**
   - The developer UI prototype in `src/one_net/ui/` is not connected to end-to-end integration tests and operates in standalone isolation.

---

## Severity 3: Medium (Documentation & Tooling)

1. **No Git Repository Initialized:**
   - The repository lacks `.git` metadata, preventing automated version tagging, branch verification, and diff-based release verification.
