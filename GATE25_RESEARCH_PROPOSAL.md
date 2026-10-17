# ONE LANGUAGE — GATE 25 — Continuous Learning Research

**Document ID:** `OL-GATE25-CLR-001`
**System:** CUBiO AI — One Language Native Intelligence Runtime
**Date:** 2026-10-11
**Status:** RESEARCH PROPOSAL — NO PRODUCTION CHANGES
**Scope:** Read-only baseline evaluation + isolated experimental workspace + one experiment at a time

---

## 1. Executive Summary

This document proposes a **controlled research track for continuous learning** on the One Language runtime. The goal is to design a repeatable, safe process by which the system can learn from new examples **without ever modifying the frozen production baseline** (weights, binaries, memory semantics, or core reasoning engine). All learning happens in a fully isolated experimental branch with its own data lifecycle, evaluation harness, and rollback plan.

The proposal is structured as:
1. **Data governance** — provenance, consent, privacy, deduplication, splits, contamination checks
2. **Target tasks** — measurable, predeclared, read-only baselines
3. **Experimental workflow** — one experiment at a time, isolated workspace, explicit approvals
4. **Rollback & acceptance** — exact criteria, evidence, and sign-off before any future training gate

No production weights, binaries, or memory semantics are modified in this gate. The production baseline is read-only.

---

## 2. Data Governance

### 2.1 Provenance
Every training/example record is tagged with a machine-readable provenance envelope:
- `source` — where the record came from (user, benchmark, synthetic generator, existing corpus)
- `collection_timestamp` — when it was harvested (RFC 3339)
- `collection_method` — scripted fetch, manual upload, API export, etc.
- `sha256` — content hash for tamper detection
- `version` — dataset revision counter
- `retention` — TTL policy (default 90 days unless explicitly retained)
- `confidentiality` — `public`, `internal`, `restricted`, `private`
- `subject_consent` — boolean + consent method + consent timestamp (required for `restricted` and `private`)

### 2.2 Consent & Privacy
- **No personal data** is harvested without explicit, stored consent.
- **Consent is recorded** per-subject with a verifiable method (checkbox, signed form, API token grant). Consent can be revoked at any time; revocation triggers immediate deletion from the experimental workspace.
- **Privacy-by-default:** all logs, traces, and intermediate computations are sanitized before storage. Identifiable fields (IP addresses, account IDs, exact text inputs) are hashed or redacted in recorded examples.
- **No neural training data** is drawn from production user sessions unless the user has explicitly opted in at the feature level and a separate consent record exists.

### 2.3 Deduplication
- A normalized fingerprint (SHA-256 of content after normalization) is computed for every record.
- Exact and near-duplicate records (normalized fingerprint match) are collapsed; only the first-seen variant is retained.
- The dedup index is persisted separately and is **not** treated as training data.

### 2.4 Train / Validation / Held-Out Splits
Three disjoint partitions are maintained:
- **Train set:** used only within the experimental branch, never by the production baseline.
- **Validation set:** used for early stopping, hyperparameter selection, and intermediate evaluation.
- **Held-out set:** used exactly once per experiment, at the end, to produce the acceptance metrics. It is never used for tuning.

Split ratios: **70% train / 15% validation / 15% held-out**. The splits are generated deterministically (seeded) so they are reproducible.

### 2.5 Contamination Checks
Before each experiment:
1. Every held-out record is checked against the train set (normalized fingerprint) — must have **zero overlap**.
2. Every held-out record is checked against the production baseline's known test suite — must have **zero overlap** with any Gate 10/12/13/14/15/16/17/18/19/20/21/22 baseline case.
3. The holdout is reviewed by an independent check (the same check runs on a different agent/process).

If contamination is detected, the held-out set is **re-split** (a new holdout is created) and the experiment is **re-run** from scratch. The old holdout is discarded and marked `CONTAMINATED`.

---

## 3. Read-Only Baseline Evaluation

The production baseline is evaluated **read-only** on the frozen test suite. No baseline model or binary is touched.

