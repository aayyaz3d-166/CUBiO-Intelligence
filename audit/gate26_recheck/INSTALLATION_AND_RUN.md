# ONE LANGUAGE — INSTALLATION AND RUN GUIDE

**Document ID:** `GATE-26-INSTALLATION-AND-RUN`  
**Date:** 2026-10-11  

---

## 1. Prerequisites

- **OS:** Windows 10/11, Linux, or macOS
- **Runtime:** Node.js (v18.x to v22.x LTS recommended; v24+ requires explicit module resolution flags)
- **TypeScript:** v5.4.5 or higher
- **Native Checkpoint (Optional):** `E:\3D memory studio\data\checkpoints\one_lm_v1\one_lm_best.cubiomodel` (for Native 5M neural inference)

---

## 2. Setup

```bash
# Clone or enter repository directory
cd "F:/ONE language"

# Install pinned dependencies
npm ci
# or (if lockfile is updated):
npm install
```

---

## 3. Running Supported Workflows

### A. Core Compiler & VM CLI
```bash
# Run developer CLI
npx ts-node src/one/cli/OneDeveloperCLI.ts
```

### B. Verification Test Suites
*(Note: requires CommonJS or custom loader transpiler if running under Node v24 ESM)*
```bash
# Phase 1 Bridge Verification
npm run test:phase1:bridge

# Phase 2 Binary Protocol
npm run test:binary:phase2

# Phase 3 Reasoning Engine
npm run test:reasoning:phase3

# Phase 4 Memory Layer
npm run test:memory:phase4

# Phase 5 Gate 8 Conversational & Relationship Tests
npm run test:gate8
```
