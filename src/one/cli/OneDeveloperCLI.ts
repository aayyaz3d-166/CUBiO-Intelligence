/**
 * ONE Language — Developer Command Line Interface (CLI)
 * =======================================================
 * Implements the standard developer workflow:
 *   one init [dir]         - Scaffold a new ONE Language project with manifest and main.one
 *   one run <file.one>     - Compile and execute ONE source file on UnifiedVM
 *   one check <file.one>   - Perform static checks (syntax, semantics, types) without running
 *   one build <file.one>   - Compile ONE source file into an IR artifact
 *   one format <file.one>  - Format ONE source code deterministically (--write for in-place)
 *   one test [dir]         - Discover and execute *.test.one test suites
 */

import * as fs from 'fs';
import * as path from 'path';
import { UnifiedCompiler } from '../UnifiedCompiler';
import { OneFormatter } from '../formatter/OneFormatter';
import { DiagnosticFormatter } from '../diagnostics/DiagnosticFormatter';

export interface DeveloperCLIResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class OneDeveloperCLI {
  /**
   * Main dispatch entry point for developer CLI commands.
   */
  public static run(args: string[]): DeveloperCLIResult {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    const log = (msg: string) => stdoutLines.push(msg);
    const err = (msg: string) => stderrLines.push(msg);

    // Normalize arguments (strip node / script path if passed from process.argv)
    let cleanArgs = args;
    if (cleanArgs.length > 0 && (cleanArgs[0].endsWith('node') || cleanArgs[0].endsWith('node.exe'))) {
      cleanArgs = cleanArgs.slice(1);
    }
    if (cleanArgs.length > 0 && (cleanArgs[0].endsWith('.ts') || cleanArgs[0].endsWith('.js') || cleanArgs[0] === 'one')) {
      cleanArgs = cleanArgs.slice(1);
    }

    if (cleanArgs.length === 0 || cleanArgs[0] === '--help' || cleanArgs[0] === '-h') {
      log(this.getHelpText());
      return { exitCode: 0, stdout: stdoutLines.join('\n'), stderr: '' };
    }

    const command = cleanArgs[0].toLowerCase();
    const cmdArgs = cleanArgs.slice(1);
    let res: DeveloperCLIResult;

    switch (command) {
      case 'init':
        res = this.handleInit(cmdArgs, log, err);
        break;

      case 'run':
        res = this.handleRun(cmdArgs, log, err);
        break;

      case 'check':
        res = this.handleCheck(cmdArgs, log, err);
        break;

      case 'build':
        res = this.handleBuild(cmdArgs, log, err);
        break;

      case 'format':
      case 'fmt':
        res = this.handleFormat(cmdArgs, log, err);
        break;

      case 'test':
        res = this.handleTest(cmdArgs, log, err);
        break;

      default:
        err(`\x1b[31mError:\x1b[0m Unknown developer command '${command}'.`);
        err("Run 'one --help' for available developer commands.");
        return { exitCode: 1, stdout: '', stderr: stderrLines.join('\n') };
    }

    return {
      exitCode: res.exitCode,
      stdout: res.stdout || stdoutLines.join('\n'),
      stderr: res.stderr || stderrLines.join('\n'),
    };
  }

  // ── 1. one init ───────────────────────────────────────────────────────────
  public static handleInit(args: string[], log: (m: string) => void, _err: (m: string) => void): DeveloperCLIResult {
    const targetDir = path.resolve(args[0] || '.');
    const manifestPath = path.join(targetDir, 'one.json');
    const srcDir = path.join(targetDir, 'src');
    const mainPath = path.join(srcDir, 'main.one');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }

    const manifest = {
      name: path.basename(targetDir) || 'one-project',
      version: '0.1.0',
      entry: 'src/main.one',
      description: 'A sovereign ONE Language computational project',
    };

    const starterCode = `// ONE Language — Entry Point
function greet(name: string): string {
    return "Hello, " + name + "!"
}

let user = "Ayyaz"
let message = greet(user)
print message
`;

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    fs.writeFileSync(mainPath, starterCode, 'utf-8');

    log(`\x1b[32m✔ Initialized ONE Language project in:\x1b[0m ${targetDir}`);
    log(`  - Manifest: one.json`);
    log(`  - Entry:    src/main.one`);
    log(`\nRun your project:\n  one run src/main.one`);