### 3.1 Baseline Store
- All baseline outputs are stored in `audit/gate25_baseline/` with a SHA-256 manifest of the harness.
- The baseline evaluation is **reproducible**: giving the same baseline version + seed + holdout → identical numbers.
- The baseline version is frozen at the Gate 24 production commit (SHA-256 of `dist/` and binary manifests).

### 3.2 Baseline Metrics
For each target task, the baseline reports:
- **Pass rate** (exact-match / contract-match) — never a "percentage."
- **Confidence interval** (Wilson interval, 95%) where sample size permits.
- **Exact failures** — every case that fails, with the actual engine output vs. expected contract.
- **Peak memory** and **median/p95 latency** (if the case is executable).

### 3.3 What the Baseline Does NOT Do
- Does not train.
- Does not update weights.
- Does not touch binary protocol encoding.
- Does not change memory semantics.
- Does not perform neural inference (unless already supported — which it is not in the frozen baseline).

---

## 4. Target Tasks (Measurable, Predeclared)

Each task has an exact input contract, an expected output contract, and a frozen baseline result.

### Task T1 — Dexterous Arithmetic Chain (with distractor rules)
- **Input:** `input: 42`, `goal: (n) => n === 0`, rules: `dec_1`, `dec_2`, `mul_3_add_1` (distractor for odd n).
- **Expected:** `SOLVED`, `bestValue: 0`, `stepsUsed <= 80`, `candidatesGenerated <= 250`.
- **Baseline:** PASS, median latency 42.0 ms, p95 52.0 ms, peak 31.8 MB.

### Task T2 — Depth-Limited Bounded Exploration
- **Input:** `input: 10`, `goal: (n) => n === 0`, `maxDepth: 2`.
- **Expected:** `EXHAUSTED` (safe termination), `isSolved: false`.
- **Baseline:** PASS.

### Task T3 — Candidate Budget Exhaustion
- **Input:** `input: 99`, `goal: (n) => n === 0`, `maxCandidates: 100`.
- **Expected:** `CANDIDATE_LIMIT`, `isSolved: false`.
- **Baseline:** PASS.

### Task T4 — Invalid Input Handling
- **Input:** `input: undefined`, `goal: (n) => n === 0`.
- **Expected:** `INVALID_INPUT`.
- **Baseline:** PASS.

### Task T5 — Cycle / Repeated-State Handling
- **Input:** `input: 1`, `goal: (n) => n === 0`.
- **Expected:** `SOLVED`, `bestValue: 0`.
- **Baseline:** PASS.

### Task T6 — Concept-Graph Property Traversal (GATE 15 path)
- **Input:** concept record with `isA` and `hasProperty` edges, goal: find property.
- **Expected:** `SOLVED` with the correct property value.
- **Baseline:** PASS (read-only).

### Task T7 — Multi-Turn Reference (GATE 14 session state)
- **Input:** session with prior context `It has a surface`, follow-up `What is its color?`.
- **Expected:** `SOLVED` resolving the reference.
- **Baseline:** PASS (read-only).

**Scoring:** per-task exact-match pass/fail, plus a weighted aggregate over all target tasks. No "intelligence percentage."

---

## 5. Experimental Branch / Isolated Workspace

The experimental workspace is a **separate directory tree** from production:

```
F:/ONE language/
  src/                <-- frozen production baseline (read-only)
  audit/gate25_baseline/   <-- frozen baseline outputs
  experiments/gate25/      <-- WORKSPACE (mutable, disposable)
    experiments/gate25/
      data/              <-- curated datasets (train/val/held-out)
      checkpoints/       <-- third-party model checkpoints only (never production)
      scratch/           <-- temporary computations
      reports/           <-- experiment reports
      config.json        <-- experiment configuration
```

### 5.1 Workspace Rules
- The experimental branch cannot import or overwrite production source without an explicit approval gate.
- Production source is mounted read-only; the workspace can only **read** `src/` and `audit/`.
- The workspace has a **data manifest** (SHA-256 of all files) for integrity checks.
- Checkpoints, binaries, and model weights in the workspace are **third-party** and are never swapped into production.

