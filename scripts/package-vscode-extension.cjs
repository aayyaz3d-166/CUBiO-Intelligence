#!/usr/bin/env node
/**
 * ONE Language — VS Code Extension Packaging Pipeline (T11)
 * ==========================================================
 * Builds and packages the ONE Language Visual Studio Code extension
 * into a standalone .vsix distribution package.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

function computeFileSHA256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function packageVSCodeExtension(options = {}) {
  const startTime = Date.now();
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — VS CODE EXTENSION PACKAGING PIPELINE (one-language.vsix)');
  console.log('================================================================================');

  const repoRoot = path.resolve(__dirname, '..');
  const editorDir = path.join(repoRoot, 'editors', 'vscode');
  const distDir = path.join(repoRoot, 'dist');
  fs.mkdirSync(distDir, { recursive: true });

  const pkgJsonPath = path.join(editorDir, 'package.json');
  const pkgData = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  const vsixOut = options.out ? path.resolve(options.out) : path.join(distDir, `one-language-${pkgData.version}.vsix`);
  fs.mkdirSync(path.dirname(vsixOut), { recursive: true });

  // ── Stage 1: Build Extension Bundle with esbuild ──────────────────────────
  console.log('\n[Stage 1] Bundling VS Code Extension with esbuild...');
  const entryTs = path.join(editorDir, 'src', 'extension.ts');
  const bundleOut = path.join(editorDir, 'dist', 'extension.js');
  fs.mkdirSync(path.dirname(bundleOut), { recursive: true });

  const esbuildCmd = `npx esbuild "${entryTs}" --bundle --platform=node --format=cjs --external:vscode --outfile="${bundleOut}"`;
  cp.execSync(esbuildCmd, { cwd: repoRoot, stdio: 'inherit' });

  assert(fs.existsSync(bundleOut), 'Extension bundle generation failed');
  const bundleSize = fs.statSync(bundleOut).size;
  console.log(`  ✔ Bundle generated: ${bundleOut} (${(bundleSize / (1024 * 1024)).toFixed(2)} MB)`);

  // ── Stage 2: Validate Manifest & Assets ────────────────────────────────────
  console.log('\n[Stage 2] Validating Extension Manifest and Assets...');
  const langConfigPath = path.join(editorDir, 'language-configuration.json');
  const tmLanguagePath = path.join(editorDir, 'syntaxes', 'one.tmLanguage.json');
  const snippetsPath = path.join(editorDir, 'snippets', 'one.code-snippets');
  const iconPath = path.join(editorDir, 'assets', 'ONE-Language-Logo.png');
  const modelPath = path.join(editorDir, 'models', 'echo1_best_loss.cubiomodel');

  assert(fs.existsSync(pkgJsonPath), 'Missing package.json in extension directory');
  assert(fs.existsSync(langConfigPath), 'Missing language-configuration.json');
  assert(fs.existsSync(tmLanguagePath), 'Missing syntaxes/one.tmLanguage.json');
  assert(fs.existsSync(snippetsPath), 'Missing snippets/one.code-snippets');
  assert(fs.existsSync(iconPath), 'Missing extension icon at assets/ONE-Language-Logo.png');
  assert(fs.existsSync(modelPath), 'Missing embedded ECHO-1 model at models/echo1_best_loss.cubiomodel');

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  console.log(`  - Extension: ${pkg.publisher}.${pkg.name} v${pkg.version}`);
  console.log(`  - Target VS Code: ${pkg.engines.vscode}`);
  console.log(`  ✔ All grammar, language configuration, snippets, and embedded ECHO-1 model (${(fs.statSync(modelPath).size / (1024 * 1024)).toFixed(2)} MB) verified.`);

  // ── Stage 3: Package VSIX via @vscode/vsce ─────────────────────────────────
  console.log('\n[Stage 3] Packaging .vsix Package via @vscode/vsce...');
  const relVsix = path.relative(editorDir, vsixOut);
  const vsceCmd = `npx @vscode/vsce package --out "${relVsix}" --no-dependencies --allow-missing-repository`;
  cp.execSync(vsceCmd, { cwd: editorDir, stdio: 'inherit' });

  assert(fs.existsSync(vsixOut), `VSIX package not found at: ${vsixOut}`);
  const vsixSize = fs.statSync(vsixOut).size;
  const vsixHash = computeFileSHA256(vsixOut);
  console.log(`  ✔ VSIX package created: ${vsixOut}`);
  console.log(`    Size: ${(vsixSize / (1024 * 1024)).toFixed(2)} MB (${vsixSize} bytes)`);
  console.log(`    SHA-256: ${vsixHash}`);

  // ── Stage 4: Emit Checksums & Manifest ────────────────────────────────────
  console.log('\n[Stage 4] Emitting Extension Checksums & Distribution Metadata...');
  const manifest = {
    extension: `${pkg.publisher}.${pkg.name}`,
    version: pkg.version,
    artifact: path.basename(vsixOut),
    sizeBytes: vsixSize,
    sha256: vsixHash,
    builtAt: new Date().toISOString(),
    supportedEngines: pkg.engines.vscode,
    languages: pkg.contributes.languages.map((l) => l.id),
    features: [
      'TextMate Syntax Highlighting (source.one)',
      'Language Configuration (comments, brackets, auto-closing)',
      'Code Snippets (16 constructs)',
      'In-Process Diagnostics (OneLanguageServer)',
      'Autocomplete / Completions',
      'Hover Signatures & Docstrings',
      'Go-to-Definition',
      'Run & Check Editor Commands',
    ],
  };

  const manifestPath = vsixOut + '.manifest.json';
  const sha256Path = vsixOut + '.sha256';

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  fs.writeFileSync(sha256Path, `${vsixHash} *${path.basename(vsixOut)}\n`, 'utf-8');
  console.log(`  ✔ Manifest: ${manifestPath}`);
  console.log(`  ✔ Checksum: ${sha256Path}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================================');
  console.log(`  VS CODE EXTENSION PACKAGING COMPLETED IN ${elapsed}s`);
  console.log('================================================================================\n');

  return {
    vsixPath: vsixOut,
    sha256: vsixHash,
    manifest,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[PACKAGING ERROR] ${message}`);
  }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const outIdx = args.indexOf('--out');
    const customOut = outIdx !== -1 && args[outIdx + 1] ? path.resolve(process.cwd(), args[outIdx + 1]) : undefined;
    packageVSCodeExtension(customOut ? { out: customOut } : {});
  } catch (err) {
    console.error('\n[FATAL ERROR]:', err.message || err);
    process.exit(1);
  }
}

module.exports = { packageVSCodeExtension };
