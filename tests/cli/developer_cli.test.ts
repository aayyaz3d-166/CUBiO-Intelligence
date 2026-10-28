/**
 * ONE Language — Developer CLI Test Suite
 * =======================================
 * Validates the developer command line interface:
 *   - Flags (--version, -v, --help, -h)
 *   - Subcommands (check, run, init, build, format)
 *   - Error handling (missing files, syntax errors, unknown commands)
 *   - Both file-based and in-memory evaluation
 */

import * as fs from 'fs';
import * as path from 'path';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runDeveloperCLITests(): Promise<void> {
  console.log('\n[CLI TEST] Starting ONE Developer CLI Validation Suite...');

  const tempDir = path.resolve(__dirname, '../../scratch/cli_test_sandbox');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // ── Test 1: Version Flags ─────────────────────────────────────────────
    console.log('[CLI TEST 1] Verifying version flags (--version, -v, version)...');
    
    const ver1 = OneDeveloperCLI.run(['--version']);
    assert(ver1.exitCode === 0, `Expected exitCode 0 for --version, got ${ver1.exitCode}`);
    assert(ver1.stdout.includes('ONE Language Developer CLI v1.0.0'), `Unexpected stdout: ${ver1.stdout}`);

    const ver2 = OneDeveloperCLI.run(['-v']);
    assert(ver2.exitCode === 0, `Expected exitCode 0 for -v, got ${ver2.exitCode}`);
    assert(ver2.stdout.includes('ONE Language Developer CLI v1.0.0'), `Unexpected stdout: ${ver2.stdout}`);

    const ver3 = OneDeveloperCLI.run(['version']);
    assert(ver3.exitCode === 0, `Expected exitCode 0 for version command, got ${ver3.exitCode}`);
    assert(ver3.stdout.includes('ONE Language Developer CLI v1.0.0'), `Unexpected stdout: ${ver3.stdout}`);

    // ── Test 2: Help Flags ────────────────────────────────────────────────
    console.log('[CLI TEST 2] Verifying help flags (--help, -h, help, empty)...');

    const help1 = OneDeveloperCLI.run(['--help']);
    assert(help1.exitCode === 0, 'Expected exitCode 0 for --help');
    assert(help1.stdout.includes('Usage: one <command>'), 'Help text should contain usage');
    assert(help1.stdout.includes('run <file.one>'), 'Help text should contain run');
    assert(help1.stdout.includes('check <file.one>'), 'Help text should contain check');

    const help2 = OneDeveloperCLI.run(['-h']);
    assert(help2.exitCode === 0, 'Expected exitCode 0 for -h');

    const help3 = OneDeveloperCLI.run([]);
    assert(help3.exitCode === 0, 'Expected exitCode 0 for empty args');
    assert(help3.stdout.includes('Usage: one <command>'), 'Help text for empty args');

    // ── Test 3: Unknown Command ───────────────────────────────────────────
    console.log('[CLI TEST 3] Verifying unknown command rejection...');
    const unknown = OneDeveloperCLI.run(['foo-bar-baz']);
    assert(unknown.exitCode === 1, 'Expected exitCode 1 for unknown command');
    assert(unknown.stderr.includes("Unknown developer command 'foo-bar-baz'"), 'Error should mention unknown command');

    // ── Test 4: Static Check (one check) ──────────────────────────────────
    console.log('[CLI TEST 4] Verifying static checking (one check)...');
    
    // 4a. Check with missing argument
    const checkEmpty = OneDeveloperCLI.run(['check']);
    assert(checkEmpty.exitCode === 1, 'Expected exitCode 1 for missing check arg');

    // 4b. Check non-existent file
    const checkMissing = OneDeveloperCLI.run(['check', path.join(tempDir, 'does_not_exist.one')]);
    assert(checkMissing.exitCode === 1, 'Expected exitCode 1 for non-existent file');
    assert(checkMissing.stderr.includes('File not found'), 'Stderr should state File not found');

    // 4c. Check valid file
    const validFile = path.join(tempDir, 'valid.one');
    fs.writeFileSync(validFile, 'let a = 10;\nlet b = 20;\nlet sum = a + b;\nprint sum;\n', 'utf-8');
    const checkValid = OneDeveloperCLI.run(['check', validFile]);
    assert(checkValid.exitCode === 0, `Expected exitCode 0 for valid file check: ${checkValid.stderr}`);
    assert(checkValid.stdout.includes('Check Passed'), 'Stdout should report Check Passed');

    // 4d. Check inline expression via -e
    const checkEval = OneDeveloperCLI.run(['check', '-e', 'function f(x: number): number { return x * 2; }']);
    assert(checkEval.exitCode === 0, `Expected exitCode 0 for -e check: ${checkEval.stderr}`);
    assert(checkEval.stdout.includes('Check Passed'), 'Stdout should report Check Passed');

    // 4e. Check syntax error file
    const invalidFile = path.join(tempDir, 'invalid.one');
    fs.writeFileSync(invalidFile, 'let a = ;', 'utf-8');
    const checkInvalid = OneDeveloperCLI.run(['check', invalidFile]);
    assert(checkInvalid.exitCode === 1, 'Expected exitCode 1 for syntax error');
    assert(checkInvalid.stderr.length > 0, 'Stderr should contain syntax error diagnostic');

    // ── Test 5: Execution (one run) ───────────────────────────────────────
    console.log('[CLI TEST 5] Verifying execution (one run)...');

    // 5a. Run with missing argument
    const runEmpty = OneDeveloperCLI.run(['run']);
    assert(runEmpty.exitCode === 1, 'Expected exitCode 1 for missing run arg');

    // 5b. Run non-existent file
    const runMissing = OneDeveloperCLI.run(['run', path.join(tempDir, 'does_not_exist.one')]);
    assert(runMissing.exitCode === 1, 'Expected exitCode 1 for non-existent file');
    assert(runMissing.stderr.includes('File not found'), 'Stderr should state File not found');

    // 5c. Run valid file
    const runValid = OneDeveloperCLI.run(['run', validFile]);
    assert(runValid.exitCode === 0, `Expected exitCode 0 for valid run: ${runValid.stderr}`);
    assert(runValid.stdout.trim() === '30', `Expected output '30', got: '${runValid.stdout.trim()}'`);

    // 5d. Run inline expression via -e
    const runEval = OneDeveloperCLI.run(['run', '-e', 'let x = 100; let y = 23; print x - y;']);
    assert(runEval.exitCode === 0, `Expected exitCode 0 for -e run: ${runEval.stderr}`);
    assert(runEval.stdout.trim() === '77', `Expected output '77', got: '${runEval.stdout.trim()}'`);

    // 5e. Run function and string concat
    const fnFile = path.join(tempDir, 'greet.one');
    fs.writeFileSync(fnFile, 'function greet(n: string): string { return "Hello, " + n + "!"; }\nprint greet("ONE");\n', 'utf-8');
    const runFn = OneDeveloperCLI.run(['run', fnFile]);
    assert(runFn.exitCode === 0, `Expected exitCode 0 for function run: ${runFn.stderr}`);
    assert(runFn.stdout.trim() === 'Hello, ONE!', `Expected output 'Hello, ONE!', got: '${runFn.stdout.trim()}'`);

    // ── Test 6: Scaffolding (one init) ────────────────────────────────────
    console.log('[CLI TEST 6] Verifying project scaffolding (one init)...');
    const projectDir = path.join(tempDir, 'my_project');
    const initRes = OneDeveloperCLI.run(['init', projectDir]);
    assert(initRes.exitCode === 0, `Expected exitCode 0 for init: ${initRes.stderr}`);
    assert(fs.existsSync(path.join(projectDir, 'one.json')), 'one.json manifest should exist');
    assert(fs.existsSync(path.join(projectDir, 'src', 'main.one')), 'src/main.one should exist');

    // Run the initialized project main.one
    const runProject = OneDeveloperCLI.run(['run', path.join(projectDir, 'src', 'main.one')]);
    assert(runProject.exitCode === 0, `Expected exitCode 0 running initialized project: ${runProject.stderr}`);
    assert(runProject.stdout.includes('Hello, Ayyaz!'), `Expected greeting, got: ${runProject.stdout}`);

    // ── Test 7: Build IR (one build) ──────────────────────────────────────
    console.log('[CLI TEST 7] Verifying IR artifact emission (one build)...');
    const buildRes = OneDeveloperCLI.run(['build', validFile]);
    assert(buildRes.exitCode === 0, `Expected exitCode 0 for build: ${buildRes.stderr}`);
    const irFile = path.join(tempDir, 'valid.one.ir');
    assert(fs.existsSync(irFile), `Expected IR file at ${irFile}`);
    const irContent = fs.readFileSync(irFile, 'utf-8');
    assert(irContent.includes('CONST') && irContent.includes('PRINT'), 'IR file should contain instructions');

    // ── Test 8: Code Formatting (one format) ──────────────────────────────
    console.log('[CLI TEST 8] Verifying deterministic code formatter (one format)...');
    const unformatted = 'let    a=10;\nlet   b   =   20;\n';
    const fmtFile = path.join(tempDir, 'unformatted.one');
    fs.writeFileSync(fmtFile, unformatted, 'utf-8');
    const fmtRes = OneDeveloperCLI.run(['format', fmtFile, '--write']);
    assert(fmtRes.exitCode === 0, `Expected exitCode 0 for format: ${fmtRes.stderr}`);
    const formattedContent = fs.readFileSync(fmtFile, 'utf-8');
    assert(formattedContent.length > 0, 'Formatted file should not be empty');

    console.log('\n[CLI TEST] ✔ All 8 Developer CLI test categories passed successfully!\n');
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