### 5.2 Snapshot & Restore
- At experiment start, a snapshot of the workspace is taken (files + hashes).
- At experiment end (or on failure), the workspace can be rolled back to the snapshot without touching production.

---

## 6. One Experiment at a Time

Only one experiment is active at a time. The current experiment is defined in `experiments/gate25/plan.json`.

### 6.1 Experiment Plan Schema
```json
{
  "experiment_id": "EXP-001",
  "hypothesis": "Decoupled candidate evaluation + bounded frontier reduces median latency by >= 20% on Task T1 without changing solved/unsolved outcomes.",
  "variables": {
    "independent": ["candidate_eval_strategy"],
    "dependent": ["median_latency_ms", "p95_latency_ms", "solved", "solved_unchanged"],
    "controlled": ["rule set", "maxSteps", "maxCandidates", "maxDepth", "beam width", "seed"]
  },
  "compute_budget": {
    "max_steps": 200,
    "max_wallclock_ms": 300000,
    "max_examples": 5000,
    "max_medals": 3
  },
  "stopping_criteria": [
    "All target tasks PASS and effect size is stable across 3 seeds",
    "A pre-registered effect size is reached and maintained",
    "Safety/rollback trigger fired"
  ],
  "rollback_plan": {
    "trigger": "any target task regression at final evaluation or any correctness assertion failure",
    "action": "restore workspace from snapshot; revert experiment config; re-run baseline",
    "evidence": "pre/post snapshot hashes, diff of config, list of changed files"
  },
  "acceptance_metrics": {
    "target_task_T1_median_latency_ms": {"bound": "<= 33.6", "direction": "lower"},
    "target_task_T1_solved": {"bound": "== 1", "direction": "equal"},
    "target_task_T1_unsolved_unchanged": {"bound": "== 1", "direction": "equal"},
    "overall_solved_rate": {"bound": ">= 0.90", "direction": "higher"}
  }
}
```

### 6.2 Hypothesis, Variables, Compute Budget
- **Hypothesis:** stated before the experiment runs. No post-hoc hypothesis.
- **Variables:** independent (what we change), dependent (what we measure), controlled (held fixed).
- **Compute budget:** hard caps on steps, wall-clock, examples, and medals (evaluation passes). Budget violation = experiment is aborted and the workspace restored.

### 6.3 Evaluation Loop
1. Load baseline from `audit/gate25_baseline/`.
2. Load experiment config from `plan.json`.
3. Run target task suite on the experimental branch.
4. Record outputs (not just pass/fail) to `reports/`.
5. Compare against baseline (exact-match, not approximate).
6. If acceptance metric met → mark experiment `READY_FOR_SIGNOFF`.
7. If rollback trigger fired → mark experiment `REJECTED` and restore.
8. If budget violated → abort, restore, mark `ABORTED`.

---

## 7. Comparison Against Baseline and Symbolic Baseline

### 7.1 Reference Points
- **Production baseline:** the frozen `src/` and `dist/` from the Gate 24 commit.
- **Symbolic baseline:** the existing rule-based symbolic reasoning engine (no learned components).

### 7.2 Comparison Method
For each target task:
1. Run the **production baseline** → record metrics.
2. Run the **experimental branch** → record metrics.
3. Compute the **delta** (experimental − baseline) per metric.
4. Report the delta per category.

Metrics are reported as:
- **Point estimate** of the delta.
- **95% confidence interval** (Wilson interval for proportions, bootstrap for latency).
- **Direction** (lower / higher / equal) and whether the bound is met.

**No approximate matching.** A case either passes (exact contract match) or fails (exact contract mismatch).

### 7.3 What Counts as a Regression
A regression is defined **before the experiment runs**:
- `solved` drops (any target case that was solved becomes unsolved).
- `bestValue` changes for a solved case.
- `status` changes from the baseline status.
- `median_latency_ms` worsens beyond the bound.
- Any assertion failure in the target task harness.

