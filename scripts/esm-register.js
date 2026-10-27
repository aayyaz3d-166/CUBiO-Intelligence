/**
 * ONE Language — Native ESM Module Registration Entrypoint (T03)
 * Registers the Node.js 20+/24+ native ESM customization hooks.
 */

import { register, Module } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const loaderUrl = new URL('./esm-loader.mjs', import.meta.url).href;
register(loaderUrl, import.meta.url);

// Also hook CommonJS require for hybrid/legacy test files that invoke require() internally
if (Module && Module._extensions) {
  Module._extensions['.ts'] = function(module, filename) {
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
}

