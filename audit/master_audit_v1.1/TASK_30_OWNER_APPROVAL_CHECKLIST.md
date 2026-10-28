# Task 30 — Owner Approval Checklist & Release Decision Gate

> **Document:** `TASK_30_OWNER_APPROVAL_CHECKLIST.md`  
> **Mode:** Strict READ-ONLY Release Authorization Framework  
> **Gate Status:** **AWAITING EXPLICIT OWNER AUTHORIZATION**  
> **Timestamp:** 2026-10-28T13:00:00+05:00  

---

## 1. Owner Approval Framework

Before any publication action, Git tag creation, or distribution asset upload can be initiated in Task 30, the repository owner must review and explicitly approve each of the following release parameters:

### Item 1: Target Repositories & Release Versions
- [ ] **Repository A (`ONE language`):** Approve release version **`v1.0.1`**.
  - Local path: `F:\ONE language`
  - Remote: `https://github.com/aayyaz3d-166/ONE-language.git`
- [ ] **Repository B (`ONE Binary Reasoning Intelligence`):** Approve initial release version **`v1.0.0`**.
  - Local path: `F:\one-binary-reasoning`
  - Remote: `https://github.com/aayyaz3d-166/ONE-Binary-Reasoning-Intelligence.git`

---

### Item 2: Target Git Commit SHAs, Branches & Working Tree Strategy
- [ ] **Repository B Commit:** Approve commit [`61bf3cb1f997ac22a7e44e4b6cbd416f30015054`](file:///F:/one-binary-reasoning) on branch `main` (100% clean working tree).
- [ ] **Repository A Commit & Tree Strategy (Select Option A or Option B):**
  - **[ ] Option A (Release Frozen Candidate):** Authorize release of the pre-packaged artifacts in `dist/v1.0.1-rc/` which correspond directly to Git tree `fe3694f50e8f185d83f8e1d2cb152a55a347b281` (commit [`5f9dc99b9aa90f76edabbc21f4caa3a456a765c3`](file:///F:/ONE%20language), tagged `v1.0.1` on remote `new-origin`).
  - **[ ] Option B (Commit Updates First):** Stage and commit the recent documentation updates (`docs/ARCHITECTURE.md`, `docs/REPRODUCIBILITY.md`, `docs/MIGRATION.md`, `README.md`) and parity governance test (`tests/governance/task26...`) into a new commit on `integration/v1.0.1-local` before tagging and re-building.

---

### Item 3: Distribution Artifact Inventory & Cryptographic Checksums
- [ ] **`one.exe`** (`102,059,520 bytes`, Windows PE32+ standalone executable):
  ```
  SHA256: 479186CA87F55781825DF05F5603AC3747ADA4C2E9AA78DE9E3CD233A993020E
  ```
- [ ] **`one-language-1.0.1.vsix`** (`2,047,908 bytes`, VS Code extension package):
  ```
  SHA256: 33C8F6C59FD04ACAFC514D0D7BE4CC80ED397352348A7425FAFA349AC00C5B0D
  ```
- [ ] **`one-language-1.0.1-src.zip`** (`1,996,348 bytes`, 559 source files):
  ```
  SHA256: 925FB6CF562378AFB824FE6709740018C554238B069E5BEB5144260851846ED5
  ```

---

### Item 4: Release Notes & Compatibility Invariants
- [ ] **Release Notes:** Approve [`docs/RELEASE_NOTES_v1.0.1.md`](file:///F:/ONE%20language/docs/RELEASE_NOTES_v1.0.1.md) covering minimal command syntax (`one set`, `one make`, `one up/down`), fail-closed input handling (`E5012`), and IDE features.
- [ ] **Compatibility Guarantee:** Confirm 100% backward compatibility for canonical v1.0.0 programs and `.ox` binary container interoperability.
- [ ] **Permanent Safety Controls:** Confirm permanent enforcement of `ACTUATION_LOCK` (`E8005`), Address369 bounds (`[0..368]`, reserved `[369..511]` fail-closed rejection), and 512 MB physical RSS ceilings.

---

### Item 5: Release Coordination Model
- [ ] **Coordinated Dual-Repository Release:** Authorize concurrent release of `ONE language` v1.0.1 and `one-binary-reasoning` v1.0.0 with reciprocal documentation links and certified cross-repository parity.

---

### Item 6: Destination URLs & Rollback Procedures
- [ ] **Release Destination URLs:**
  - Primary: `https://github.com/aayyaz3d-166/ONE-language-/releases` (Tag: `v1.0.1`)
  - Companion: `https://github.com/aayyaz3d-166/ONE-Binary-Reasoning-Intelligence/releases` (Tag: `v1.0.0`)
- [ ] **Emergency Rollback Plan:**
  1. *De-publication:* Delete release tag `v1.0.1` via GitHub web console if production defects are detected.
  2. *Binary Fallback:* Fallback to preserved `v1.0.0` distribution binaries (`dist/one-language-1.0.0-src.zip`).
  3. *In-Process State Rollback:* Revert VM heap states using `TimeTravelStateManager.rollbackTo()`.
  4. *Git Working Copy Rollback:* `git checkout v1.0.0` restores the clean pre-release commit baseline.

---

## 2. Actionable Owner Response Instructions

To authorize release publication, reply with:

```text
APPROVED: Coordinated Release of ONE Language v1.0.1 and ONE Binary Reasoning Intelligence v1.0.0.
STRATEGY: [Select Option A (Release Frozen Candidate) OR Option B (Commit Updates First)]
```

If any parameter requires adjustment, specify the required change. Until explicit owner sign-off is received, Task 30 remains **BLOCKED**.
