# ONE Language Explorer — GATE 24 Release Setup

## Prerequisites
- Node.js >= 18.0.0 (Node 26.7.0 verified)
- Windows 10/11 (MSYS2/MinGW64 or PowerShell)
- No npm packages required (pure Node.js built-in modules)

## Quick Start
```bash
# 1. Clone / extract the release (no git needed — this is a pure JS project)
cd one-language-explorer-ui

# 2. Build (compiles TypeScript to dist/)
npm run build

# 3. Start the server
npm start

# 4. Open http://localhost:8080 in a browser
```

## Test Commands
```bash
# Run the release test suite (TSC compile + runtime tests)
npm test

# Run only the UI test suite
npx ts-node --transpile-only tests/ui/explorer_ui.test.ts
```

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Serve the Explorer UI (index.html) |
| GET | /static/* | Serve CSS/JS assets |
| GET | /api/status | Full UI status |
| POST | /api/query | Execute a natural-language prompt through the real engine |
| GET | /api/trace | Last N reasoning trace entries |
| GET | /api/concept-graph | Concept graph topology |
| POST | /api/binary | SHA-256 inspection of binary protocol files |
| GET | /api/benchmark | Read-only benchmark status |

## Rate / Resource Limits
| Limit | Value | Enforced At |
|-------|-------|-------------|
| Request body | 1 MB | server.ts (all POST endpoints) |
| Request timeout | 30 s | server.ts (spawnSync for engine tests) |
| Engine step budget | 100 steps | engine.solve() (default) |
| Engine candidate budget | 250 candidates | engine.solve() (default) |
| Engine depth budget | 20 depth | engine.solve() (default) |
| Concurrent sessions | None (stateless per request) | server.ts |
| Bind address | 127.0.0.1 (loopback only) | server.ts |
| Port | 8080 (env PORT override) | server.ts |

## File System Access (hardened)
- `/api/binary` — SHA-256 inspection of files in `src/binary/` ONLY. The server
  rejects any path outside this directory. See `SECURITY_MODEL.md`.
- `/api/query` — executes the deterministic symbolic reasoning engine.
  No shell, no eval, no dynamic code. The engine runs the existing test suite
  which is the read-only Phase 4 memory layer.
- `/api/benchmark` — runs the read-only Phase 6 reasoning benchmark.
  No training, no weight updates, no model changes.

## Known Limitations (for public display)
- Concept graph topology is a deterministic subgraph from Phase 4 tests (mock area, labelled).
- Binary file list is read-only SHA-256 hashes (mock area, labelled).
- No real neural inference (not implemented). Native5MAdapter returns NOT_IMPLEMENTED.
- No authentication (local demo only; bind to loopback).
- No rate limiting per-IP (single-user local demo; bounds documented above).
- Multi-turn sessions are NOT persisted across server restarts.
- The UI is served by a Node.js HTTP server; no browser DOM execution in tests.

## Distribution Rights
- MIT license for source. No model weights, datasets, or checkpoints are included.
  See `LICENSE` and `RESTRICTIONS.md` for redistribution terms.
- No binary protocol changes — binary files are read-only SHA-256 manifests.
- No model training or fine-tuning in this release.

## Release Notes
See `release/GATE24_RELEASE_NOTES.md` (versioned, SHA-256 artifacts below).

## Artifact Hashes
Run: `sha256sum dist/**/* src/one_net/ui/* > release/hashes.txt`
