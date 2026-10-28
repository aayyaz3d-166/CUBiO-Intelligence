/**
 * ONE Language — Native Node.js ESM Customization Hook (T03)
 * ==========================================================
 * Provides native ECMAScript module resolution for Node.js 20+ and 24+:
 * - Resolves extensionless relative imports (e.g. './oneLexer' -> './oneLexer.ts')
 * - Resolves directory index imports (e.g. './tensor' -> './tensor/index.ts')
 * - Transpiles TypeScript modules on-the-fly to native ES2022 output
 * - Preserves native ESM execution semantics without downleveling to CommonJS
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];

export async function resolve(specifier, context, nextResolve) {
  // Intercept relative and absolute path specifiers
  if (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('/') ||
    /^[a-zA-Z]:/.test(specifier)
  ) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ERR_UNSUPPORTED_DIR_IMPORT') {
        const parentURL = context.parentURL ? new URL(context.parentURL) : pathToFileURL(process.cwd() + '/');
        const parentPath = parentURL.protocol === 'file:' ? fileURLToPath(parentURL) : process.cwd();
        const parentDir = path.dirname(parentPath);
        const resolvedBase = path.resolve(parentDir, specifier);

        // 0. If specifier ends in .js or .mjs, try mapping to .ts/.tsx (TypeScript NodeNext compatibility)
        if (resolvedBase.endsWith('.js') || resolvedBase.endsWith('.mjs')) {
          const tsCandidate = resolvedBase.replace(/\.[cm]?js$/, '.ts');
          if (fs.existsSync(tsCandidate) && fs.statSync(tsCandidate).isFile()) {
            return nextResolve(pathToFileURL(tsCandidate).href, context);
          }
          const tsxCandidate = resolvedBase.replace(/\.[cm]?js$/, '.tsx');
          if (fs.existsSync(tsxCandidate) && fs.statSync(tsxCandidate).isFile()) {
            return nextResolve(pathToFileURL(tsxCandidate).href, context);
          }
        }

        // 1. Check exact file with candidate extensions
        for (const ext of FILE_EXTENSIONS) {
          const candidate = resolvedBase + ext;
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return nextResolve(pathToFileURL(candidate).href, context);
          }
        }

        // 2. Check directory with index files
        if (fs.existsSync(resolvedBase) && fs.statSync(resolvedBase).isDirectory()) {
          for (const ext of FILE_EXTENSIONS) {
            const candidate = path.join(resolvedBase, 'index' + ext);
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
              return nextResolve(pathToFileURL(candidate).href, context);
            }
          }
        }
      }
      throw err;
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.ts') && !url.endsWith('.d.ts')) {
    const filePath = fileURLToPath(url);
    const source = fs.readFileSync(filePath, 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        sourceMap: true,
      },
      fileName: filePath,
    });

    let preamble = '';
    const needsRequire = /\brequire\b/.test(source) && !/\b(const|let|var)\s+require\b/.test(source);
    const needsModule = /\bmodule\b/.test(source) && !/\b(const|let|var)\s+module\b/.test(source);
    const needsDirname = /\b__dirname\b/.test(source) && !/\b(const|let|var)\s+__dirname\b/.test(source);
    const needsFilename = /\b__filename\b/.test(source) && !/\b(const|let|var)\s+__filename\b/.test(source);

    if (needsRequire || needsModule || needsDirname || needsFilename) {
      preamble += "import { createRequire as __createRequire } from 'node:module';\n";
      preamble += "import { fileURLToPath as __fileURLToPath } from 'node:url';\n";
      preamble += "import __path from 'node:path';\n";
      preamble += "const __currFile = __fileURLToPath(import.meta.url);\n";
      preamble += "const __isMain = Boolean(process.argv[1] && __path.resolve(process.argv[1]).toLowerCase() === __currFile.toLowerCase());\n";
      preamble += "const __module = { exports: {}, id: import.meta.url };\n";

      if (needsRequire) {
        preamble += "const require = Object.assign(__createRequire(import.meta.url), { main: __isMain ? __module : {} });\n";
      }
      if (needsModule) {
        preamble += "const module = __module;\n";
        preamble += "const exports = __module.exports;\n";
      }
      if (needsDirname) {
        preamble += "const __dirname = __path.dirname(__currFile);\n";
      }
      if (needsFilename) {
        preamble += "const __filename = __currFile;\n";
      }
    }

    return {
      format: 'module',
      shortCircuit: true,
      source: preamble ? preamble + compiled.outputText : compiled.outputText,
    };
  }

  return nextLoad(url, context);
}
