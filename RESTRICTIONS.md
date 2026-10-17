# ONE Language Explorer UI — Redistribution & Restrictions

## What's in This Release
This public demo release contains only the ONE Language Explorer UI:
- Backend HTTP service: `src/one_net/ui/server.ts`
- Frontend: `src/one_net/ui/index.html`, `static/app.css`, `static/app.js`
- Test suite: `tests/ui/explorer_ui.test.ts`
- TypeScript configuration: `tsconfig.json`

The core ONE Language compiler, binary protocol, concept graph engine, and all
other subsystems are NOT included in this release. They reside in the parent
repository at `F:/ONE language` (see `docs/one-language/`).

## Distribution Rights
- **Source license:** MIT (see `LICENSE`).
- **No model weights:** No neural network weights are distributed in this
  release. The `Native5MAdapter` returns `NOT_IMPLEMENTED` when the checkpoint
  is unavailable.
- **No datasets:** No training data or benchmark datasets are distributed in
  this release. Benchmark results are generated at runtime from the existing
  test suites (Phase 6 reasoning benchmark).
- **No checkpoints:** No model checkpoints are included. The binary protocol
  files (`binaryEncoder.ts`, `binaryDecoder.ts`, `binaryCodebook.ts`) are
  distributed as read-only SHA-256 manifests only; no binary protocol changes
  are made.
- **License compliance:** You may redistribute this software under the MIT
  license with the copyright notice and license text retained. See `LICENSE`.

## Restrictions
- **No source modification** of protected components without explicit
  authorization.
- **No model training or fine-tuning** in this release.
- **No binary protocol changes** — binary files are read-only SHA-256 manifests.
- **No training gate** — continuous learning is not active in this release.
- **No secrets** — no API keys, tokens, passwords, or connection strings are
  included in the public release. All credentials are replaced with
  `[REDACTED]` or removed entirely.
- **No private paths** — the release contains no absolute filesystem paths
  beyond the documented loopback bind address (127.0.0.1:8080) and the
  documented project root path for the binary inspector.
- **No arbitrary code execution** — the backend never evals, never shells out
  to arbitrary commands, and the reasoning engine runs only the existing
  deterministic test suites.
- **No model-generated content** — UI output is the real engine output; no
  neural network is used, so no model-generated code can be executed.

## Known Limitations (public display)
- Concept graph topology = deterministic subgraph from Phase 4 tests (mock
  area, labelled in UI).
- Binary file list = read-only SHA-256 hashes (mock area, labelled).
- No real neural inference (not implemented).
- No authentication (local demo only; loopback-only bind).
- No per-IP rate limiting (single-user local demo; per-request limits
  documented in `GATE24_RELEASE_SETUP.md`).
- Multi-turn sessions are NOT persisted across server restarts.
- The UI is served by a Node.js HTTP server; the test suite does not execute
  a real browser DOM. Accessibility tests are structural.
- Engine budgets: default 100 steps, 250 candidates, 20 depth.