    return { exitCode: 0, stdout: log.name, stderr: '' };
  }

  // ── 2. one run ────────────────────────────────────────────────────────────
  public static handleRun(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err("\x1b[31mError:\x1b[0m Missing file to run. Usage: one run <file.one>");
      return { exitCode: 1, stdout: '', stderr: 'Missing file to run' };
    }

    let source = '';
    const filePath = path.resolve(args[0]);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      source = fs.readFileSync(filePath, 'utf-8');
    } else {
      // Allow passing direct source string for in-memory execution / testing
      source = args.join(' ');
    }

    const compiler = new UnifiedCompiler();
    const result = compiler.execute(source);

    if (!result.compilation.success) {
      const formatted = DiagnosticFormatter.formatAll(
        result.compilation.diagnostics as any[],
        source
      );
      err(formatted);
      return { exitCode: 1, stdout: '', stderr: formatted };
    }

    if (result.vmResult) {
      if (!result.vmResult.success && result.vmResult.error) {
        const errorMsg = `\x1b[31m[${result.vmResult.error.code}] Runtime Error:\x1b[0m ${result.vmResult.error.message}`;
        err(errorMsg);
        return { exitCode: 1, stdout: '', stderr: errorMsg };
      }

      for (const line of result.vmResult.output) {
        log(line);
      }
    }

    return { exitCode: 0, stdout: '', stderr: '' };
  }

  // ── 3. one check ──────────────────────────────────────────────────────────
  public static handleCheck(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err("\x1b[31mError:\x1b[0m Missing file to check. Usage: one check <file.one>");
      return { exitCode: 1, stdout: '', stderr: 'Missing file to check' };
    }

    let source = '';
    const filePath = path.resolve(args[0]);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      source = fs.readFileSync(filePath, 'utf-8');
    } else {
      source = args.join(' ');
    }

    const compiler = new UnifiedCompiler({ checkOnly: true });
    const result = compiler.compile(source);

    if (!result.success) {
      const formatted = DiagnosticFormatter.formatAll(
        result.diagnostics as any[],
        source
      );
      err(formatted);
      return { exitCode: 1, stdout: '', stderr: formatted };
    }

    const targetName = fs.existsSync(filePath) ? path.basename(filePath) : 'source';
    log(`\x1b[32m✔ [Check Passed]\x1b[0m ${targetName} is valid (0 errors, 0 warnings).`);
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  // ── 4. one build ──────────────────────────────────────────────────────────
  public static handleBuild(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err("\x1b[31mError:\x1b[0m Missing file to build. Usage: one build <file.one>");
      return { exitCode: 1, stdout: '', stderr: 'Missing file to build' };
    }

    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      err(`\x1b[31mError:\x1b[0m File not found: ${filePath}`);
      return { exitCode: 1, stdout: '', stderr: 'File not found' };
    }

    const source = fs.readFileSync(filePath, 'utf-8');
    const compiler = new UnifiedCompiler({ emitIR: true });
    const result = compiler.compile(source);

    if (!result.success || !result.ir) {
      const formatted = DiagnosticFormatter.formatAll(
        result.diagnostics as any[],
        source
      );
      err(formatted);
      return { exitCode: 1, stdout: '', stderr: formatted };
    }

    const outPath = filePath.replace(/\.one$/, '.one.ir');
    fs.writeFileSync(outPath, result.irText || '', 'utf-8');

    log(`\x1b[32m✔ Build Succeeded:\x1b[0m ${path.basename(filePath)}`);
    log(`  - Target:       ${outPath}`);
    log(`  - Instructions: ${result.ir.instructions.length}`);
    log(`  - Build time:   ${result.metrics.totalTimeMs.toFixed(2)} ms`);

    return { exitCode: 0, stdout: '', stderr: '' };
  }

  // ── 5. one format ─────────────────────────────────────────────────────────
  public static handleFormat(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err("\x1b[31mError:\x1b[0m Missing file to format. Usage: one format <file.one> [--write]");
      return { exitCode: 1, stdout: '', stderr: 'Missing file to format' };
    }

    const filePath = path.resolve(args[0]);
    let source = '';
    const isFile = fs.existsSync(filePath) && fs.statSync(filePath).isFile();

    if (isFile) {
      source = fs.readFileSync(filePath, 'utf-8');
    } else {
      source = args[0];
    }

    const shouldWrite = args.includes('--write') || args.includes('-w');
    const formatted = OneFormatter.format(source);

    if (shouldWrite && isFile) {
      fs.writeFileSync(filePath, formatted, 'utf-8');
      log(`\x1b[32m✔ Formatted in-place:\x1b[0m ${filePath}`);
    } else {
      log(formatted);
    }

    return { exitCode: 0, stdout: '', stderr: '' };
  }

  // ── 6. one test ───────────────────────────────────────────────────────────
  public static handleTest(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    const targetDir = path.resolve(args[0] || '.');
    if (!fs.existsSync(targetDir)) {
      err(`\x1b[31mError:\x1b[0m Directory not found: ${targetDir}`);
      return { exitCode: 1, stdout: '', stderr: 'Directory not found' };
    }

    const testFiles: string[] = [];
    const walk = (d: string) => {
      for (const item of fs.readdirSync(d)) {
        const full = path.join(d, item);
        if (fs.statSync(full).isDirectory() && item !== 'node_modules' && item !== '.git') {
          walk(full);
        } else if (item.endsWith('.test.one')) {
          testFiles.push(full);
        }
      }
    };
    walk(targetDir);

    log(`\n════════════════════════════════════════════════════════════════`);
    log(`  ONE LANGUAGE TEST RUNNER`);
    log(`════════════════════════════════════════════════════════════════\n`);

    if (testFiles.length === 0) {
      log(`No *.test.one test files found in ${targetDir}`);
      return { exitCode: 0, stdout: '', stderr: '' };
    }

    let passedCount = 0;
    let failedCount = 0;
    const compiler = new UnifiedCompiler();

    for (const testFile of testFiles) {
      const relName = path.relative(process.cwd(), testFile);
      const source = fs.readFileSync(testFile, 'utf-8');
      const res = compiler.execute(source);

      if (res.compilation.success && res.vmResult?.success) {
        log(`  \x1b[32mPASS\x1b[0m ${relName}`);
        passedCount++;
      } else {
        log(`  \x1b[31mFAIL\x1b[0m ${relName}`);
        failedCount++;
      }
    }

    log(`\nResult: ${passedCount} passed, ${failedCount} failed (${testFiles.length} total)\n`);
    return { exitCode: failedCount > 0 ? 1 : 0, stdout: '', stderr: '' };
  }

  public static getHelpText(): string {
    return `
ONE Language Developer CLI (v0.1)
Usage: one <command> [options]

Commands:
  init [dir]         Scaffold a new ONE project with manifest and main.one
  run <file.one>     Compile and execute a ONE program on UnifiedVM
  check <file.one>   Check program for syntax and type errors without executing
  build <file.one>   Compile program into an intermediate representation artifact
  format <file.one>  Format ONE source file deterministically (--write for in-place)
  test [dir]         Run all *.test.one files in project

Options:
  -h, --help         Show this help message
`;
  }
}
