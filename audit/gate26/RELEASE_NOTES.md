# ONE LANGUAGE — RELEASE NOTES

**Gate ID:** `GATE-26-ONE-LANGUAGE-V1-RELEASE`  
**Date:** 2026-10-11  
**Repository:** `F:\ONE language`  
**Version:** 1.0.0  
**Status:** PROVISIONAL — released for review, not for public distribution

---

## 1. Overview

- **Release:** GATE 26 — v1.0 release qualification gate.
- **Release date:** 2026-10-11.
- **Version string:** `one-language-core@1.0.0` (package.json).
- **Release candidate status:** PROVISIONAL (no public distribution).

---

## 2. Scope

The v1.0 scope is provisional. The following capabilities are included:

| Capability | Status |
|------------|--------|
| Binary encoding and decoding | SUPPORTED |
| 369-address spatial mapping and grid operations | SUPPORTED |
| Bounded symbolic reasoning | SUPPORTED |
| Concept graph queries | SUPPORTED |
| Conversation parsing and fallback | LIMITED (single-request, no multi-turn) |

Not included in v1.0:

- Reasoning traces (NOT IMPLEMENTED)
- Dialogue memory (NOT IMPLEMENTED)
- Neural integration (NOT IMPLEMENTED — blocked)
- Explorer UI (EXPERIMENTAL / PARTIALLY IMPLEMENTED)
- API (EXPERIMENTAL / PARTIALLY IMPLEMENTED)
- Gates 12–25 (NOT STARTED / NOT RUN)

---

## 3. Changes in This Release

| Change | Status | Notes |
|--------|--------|-------|
| Gate 10 baseline | Verified | 178/178 assertions pass, hashes match |
| Gate 9 verification | Verified | 98/98 assertions pass, parse-only gains confirmed |
| Module resolution | BLOCKED | Directory imports not supported by Node 26 ESM; test command not reproducible |
| Explorer UI | BLOCKED | E2E test suite blocked by spawn-path issue |
| Gates 12–25 | BLOCKED | No reports exist; not run |

---

## 4. Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Module resolution (directory imports) | High | All test commands fail with ERR_MODULE_NOT_FOUND; test counts cannot be reproduced |
| Explorer UI E2E | High | tests/ui/explorer_ui.test.ts spawn references git-bash; not executable in current environment |
| Gates 12–25 | High | No reports exist; release decision BLOCKED pending data |
| Master gate10_gate26 | High | audit/master_gate10_gate26/ does not exist |

---

## 5. Distribution

- No public distribution has occurred. No public GitHub release, no tag push, no upload.
- The release candidate is not a v1.0 artifact (scope provisional, Gates 12–25 unavailable).
- No model weights, datasets, or checkpoints are distributed.
- MIT license for source; RESTRICTIONS.md for redistribution terms.

---

## 6. Legal and Licensing

- **Source:** MIT license (src/one_net/ui/ and its tests).
- **Redistribution:** RESTRICTIONS.md — no model weights, no datasets, no checkpoints in this release.
- **No training:** No model trained, fine-tuned, or converted.

---

## 7. Contact

For questions about this release, refer to the Gate 26 deliverables in `audit/gate26/`:

- `GATE26_RELEASE_QUALIFICATION_REPORT.md`
- `V1_RELEASE_SCOPE.md`
- `GATE_DEPENDENCY_MATRIX.csv`
- `RELEASE_TEST_RESULTS.json`
- `RELEASE_INTEGRITY_MANIFEST.json`
- `SECURITY_AND_RELIABILITY_REPORT.md`
- `KNOWN_LIMITATIONS.md`
- `INSTALLATION_AND_RUN.md`
- `RELEASE_NOTES.md`
- `RELEASE_DECISION.md`

---

## 8. Changelog

- **2026-10-11** — GATE 26 release qualification. Created 10 deliverables in audit/gate26/. Scope provisional; Gates 12–25 not run; test command not reproducible.