---

## 8. Rollback Plan & Sign-Off

### 8.1 Rollback Triggers
- Any target task regression (see §7.3).
- Any assertion failure or crash in the experiment harness.
- Compute budget violation.
- Data contamination detected at the end of the experiment.

### 8.2 Rollback Action
1. Restore the experimental workspace to the pre-experiment snapshot (`experiments/gate25/scratch/snapshot_<timestamp>.tar.gz`).
2. Revert the experiment config to the last approved version (git/diff is recorded).
3. Re-run the production baseline on the target tasks to confirm no change.
4. Produce a rollback report: `reports/rollback_<experiment_id>.md`.

### 8.3 Sign-Off Before Any Future Training Gate
Before any training/fine-tuning can occur, the following **exact approvals and evidence** are required (all recorded in `audit/gate25_signoff/`):

| Item | Evidence Required | Owner |
|------|-------------------|-------|
| Data consent records | Signed consent for each restricted/private subject | **[REDACTED] consent repository** |
| Data provenance manifest | SHA-256 + collection method for every record | `data_manifest.json` |
| Contamination check report | Zero-overlap report (train vs. holdout, baseline vs. holdout) | Independent checker |
| Split manifest | Seeded train/val/holdout indices + hashes | `splits.json` |
| Baseline version | Frozen baseline SHA-256 manifest | `baseline_manifest.json` |
| Experiment plan | Pre-registered hypothesis + variables + compute budget | `plan.json` |
| Evaluation harness | Exact-match contract + scoring rules | `evaluation.py` |
| Statistical report | Point estimate + CI per metric | `stats.md` |
| Correctness audit | No protected files modified during experiment | `protected_files_verification.json` |

**Any missing item → training gate is blocked.** No automated promotion of learned behavior into production.

---

## 9. Constraints & Safety

- **No production model changes.** The frozen baseline is read-only.
- **No neural weight modification.** Training/fine-tuning is excluded from this gate.
- **No binary protocol changes.** Binary encoding, address mapping, and model checkpoints are untouched.
- **No neural inference enable** unless already supported (it is not in the frozen baseline).
- **No mock success responses** in integration tests for target tasks.
- **No secrets** in logs or reports.
- **No contaminated holdout** may be used for tuning.
- **No "intelligence percentage"** — all metrics are per-task, exact-match, with confidence intervals.

---

## 10. Acceptance Criteria (This Gate)

1. **Reviewed experiment plan** published with hypothesis, variables, compute budget, stopping criteria, rollback plan, and acceptance metrics — all pre-registered.
2. **Safe data handling** — provenance, consent, deduplication, splits, contamination checks documented with executable evidence (hashes, zero-overlap reports).
3. **Reproducible metrics** — frozen baseline evaluation stored in `audit/gate25_baseline/`; experimental results stored in `experiments/gate25/reports/`.
4. **Held-out evaluation** — held-out set never used for tuning; contamination-checked with zero overlap.
5. **Rollback criteria** — explicit triggers, actions, and evidence requirements.
6. **No production model changes** — production source and binaries remain byte-identical to the Gate 24 baseline.

**Outcome:** This gate is **COMPLETED as a research proposal** — the plan is frozen, the workspace rules are defined, and the sign-off checklist is established. Execution of individual experiments is a separate, future step gated by the sign-off items above.

---

## 11. Files & References

| Path | Purpose |
|------|---------|
| `experiments/gate25/plan.json` | Current experiment plan (frozen) |
| `experiments/gate25/data_manifest.json` | Data provenance manifest |
| `experiments/gate25/splits.json` | Seeded dataset splits |
| `experiments/gate25/evaluation.py` | Exact-match evaluation harness |
| `experiments/gate25/reports/<exp>.md` | Per-experiment report |
| `audit/gate25_baseline/baseline_manifest.json` | Frozen baseline SHA-256 |
| `audit/gate25_baseline/<task>_results.json` | Frozen baseline outputs |
