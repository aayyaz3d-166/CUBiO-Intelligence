#!/usr/bin/env node
/**
 * ONE Language — Developer Command Line Interface Executable
 * ==========================================================
 * Single executable entrypoint for ONE Language.
 * Supports running from pre-bundled dist/cli-bundle.js when built,
 * or transpiles TypeScript source on-the-fly via the Node require hook.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const bundledCliCjs = path.join(repoRoot, 'dist', 'cli-bundle.cjs');
const bundledCliJs = path.join(repoRoot, 'dist', 'cli-bundle.js');
const bundledCli = fs.existsSync(bundledCliCjs) ? bundledCliCjs : bundledCliJs;

function runWithCLI(OneDeveloperCLI) {
  if (typeof OneDeveloperCLI?.run === 'function') {
    const result = OneDeveloperCLI.run(process.argv.slice(2));
    if (result.stdout) {
      process.stdout.write(result.stdout + '\n');
    }
    if (result.stderr) {
      process.stderr.write(result.stderr + '\n');
    }
    process.exit(result.exitCode);
  } else {
    console.error('[CLI ERROR] OneDeveloperCLI.run is not available.');
    process.exit(1);
  }
}

// 1. Try bundled distribution artifact first if present
if (fs.existsSync(bundledCli)) {
  try {
    const cliModule = require(bundledCli);
    const OneDeveloperCLI = cliModule.OneDeveloperCLI || cliModule.default?.OneDeveloperCLI || cliModule;
    runWithCLI(OneDeveloperCLI);
    return;
  } catch (err) {
    // If bundled CLI has issue, fall back to TS transpilation hook
  }
}

// 2. Fall back to TypeScript require hook
const ts = require('typescript');

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

const tsEntry = path.join(repoRoot, 'src', 'one', 'cli', 'OneDeveloperCLI.ts');
const cliModule = require(tsEntry);
const OneDeveloperCLI = cliModule.OneDeveloperCLI;
runWithCLI(OneDeveloperCLI);
