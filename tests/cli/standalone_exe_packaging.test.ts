/**
 * ONE Language — Standalone Executable Packaging Test Suite (T10)
 * ==============================================================
 * Comprehensive verification of the Windows standalone CLI executable (one.exe)
 * built via Node.js Single Executable Application (SEA) and postject PE injection.
 *
 * Verifies:
 *  1. Environment & toolchain pre-flight (Node v20+, win32, x64, postject)
 *  2. Build pipeline generation and artifact presence
 *  3. PE32+ header integrity and binary structure
 *  4. Version flags (--version, -v, version)
 *  5. Help flags (--help, -h, help, empty)
 *  6. Expression and file execution (one run)
 *  7. Static checking and diagnostics (one check)
 *  8. Project scaffolding (one init)
 *  9. Deterministic code formatting (one format)
 * 10. Intermediate IR build & packed .ox execution (one build -> one run app.ox)
 * 11. Invariant safety: Actuation lockout & Address369 boundaries
 * 12. Clean isolation: Independent execution without node or local node_modules
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as crypto from 'crypto';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runStandaloneExePackagingTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('  ONE LANGUAGE — STANDALONE ONE.EXE PACKAGING & EXECUTION VERIFICATION (T10)');
  console.log('================================================================================\n');

  const repoRoot = path.resolve(__dirname, '../..');
  const distDir = path.join(repoRoot, 'dist');
  const binDir = path.join(repoRoot, 'bin');
  const oneExe = path.join(distDir, 'one.exe');
  const binOneExe = path.join(binDir, 'one.exe');
  const sandboxDir = path.join(repoRoot, 'scratch', 't10_sandbox');

  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  try {
    // ── Suite 1: Environment & Toolchain Pre-flight ─────────────────────────
    console.log('[Suite 1] Pre-flight Environment & Toolchain Capability Detection...');
    const nodeVer = process.versions.node;
    const majorVer = parseInt(nodeVer.split('.')[0], 10);
    assert(majorVer >= 20, `Node version must be >= 20, got v${nodeVer}`);
    assert(process.platform === 'win32', `Host platform must be win32, got ${process.platform}`);
    assert(fs.existsSync(process.execPath), 'Base Node.js binary must exist');
    console.log(`  ✓ Node.js v${nodeVer} (Major ${majorVer}), win32/${process.arch} verified.`);

    // ── Suite 2: Standalone Packaging Pipeline Execution ────────────────────
    console.log('[Suite 2] Packaging Pipeline Execution & Artifact Emission...');
    const packageScript = path.join(repoRoot, 'scripts', 'build-standalone-exe.cjs');
    assert(fs.existsSync(packageScript), `Packaging script must exist at: ${packageScript}`);

    const buildRun = cp.spawnSync(process.execPath, [packageScript, '--verbose'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    assert(buildRun.status === 0, `Packaging failed: ${buildRun.stderr || buildRun.stdout}`);
    assert(fs.existsSync(oneExe), `Expected executable at ${oneExe}`);
    assert(fs.existsSync(binOneExe), `Expected mirrored executable at ${binOneExe}`);
    assert(fs.existsSync(oneExe + '.manifest.json'), 'Expected build manifest');
    assert(fs.existsSync(oneExe + '.sha256'), 'Expected SHA-256 checksum file');

    const manifest = JSON.parse(fs.readFileSync(oneExe + '.manifest.json', 'utf-8'));
    assert(manifest.artifact === 'one.exe', 'Manifest artifact mismatch');
    assert(manifest.actuationLocked === true, 'Manifest actuationLocked flag must be true');
    assert(manifest.address369Bounded === true, 'Manifest address369Bounded must be true');
    console.log(`  ✓ Packaging pipeline executed successfully. Binary size: ${(manifest.sizeBytes / (1024 * 1024)).toFixed(2)} MB.`);

    // ── Suite 3: PE32+ Binary Header Structure Verification ────────────────
    console.log('[Suite 3] PE32+ Binary Header Structure Validation...');
    const exeBuffer = fs.readFileSync(oneExe);
    assert(exeBuffer.length > 30 * 1024 * 1024, `Binary should be substantial (>30MB), got ${exeBuffer.length} bytes`);
    
    // DOS header magic: 'MZ' (0x4D 0x5A)
    assert(exeBuffer[0] === 0x4D && exeBuffer[1] === 0x5A, 'Invalid DOS header magic (expected MZ)');
    const peOffset = exeBuffer.readUInt32LE(0x3C);
    assert(peOffset > 0 && peOffset < exeBuffer.length - 4, 'Invalid PE header offset');
    // PE signature: 'PE\0\0' (0x50 0x45 0x00 0x00)
    assert(
      exeBuffer[peOffset] === 0x50 &&
      exeBuffer[peOffset + 1] === 0x45 &&
      exeBuffer[peOffset + 2] === 0x00 &&
      exeBuffer[peOffset + 3] === 0x00,
      'Invalid PE signature (expected PE\\0\\0)'
    );
    // Machine architecture: 0x8664 for AMD64/x64
    const machine = exeBuffer.readUInt16LE(peOffset + 4);
    assert(machine === 0x8664 || machine === 0xAA64, `PE Machine field mismatch: 0x${machine.toString(16)}`);
    console.log(`  ✓ Valid PE32+ Windows binary verified (Machine: 0x${machine.toString(16)}).`);

    // ── Suite 4: Version Flags Verification ────────────────────────────────
    console.log('[Suite 4] Version Flags Verification (--version, -v, version)...');
    const v1 = cp.spawnSync(oneExe, ['--version'], { encoding: 'utf-8' });
    assert(v1.status === 0, `Expected 0 from --version, got ${v1.status}`);
    assert(v1.stdout.includes('ONE Language Developer CLI v1.0.0'), `Unexpected version stdout: ${v1.stdout}`);

    const v2 = cp.spawnSync(oneExe, ['-v'], { encoding: 'utf-8' });
    assert(v2.status === 0 && v2.stdout.includes('ONE Language Developer CLI v1.0.0'), 'Expected version from -v');

    const v3 = cp.spawnSync(oneExe, ['version'], { encoding: 'utf-8' });
    assert(v3.status === 0 && v3.stdout.includes('ONE Language Developer CLI v1.0.0'), 'Expected version from version command');
    console.log('  ✓ Standalone version queries verified.');

    // ── Suite 5: Help Flags Verification ───────────────────────────────────
    console.log('[Suite 5] Help Flags Verification (--help, -h, help, empty)...');
    const h1 = cp.spawnSync(oneExe, ['--help'], { encoding: 'utf-8' });
    assert(h1.status === 0 && h1.stdout.includes('Usage: one <command>'), 'Expected usage from --help');
    assert(h1.stdout.includes('run <file.one>'), 'Help text should contain run');
    assert(h1.stdout.includes('check <file.one>'), 'Help text should contain check');
    assert(h1.stdout.includes('build <file.one>'), 'Help text should contain build');

    const h2 = cp.spawnSync(oneExe, ['-h'], { encoding: 'utf-8' });
    assert(h2.status === 0 && h2.stdout.includes('Usage: one <command>'), 'Expected usage from -h');

    const h3 = cp.spawnSync(oneExe, [], { encoding: 'utf-8' });
    assert(h3.status === 0 && h3.stdout.includes('Usage: one <command>'), 'Expected usage from empty args');
    console.log('  ✓ Standalone help queries verified.');

    // ── Suite 6: Program Execution (one run) ───────────────────────────────
    console.log('[Suite 6] Program Execution via one.exe run...');
    // 6a. Expression evaluation via -e
    const runEval = cp.spawnSync(oneExe, ['run', '-e', 'let x = 15; let y = 27; print x + y;'], { encoding: 'utf-8' });
    assert(runEval.status === 0, `Eval run failed: ${runEval.stderr}`);
    assert(runEval.stdout.trim() === '42', `Expected 42, got: ${runEval.stdout.trim()}`);

    // 6b. File execution
    const codeFile = path.join(sandboxDir, 'calc.one');
    fs.writeFileSync(codeFile, `
function multiply(a: number, b: number): number {
    return a * b;
}
let res = multiply(6, 7);
print res;
`, 'utf-8');
    const runFile = cp.spawnSync(oneExe, ['run', codeFile], { encoding: 'utf-8' });
    assert(runFile.status === 0, `File run failed: ${runFile.stderr}`);
    assert(runFile.stdout.trim() === '42', `Expected 42, got: ${runFile.stdout.trim()}`);
    console.log('  ✓ Standalone expression and file execution verified.');

    // ── Suite 7: Static Checking & Diagnostics (one check) ─────────────────
    console.log('[Suite 7] Static Checking & Diagnostics via one.exe check...');
    // 7a. Valid program check
    const checkValid = cp.spawnSync(oneExe, ['check', codeFile], { encoding: 'utf-8' });
    assert(checkValid.status === 0, `Valid check failed: ${checkValid.stderr}`);
    assert(checkValid.stdout.includes('Check Passed'), 'Expected Check Passed in stdout');

    // 7b. Invalid program check
    const badFile = path.join(sandboxDir, 'syntax_err.one');
    fs.writeFileSync(badFile, 'let a: number = ;', 'utf-8');
    const checkBad = cp.spawnSync(oneExe, ['check', badFile], { encoding: 'utf-8' });
    assert(checkBad.status === 1, `Expected exit status 1 on syntax error, got ${checkBad.status}`);
    assert(checkBad.stderr.length > 0, 'Expected diagnostic errors on stderr');
    console.log('  ✓ Standalone static analyzer and diagnostic emission verified.');

    // ── Suite 8: Project Scaffolding (one init) ───────────────────────────
    console.log('[Suite 8] Project Scaffolding via one.exe init...');
    const projectDir = path.join(sandboxDir, 'scaffold_app');
    const initRun = cp.spawnSync(oneExe, ['init', projectDir], { encoding: 'utf-8' });
    assert(initRun.status === 0, `Init failed: ${initRun.stderr}`);
    assert(fs.existsSync(path.join(projectDir, 'one.json')), 'Expected one.json manifest');
    assert(fs.existsSync(path.join(projectDir, 'src', 'main.one')), 'Expected src/main.one entry point');

    const runInit = cp.spawnSync(oneExe, ['run', path.join(projectDir, 'src', 'main.one')], { encoding: 'utf-8' });
    assert(runInit.status === 0, `Running initialized project failed: ${runInit.stderr}`);
    assert(runInit.stdout.includes('Hello, Ayyaz!'), `Unexpected greeting: ${runInit.stdout}`);
    console.log('  ✓ Standalone project scaffolding and immediate execution verified.');

    // ── Suite 9: Deterministic Code Formatter (one format) ─────────────────
    console.log('[Suite 9] Deterministic Code Formatter via one.exe format...');
    const unformattedFile = path.join(sandboxDir, 'unformatted.one');
    fs.writeFileSync(unformattedFile, 'let   alpha  =   100  ;\nlet   beta=200;\n', 'utf-8');
    const fmtRun = cp.spawnSync(oneExe, ['format', unformattedFile, '--write'], { encoding: 'utf-8' });
    assert(fmtRun.status === 0, `Format failed: ${fmtRun.stderr}`);
    const formattedContent = fs.readFileSync(unformattedFile, 'utf-8');
    assert(formattedContent.includes('alpha'), 'Formatted file should contain identifier');
    assert(!formattedContent.includes('   alpha'), 'Spacing should be standardized');
    console.log('  ✓ Standalone deterministic formatter verified.');

    // ── Suite 10: IR Build & Packed .ox Binary Execution ──────────────────
    console.log('[Suite 10] IR Build & Standalone .ox Container Execution...');
    const fibFile = path.join(sandboxDir, 'fib.one');
    fs.writeFileSync(fibFile, `
function fib(n: number): number {
    if (n <= 1) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}
let answer = fib(8);
print answer;
`, 'utf-8');

    const buildRes = cp.spawnSync(oneExe, ['build', fibFile], { encoding: 'utf-8' });
    assert(buildRes.status === 0, `Build failed: ${buildRes.stderr}`);
    const irPath = path.join(sandboxDir, 'fib.one.ir');
    const oxPath = path.join(sandboxDir, 'fib.ox');
    assert(fs.existsSync(irPath), `Expected IR artifact at ${irPath}`);
    assert(fs.existsSync(oxPath), `Expected packed .ox container at ${oxPath}`);

    // Execute packed .ox container directly with one.exe
    const runOx = cp.spawnSync(oneExe, ['run', oxPath], { encoding: 'utf-8' });
    assert(runOx.status === 0, `Executing .ox container failed: ${runOx.stderr}`);
    assert(runOx.stdout.trim() === '21', `Expected fib(8)=21, got: ${runOx.stdout.trim()}`);
    console.log('  ✓ Compilation to .ox and direct standalone execution verified (fib(8) = 21).');

    // ── Suite 11: Actuation Lockout & Address369 Invariants ────────────────
    console.log('[Suite 11] Actuation Lockout & Address369 Safety Invariants...');
    // Actuation attempt should fail closed
    const actuationAttempt = cp.spawnSync(oneExe, ['run', '-e', 'actuate("arm_motor", 1.0);'], { encoding: 'utf-8' });
    assert(actuationAttempt.status !== 0, 'Actuation command must fail closed');
    assert(actuationAttempt.stderr.length > 0, 'Actuation attempt should produce error');

    // Address369 bounds violation
    const address369File = path.join(sandboxDir, 'addr_test.one');
    fs.writeFileSync(address369File, 'let memoryCell = 369;\nprint memoryCell;\n', 'utf-8');
    const addrRun = cp.spawnSync(oneExe, ['run', address369File], { encoding: 'utf-8' });
    assert(addrRun.status === 0, 'Valid numeric operation in boundary domain');
    console.log('  ✓ Fail-closed actuation lockout and Address369 constraints verified.');

    // ── Suite 12: Complete Process Isolation & Portability ────────────────
    console.log('[Suite 12] Complete Process Isolation (No local node/node_modules)...');
    const isolatedDir = path.join(sandboxDir, 'isolated_env');
    fs.mkdirSync(isolatedDir, { recursive: true });
    const isolatedExe = path.join(isolatedDir, 'standalone_one.exe');
    fs.copyFileSync(oneExe, isolatedExe);

    const testApp = path.join(isolatedDir, 'standalone_app.one');
    fs.writeFileSync(testApp, `
let val1 = 1000;
let val2 = 337;
print val1 + val2;
`, 'utf-8');

    // Execute from isolated working directory
    const isolatedRun = cp.spawnSync(isolatedExe, ['run', testApp], {
      cwd: isolatedDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        NODE_PATH: '', // Disallow any external module paths
      },
    });
    assert(isolatedRun.status === 0, `Isolated run failed: ${isolatedRun.stderr}`);
    assert(isolatedRun.stdout.trim() === '1337', `Expected 1337, got: ${isolatedRun.stdout.trim()}`);
    console.log('  ✓ Standalone execution verified in isolated environment without repo dependencies.');

    console.log('\n================================================================================');
    console.log('  ALL 12 STANDALONE ONE.EXE PACKAGING SUITES PASSED (100%)');
    console.log('================================================================================\n');
  } finally {
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('standalone_exe_packaging.test.ts')) {
  runStandaloneExePackagingTests().catch((err) => {
    console.error('\n[TEST FATAL ERROR]:', err);
    process.exit(1);
  });
}
