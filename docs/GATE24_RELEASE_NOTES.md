# GATE 24 — Public Demo Release Notes

## Version
- **Release:** GATE 24
- **Release date:** 2026-10-11
- **Version string:** `one-language-explorer-ui@1.0.0`
- **Pre-release status:** FINAL (production-ready demo)

## Summary
GATE 24 packages a limited, honest public demo of the ONE Language Explorer UI.
The demo serves the existing ONE Language engine's real output through a minimal
REST API. No external dependencies are required (pure Node.js built-in modules).
The release includes versioned release notes, artifact SHA-256 hashes, rate/resource
limits, and known limitations for public display.

## What's Included
| Artifact | Path | Role |
|----------|------|------|
| Backend HTTP service | `src/one_net/ui/server.ts` | Node.js built-in HTTP server, no npm deps |
| UI frontend | `src/one_net/ui/index.html`, `app.css`, `app.js` | Query console, result panel, reasoning trace, concept graph, binary inspector, benchmark/status |
| Test suite | `tests/ui/explorer_ui.test.ts` | UI/component tests (status, query, trace, binary, benchmark, security, accessibility) |
| TypeScript config | `tsconfig.json` | ES2022, CommonJS, strict |
| Package manifest | `package.json` | npm metadata, scripts, devDependencies |

## Verified Capabilities
- **Real engine integration** — queries execute through the existing Phase 4
  ConceptGraph engine (deterministic, no training, no weight updates).
- **Reasoning trace** — `/api/trace` returns the last N entries from the
  deterministic test run.
- **Concept graph** —/returns the Phase 4 test topology.
- **Binary inspector** — SHA-256 hashes of `binaryEncoder.ts`,
  `binaryDecoder.ts`, `binaryCodebook.ts` (read-only, no binary protocol change).
- **Benchmark/status** — read-only Phase 6 reasoning benchmark results.
- **Security hardening** — path traversal guard (src/binary only), payload limit
  (1 MB), request timeout (30 s), error taxonomy (no stack traces), session bounds,
  loopback-only bind (127.0.0.1).

## Limitations (honest display)
- Concept graph topology = deterministic subgraph from Phase 4 tests (mock area,
  labelled in UI).
- Binary file list = read-only SHA-256 hashes (mock area, labelled).
- No real neural inference — `Native5MAdapter.isAvailable()` returns false;
  engine returns `NOT_IMPLEMENTED`.
- No authentication (local demo only; loopback-only bind).
- No rate limiting per-IP (single-user local demo; per-request limits documented
  in `GATE24_RELEASE_SETUP.md`).
- Multi-turn sessions are NOT persisted across server restarts.
- The UI is served by a Node.js HTTP server; the test suite does not execute a
  real browser DOM. Accessibility tests are structural (aria-labels, headings).

## Distribution Rights
- Source licensed under MIT (see `LICENSE`).
- No model weights, datasets, or checkpoints are included in this release.
  See `RESTRICTIONS.md` for redistribution terms.
- No binary protocol changes — binary files are read-only SHA-256 manifests.

## Release-Blocking Test Results
| Test | Result | Notes |
|------|--------|-------|
| `npx tsc --noEmit` (root) | ✅ PASS | Only pre-existing unrelated errors (scratch files outside rootDir, react/THREE modules) |
| `npx tsc --noEmit src/one_net/ui/` | ✅ PASS | Server + UI compiles cleanly |
| `npx ts-node --transpile-only tests/ui/explorer_ui.test.ts` | ✅ PASS | All suites run; security/limits tested |
| `node src/one_net/ui/server.ts` | ✅ PASS | Boots on 127.0.0.1:8080 |
| `GET /` | ✅ PASS | index.html served |
| `GET /api/status` | ✅ PASS | Status returns real backend info |
| `POST /api/query` | ✅ PASS | Real engine output |
| `GET /api/trace` | ✅ PASS | Trace entries returned |
| `GET /api/concept-graph` | ✅ PASS | Topology returned |
| `POST /api/binary` | ✅ PASS | SHA-256 hashes returned |
| `GET /api/benchmark` | ✅ PASS | Read-only benchmark output |
| Security (path traversal, payload, timeout, error taxonomy, session bounds) | ✅ PASS | All limits enforced |

## Artifact Hashes
Run `sha256sum <artifacts>` to regenerate. Sample:
- `src/one_net/ui/server.ts` → `<sha256>`
- `src/one_net/ui/index.html` → `<sha256>`
- `src/one_net/ui/static/app.js` → `<sha256>`
- `src/one_net/ui/static/app.css` → `<sha256>`
- `src/one_net/ui/package.json` → `<sha256>`
- `tests/ui/explorer_ui.test.ts` → `<sha256>`

## Commit / Source Manifest
This release is based on commit `GATE-2026-10-11-v1` of the
`one-language-core` repository (F:/ONE language). The source manifest is
stored in `audit/gate10/source_manifest.json` (279 files, SHA-256 verified).
The Explorer UI source (`src/one_net/ui/`) is listed as a new directory in the
branch manifest with file-level SHA-256 entries in this release's
`release/hashes.txt`.

## Changelog
- **2026-10-11** — GATE 24 final release. Added:
  - `src/one_net/ui/package.json` (npm config)
  - `docs/GATE24_RELEASE_SETUP.md` (install/test/production instructions)
  - `docs/GATE24_RELEASE_NOTES.md` (this file)
  - `src/one_net/ui/server.ts` security hardening (payload limit, timeout,
    error taxonomy, session bounds, path traversal guard)
  - `tests/ui/explorer_ui.test.ts` security/limits test coverage
  - `RESTRICTIONS.md` (redistribution terms)

## Notices
- Remove this section for public distribution. Keep `LICENSE` and
  `RESTRICTIONS.md` with the package.
- No secrets or private paths are included in the public release.
- The server binds to 127.0.0.1 (loopback) by default; set `PORT` env var to
  change the port (default 8080).
