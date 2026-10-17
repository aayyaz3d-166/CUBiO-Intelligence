#!/usr/bin/env node
/**
 * ONE Language — Minimal CJS Test Runner Hook (PREREQ-ESM-001)
 * Enables CJS require-hook transpilation for TypeScript test suites
 * while keeping "type": "module" in package.json and leaving source code untouched.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const targetArg = process.argv[2];
if (!targetArg) {
  console.error('[TEST RUNNER ERROR] Missing target test path. Usage: node scripts/run-test.cjs <test-path>');
  process.exit(1);
}

// 1. Resolve and verify real paths for boundary containment
const rawRepoRoot = path.resolve(__dirname, '..');
const rawTargetPath = path.resolve(process.cwd(), targetArg);

if (!fs.existsSync(rawTargetPath)) {
  console.error(`[TEST RUNNER ERROR] Target test file does not exist: ${rawTargetPath}`);
  process.exit(1);
}

let realRepoRoot, realTargetPath;
try {
  realRepoRoot = fs.realpathSync.native(rawRepoRoot);
  realTargetPath = fs.realpathSync.native(rawTargetPath);
} catch (err) {
  console.error('[TEST RUNNER ERROR] Failed to resolve canonical path:', err);
  process.exit(1);
}

const relToRoot = path.relative(realRepoRoot, realTargetPath).replace(/\\/g, '/');

// Strict real-path containment
if (relToRoot === '..' || relToRoot.startsWith('../') || path.isAbsolute(relToRoot)) {
  console.error(`[TEST RUNNER ERROR] Target test path is outside repository root: ${rawTargetPath}`);
  process.exit(1);
}

// 2. Explicit Registries
const KNOWN_EXPORTED_RUNNERS = Object.freeze({
  'tests/phase1_bridge_verification.test.ts': 'runPhase1BridgeTests',
  'tests/binary/phase2_binary_language.test.ts': 'runPhase2BinaryTests',
  'tests/reasoning/phase3_reasoning_engine.test.ts': 'runPhase3ReasoningTests',
  'tests/memory/phase4_memory_layer.test.ts': 'runPhase4MemoryTests',
  'tests/esm/esm_runtime_verification.test.ts': 'runESMRuntimeTests',
});

const KNOWN_SELF_EXECUTING_SUITES = Object.freeze({
  'tests/hybrid/phase5_gate6_conversational_quality.test.ts': Object.freeze({
    name: 'Gate 6',
    regex: /Total:\s*(\d+)\s*\|\s*Passed:\s*(\d+)\s*\|\s*Failed:\s*(\d+)/g,
    parse: (matches) => {
      if (matches.length !== 1) return null;
      return {
        total: parseInt(matches[0][1], 10),
        passed: parseInt(matches[0][2], 10),
        failed: parseInt(matches[0][3], 10),
      };
    },
  }),
  'tests/hybrid/phase5_gate8_reasoning_relationship_conversational.test.ts': Object.freeze({
    name: 'Gate 8',
    regex: /(\d+)\/(\d+)\s+passed,\s+(\d+)\s+failed/g,
    parse: (matches) => {
      if (matches.length !== 1) return null;
      return {
        passed: parseInt(matches[0][1], 10),
        total: parseInt(matches[0][2], 10),
        failed: parseInt(matches[0][3], 10),
      };
    },
  }),
});

// Enforce own-property membership
const hasExported = Object.prototype.hasOwnProperty.call(KNOWN_EXPORTED_RUNNERS, relToRoot);
const hasSelfExecuting = Object.prototype.hasOwnProperty.call(KNOWN_SELF_EXECUTING_SUITES, relToRoot);

if (!hasExported && !hasSelfExecuting) {
  console.error(`[TEST RUNNER ERROR] Target '${relToRoot}' is not registered in the approved test suite registry.`);
  process.exit(1);
}

// 3. Install TypeScript require hook
require.extensions['.ts'] = function(module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};

// 4. Minimal directory and extensionless resolution hook
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (err) {
    if (request.startsWith('.') && parent && parent.filename) {
      const candidateBase = path.resolve(path.dirname(parent.filename), request);
      if (fs.existsSync(candidateBase + '.ts')) {
        return candidateBase + '.ts';
      }
      if (fs.existsSync(path.join(candidateBase, 'index.ts'))) {
        return path.join(candidateBase, 'index.ts');
      }
    }
    throw err;
  }
};

// 5. Execution and Contract Verification
async function main() {
  console.log(`[TEST RUNNER] Executing: ${relToRoot}`);

  let capturedOutput = '';
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = function(chunk, encoding, callback) {
    const str = typeof chunk === 'string' ? chunk : chunk.toString(encoding);
    capturedOutput += str;
    return originalStdoutWrite(chunk, encoding, callback);
  };

  let mod;
  try {
    mod = require(realTargetPath);
  } catch (err) {
    process.stdout.write = originalStdoutWrite;
    console.error(`[TEST RUNNER ERROR] Failed to load test module: ${relToRoot}`);
    console.error(err);
    process.exit(1);
  }

  process.stdout.write = originalStdoutWrite;

  if (hasExported) {
    const expectedFn = KNOWN_EXPORTED_RUNNERS[relToRoot];
    if (typeof mod[expectedFn] !== 'function') {
      console.error(`[TEST RUNNER ERROR] Expected exported runner '${expectedFn}' not found in ${relToRoot}`);
      process.exit(1);
    }
    console.log(`[TEST RUNNER] Invoking registered runner: ${expectedFn}()`);
    try {
      const result = await mod[expectedFn]();
      if (result !== undefined) {
        console.error(`[TEST RUNNER ERROR] Runner '${expectedFn}' returned unexpected non-undefined value:`, result);
        process.exit(1);
      }
      console.log(`[TEST RUNNER] Registered runner ${expectedFn}() completed cleanly.`);
    } catch (err) {
      console.error(`[TEST RUNNER ERROR] Runner ${expectedFn}() threw an unhandled exception:`, err);
      process.exit(1);
    }
  } else if (hasSelfExecuting) {
    const suiteConfig = KNOWN_SELF_EXECUTING_SUITES[relToRoot];
    const matches = [...capturedOutput.matchAll(suiteConfig.regex)];
    const parsed = suiteConfig.parse(matches);

    if (!parsed) {
      console.error(`[TEST RUNNER ERROR] Suite '${suiteConfig.name}' failed summary verification (missing, multiple, or malformed banner).`);
      process.exit(1);
    }

    const { total, passed, failed } = parsed;
    if (total === 0 || failed > 0 || passed !== total) {
      console.error(`[TEST RUNNER ERROR] ${suiteConfig.name} count mismatch: Total=${total}, Passed=${passed}, Failed=${failed}`);
      process.exit(1);
    }
    console.log(`[TEST RUNNER] ${suiteConfig.name} verified: ${passed}/${total} passed, 0 failed.`);
  }
}

main().catch(err => {
  console.error('[TEST RUNNER FATAL ERROR]', err);
  process.exit(1);
});
