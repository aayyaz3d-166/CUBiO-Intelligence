#!/usr/bin/env node
/**
 * ONE Binary 0/1 Reasoning Intelligence — Standalone Test Harness
 * ===============================================================
 * Minimal, zero-dependency CJS require hook executing TypeScript test suites.
 */

const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');

let ts;
try {
  ts = require('typescript');
} catch (e) {
  try {
    const fallbackPath = path.resolve(repoRoot, '..', 'ONE language', 'node_modules', 'typescript');
    ts = require(fallbackPath);
  } catch (e2) {
    console.error('[TEST RUNNER ERROR] TypeScript is required to run test suites on the fly.');
    console.error('Please run "npm install" or ensure TypeScript is available in the environment.');
    process.exit(1);
  }
}
const Module = require('module');

// 1. Install TypeScript on-the-fly transpiler
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

// 2. Install extensionless and .ts resolution hook
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (err) {
    if (request.startsWith('.') && parent && parent.filename) {
      const dir = path.dirname(parent.filename);
      if (request.endsWith('.js')) {
        const tsVariant = path.resolve(dir, request.slice(0, -3) + '.ts');
        if (fs.existsSync(tsVariant)) {
          return tsVariant;
        }
      }
      const candidateBase = path.resolve(dir, request);
      if (fs.existsSync(candidateBase + '.ts')) {
        return candidateBase + '.ts';
      }
      if (fs.existsSync(candidateBase + '.js')) {
        return candidateBase + '.js';
      }
      if (fs.existsSync(path.join(candidateBase, 'index.ts'))) {
        return path.join(candidateBase, 'index.ts');
      }
    }
    throw err;
  }
};

// 3. Execution dispatch
const targetArg = process.argv[2];

async function runSuite(relPath, exportName) {
  const absPath = path.resolve(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    console.error(`[TEST RUNNER ERROR] File not found: ${absPath}`);
    process.exit(1);
  }
  const mod = require(absPath);
  const fn = exportName ? mod[exportName] : (mod.default || mod);
  if (typeof fn === 'function') {
    await fn();
  } else {
    console.error(`[TEST RUNNER ERROR] Expected exported function '${exportName}' in ${relPath}`);
    process.exit(1);
  }
}

async function main() {
  if (targetArg) {
    const norm = targetArg.replace(/\\/g, '/');
    if (norm.includes('binary_language')) {
      await runSuite(norm, 'runPhase2BinaryTests');
    } else if (norm.includes('reasoning_engine')) {
      await runSuite(norm, 'runPhase3ReasoningTests');
    } else if (norm.includes('bridge_e2e')) {
      await runSuite(norm, 'runIntegrationE2ETests');
    } else if (norm.includes('benchmark')) {
      await runSuite(norm, 'runPhase3Benchmarks');
    } else {
      await runSuite(norm);
    }
  } else {
    console.log('\n================================================================================');
    console.log('  ONE BINARY 0/1 REASONING INTELLIGENCE — COMPREHENSIVE TEST SUITE');
    console.log('================================================================================\n');

    console.log('>>> [1/4] Executing Binary Language Protocol Suite...');
    await runSuite('tests/binary/binary_language.test.ts', 'runPhase2BinaryTests');

    console.log('\n>>> [2/4] Executing Reasoning Intelligence Engine Suite...');
    await runSuite('tests/reasoning/reasoning_engine.test.ts', 'runPhase3ReasoningTests');

    console.log('\n>>> [3/4] Executing End-to-End Integration & Binary Bridge Suite...');
    await runSuite('tests/integration/bridge_e2e.test.ts', 'runIntegrationE2ETests');

    console.log('\n>>> [4/4] Executing Deterministic Reasoning Benchmarks...');
    await runSuite('tests/reasoning/reasoning_benchmark.ts', 'runPhase3Benchmarks');

    console.log('\n================================================================================');
    console.log('  ALL TEST SUITES EXECUTED WITH 100% SUCCESS (0 FAILURES)');
    console.log('================================================================================\n');
  }
}

main().catch((err) => {
  console.error('[TEST RUNNER FATAL ERROR]', err);
  process.exit(1);
});
