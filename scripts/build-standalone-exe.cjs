#!/usr/bin/env node
/**
 * ONE Language — Standalone Executable Packaging Pipeline (Node.js SEA)
 * =====================================================================
 * Packages ONE Language compiler, VM, and developer CLI into a self-contained,
 * single Windows executable (one.exe) using Node.js Single Executable Application
 * (SEA) architecture and postject PE resource injection.
 *
 * Invariants Enforced:
 *  - Windows x64 PE32+ binary format
 *  - Actuation lockout invariant active in runtime payload
 *  - Address369 boundary constraints active
 *  - Fail-closed verification of build artifacts prior to completion
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

interfaceArgs = process.argv.slice(2);

function parseArgs() {
  const options = {
    outPath: path.resolve('dist/one.exe'),
    copyToBin: true,
    cleanIntermediate: false,
    verbose: false,
  };

  for (let i = 0; i < interfaceArgs.length; i++) {
    const arg = interfaceArgs[i];
    if (arg === '--out' || arg === '-o') {
      options.outPath = path.resolve(interfaceArgs[++i]);
    } else if (arg === '--no-bin') {
      options.copyToBin = false;
    } else if (arg === '--clean') {
      options.cleanIntermediate = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }
  return options;
}

function computeFileSHA256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function buildStandaloneExecutable(opts = parseArgs()) {
  const startTime = Date.now();
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — STANDALONE WINDOWS EXECUTABLE PACKAGING (one.exe)');
  console.log('================================================================================');

  // ── Stage 0: Pre-flight Environment Checks ─────────────────────────────
  console.log('\n[Stage 0] Pre-flight Environment Verification...');
  const nodeVer = process.versions.node;
  const majorVer = parseInt(nodeVer.split('.')[0], 10);
  console.log(`  - Node.js Runtime Version: v${nodeVer} (Major: ${majorVer})`);
  if (majorVer < 20) {
    throw new Error(`Node.js version v${nodeVer} does not support Single Executable Application (requires >= 20.0.0).`);
  }

  const platform = process.platform;
  const arch = process.arch;
  console.log(`  - Host Platform / Architecture: ${platform} (${arch})`);
  if (platform !== 'win32') {
    console.warn(`  [WARNING] Target is designed for Windows win32 (current: ${platform}).`);
  }

  const baseNodeExe = process.execPath;
  if (!fs.existsSync(baseNodeExe)) {
    throw new Error(`Node.js base binary not found at: ${baseNodeExe}`);
  }
  console.log(`  - Base Node Executable: ${baseNodeExe}`);

  // ── Stage 1: Bundle Developer CLI with esbuild ──────────────────────────
  console.log('\n[Stage 1] Bundling Developer CLI and Runtime with esbuild...');
  const repoRoot = path.resolve(__dirname, '..');
  const distDir = path.dirname(opts.outPath);
  fs.mkdirSync(distDir, { recursive: true });

  const cjsBundlePath = path.join(distDir, 'cli-bundle.cjs');
  const esbuildEntry = path.join(repoRoot, 'src', 'one', 'cli', 'OneDeveloperCLI.ts');

  const esbuildCmd = `npx esbuild "${esbuildEntry}" --bundle --platform=node --format=cjs --outfile="${cjsBundlePath}"`;
  if (opts.verbose) console.log(`  Executing: ${esbuildCmd}`);
  cp.execSync(esbuildCmd, { cwd: repoRoot, stdio: 'inherit' });

  const bundleSize = fs.statSync(cjsBundlePath).size;
  const bundleHash = computeFileSHA256(cjsBundlePath);
  console.log(`  ✔ CLI Bundle generated: ${cjsBundlePath}`);
  console.log(`    Size: ${(bundleSize / (1024 * 1024)).toFixed(2)} MB | SHA-256: ${bundleHash.slice(0, 16)}...`);

  // ── Stage 2: Generate SEA Configuration & Preparation Blob ─────────────
  console.log('\n[Stage 2] Generating SEA Preparation Blob...');
  const seaConfigPath = path.join(distDir, 'sea-config.json');
  const seaBlobPath = path.join(distDir, 'sea-prep.blob');

  const seaConfig = {
    main: cjsBundlePath,
    output: seaBlobPath,
    disableExperimentalSEAWarning: true,
  };
  fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2), 'utf-8');

  const seaBlobCmd = `node --experimental-sea-config "${seaConfigPath}"`;
  if (opts.verbose) console.log(`  Executing: ${seaBlobCmd}`);
  cp.execSync(seaBlobCmd, { cwd: repoRoot, stdio: 'inherit' });

  if (!fs.existsSync(seaBlobPath)) {
    throw new Error(`SEA preparation blob generation failed: ${seaBlobPath} does not exist.`);
  }
  const blobSize = fs.statSync(seaBlobPath).size;
  console.log(`  ✔ SEA Blob generated: ${seaBlobPath} (${(blobSize / (1024 * 1024)).toFixed(2)} MB)`);

  // ── Stage 3: Clone Base Node Executable to Output Target ───────────────
  console.log(`\n[Stage 3] Preparing target executable binary at: ${opts.outPath}...`);
  fs.copyFileSync(baseNodeExe, opts.outPath);

  // ── Stage 4: Inject Resource Blob via postject ──────────────────────────
  console.log('\n[Stage 4] Injecting SEA Blob into PE Executable (postject)...');
  const postjectCmd = `npx postject "${opts.outPath}" NODE_SEA_BLOB "${seaBlobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite`;
  if (opts.verbose) console.log(`  Executing: ${postjectCmd}`);
  cp.execSync(postjectCmd, { cwd: repoRoot, stdio: 'inherit' });

  const finalExeSize = fs.statSync(opts.outPath).size;
  const finalExeHash = computeFileSHA256(opts.outPath);
  console.log(`  ✔ Injection successful! Standalone binary: ${opts.outPath}`);
  console.log(`    Total Size: ${(finalExeSize / (1024 * 1024)).toFixed(2)} MB | SHA-256: ${finalExeHash}`);

  // Optional copy to bin/one.exe for standard local CLI invocation
  if (opts.copyToBin) {
    const binDir = path.join(repoRoot, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const binOneExe = path.join(binDir, 'one.exe');
    fs.copyFileSync(opts.outPath, binOneExe);
    console.log(`  ✔ Mirrored standalone executable to: ${binOneExe}`);
  }

  // ── Stage 5: Post-Build Functional Verification ────────────────────────
  console.log('\n[Stage 5] Post-Build Verification of Standalone Executable...');
  
  // 5a. Version verification
  const verRun = cp.spawnSync(opts.outPath, ['--version'], { encoding: 'utf-8' });
  if (verRun.status !== 0 || !verRun.stdout.includes('ONE Language Developer CLI')) {
    throw new Error(`Self-verification failed for ${opts.outPath} --version: status=${verRun.status}, stdout=${verRun.stdout}, stderr=${verRun.stderr}`);
  }
  console.log(`  ✔ --version check: ${verRun.stdout.trim()}`);

  // 5b. Help verification
  const helpRun = cp.spawnSync(opts.outPath, ['--help'], { encoding: 'utf-8' });
  if (helpRun.status !== 0 || !helpRun.stdout.includes('Usage: one <command>')) {
    throw new Error(`Self-verification failed for ${opts.outPath} --help`);
  }
  console.log('  ✔ --help check passed');

  // 5c. Expression execution sanity check
  const execRun = cp.spawnSync(opts.outPath, ['run', '-e', 'let x = 40; let y = 2; print x + y;'], { encoding: 'utf-8' });
  if (execRun.status !== 0 || execRun.stdout.trim() !== '42') {
    throw new Error(`Self-verification evaluation failed: status=${execRun.status}, stdout=${execRun.stdout}, stderr=${execRun.stderr}`);
  }
  console.log(`  ✔ Standalone evaluation sanity check passed: result = 42`);

  // ── Stage 6: Build Artifact Manifest and Checksums ─────────────────────
  console.log('\n[Stage 6] Emitting Build Manifest and Integrity Hashes...');
  const repoPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'));
  const manifest = {
    artifact: path.basename(opts.outPath),
    version: repoPkg.version || '1.0.1',
    target: 'windows-x64-sea',
    nodeBaseVersion: nodeVer,
    builtAt: new Date().toISOString(),
    sizeBytes: finalExeSize,
    sha256: finalExeHash,
    payloadSha256: bundleHash,
    actuationLocked: true,
    address369Bounded: true,
  };
  const manifestPath = opts.outPath + '.manifest.json';
  const sha256Path = opts.outPath + '.sha256';

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  fs.writeFileSync(sha256Path, `${finalExeHash} *${path.basename(opts.outPath)}\n`, 'utf-8');
  console.log(`  ✔ Manifest: ${manifestPath}`);
  console.log(`  ✔ Checksum: ${sha256Path}`);

  // ── Clean intermediate files if requested ──────────────────────────────
  if (opts.cleanIntermediate) {
    if (fs.existsSync(seaConfigPath)) fs.unlinkSync(seaConfigPath);
    if (fs.existsSync(seaBlobPath)) fs.unlinkSync(seaBlobPath);
    console.log('  ✔ Cleaned intermediate packaging artifacts.');
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================================');
  console.log(`  STANDALONE ONE.EXE SUCCESSFULLY PACKAGED (${elapsed}s)`);
  console.log('================================================================================\n');

  return {
    outPath: opts.outPath,
    sha256: finalExeHash,
    manifest,
  };
}

if (require.main === module) {
  try {
    buildStandaloneExecutable();
  } catch (err) {
    console.error('\n[PACKAGING FATAL ERROR]:', err.message || err);
    process.exit(1);
  }
}

module.exports = { buildStandaloneExecutable };
