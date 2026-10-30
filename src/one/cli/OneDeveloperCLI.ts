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
import { ExecutablePacker } from '../packer/ExecutablePacker';
import { ExecutableLinker } from '../packer/ExecutableLinker';
import { ReasoningSession } from '../intelligence/reasoning/ReasoningSession';
import { Qplayer } from '../../qplayer/index';
import { Echo1Assistant } from '../intelligence/echo/Echo1Assistant';
import { OltoCompiler } from '../../olto/compiler/index';
import { OltoWebBundler, OltoDevServer } from '../../olto/tooling/index';

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
    if (cleanArgs.length > 0 && (
      cleanArgs[0].endsWith('.ts') || 
      cleanArgs[0].endsWith('.js') || 
      cleanArgs[0].endsWith('.cjs') || 
      cleanArgs[0].endsWith('.mjs') || 
      cleanArgs[0] === 'one' ||
      cleanArgs[0].endsWith('/one') ||
      cleanArgs[0].endsWith('\\one') ||
      cleanArgs[0].endsWith('one.exe') ||
      cleanArgs[0].endsWith('one.cmd')
    )) {
      cleanArgs = cleanArgs.slice(1);
    }

    if (cleanArgs.length === 0 || cleanArgs[0] === '--help' || cleanArgs[0] === '-h' || cleanArgs[0] === 'help') {
      log(this.getHelpText());
      return { exitCode: 0, stdout: stdoutLines.join('\n'), stderr: '' };
    }

    if (cleanArgs[0] === '--version' || cleanArgs[0] === '-v' || cleanArgs[0] === 'version') {
      log('ONE Language Developer CLI v1.4.0 (with OLTO Frontend & ECHO-1 AI)');
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
      case 'pack':
        res = this.handleBuild(cmdArgs, log, err);
        break;

      case 'format':
      case 'fmt':
        res = this.handleFormat(cmdArgs, log, err);
        break;

      case 'test':
        res = this.handleTest(cmdArgs, log, err);
        break;

      case 'reason':
        res = this.handleReason(cmdArgs, log, err);
        break;

      case 'ask':
      case 'copilot':
        res = this.handleAsk(cmdArgs, log, err);
        break;

      case 'tutor':
        res = this.handleTutor(cmdArgs, log, err);
        break;

      case 'olto':
        res = this.handleOlto(cmdArgs, log, err);
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
      version: '1.0.0',
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

    return { exitCode: 0, stdout: '', stderr: '' };
  }

  // ── 2. one run ────────────────────────────────────────────────────────────
  public static handleRun(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err("\x1b[31mError:\x1b[0m Missing file to run. Usage: one run <file.one>");
      return { exitCode: 1, stdout: '', stderr: 'Missing file to run' };
    }

    let source = '';
    const firstArg = args[0];
    const isEval = firstArg === '-e' || firstArg === '--eval';

    if (isEval) {
      if (args.length < 2) {
        err("\x1b[31mError:\x1b[0m Missing expression for eval. Usage: one run -e <code>");
        return { exitCode: 1, stdout: '', stderr: 'Missing expression for eval' };
      }
      source = args.slice(1).join(' ');
    } else {
      const filePath = path.resolve(firstArg);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const rawBuf = fs.readFileSync(filePath);
        if (filePath.endsWith('.ox') || (rawBuf.length >= 4 && rawBuf.slice(0, 4).toString('ascii') === 'ONEX')) {
          const runRes = ExecutableLinker.loadAndRun(rawBuf);
          if (!runRes.success || !runRes.vmResult) {
            const errorMsg = `\x1b[31mExecutable Error:\x1b[0m ${runRes.error || runRes.vmResult?.error?.message || 'Execution failed'}`;
            err(errorMsg);
            return { exitCode: 1, stdout: '', stderr: errorMsg };
          }
          for (const line of runRes.vmResult.output) {
            log(line);
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (filePath.endsWith('.obi') || (rawBuf.length >= 4 && rawBuf.slice(0, 4).toString('ascii') === 'OBI1')) {
          const runRes = Qplayer.runBinary(rawBuf);
          if (!runRes.success) {
            const errorMsg = `\x1b[31m[${runRes.error?.code || 'E8000'}] Qplayer Error:\x1b[0m ${runRes.error?.message || 'Execution failed'}`;
            err(errorMsg);
            return { exitCode: 1, stdout: '', stderr: errorMsg };
          }
          for (const line of runRes.output) {
            log(line);
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        source = rawBuf.toString('utf-8');
      } else if (firstArg.endsWith('.one') || firstArg.endsWith('.ir') || (!firstArg.includes(';') && !firstArg.startsWith('let ') && !firstArg.startsWith('const ') && !firstArg.startsWith('fn ') && !firstArg.startsWith('function ') && !firstArg.startsWith('print ') && !firstArg.startsWith('node ') && !firstArg.startsWith('rss_max'))) {
        const errMsg = `\x1b[31mError:\x1b[0m File not found: ${filePath}`;
        err(errMsg);
        return { exitCode: 1, stdout: '', stderr: errMsg };
      } else {
        source = args.join(' ');
      }
    }

    const useQplayer = args.includes('--engine=qplayer') || args.includes('--qplayer');
    if (useQplayer) {
      try {
        const qRes = Qplayer.execute(source);
        if (!qRes.success) {
          const errorMsg = `\x1b[31m[${qRes.error?.code || 'E8000'}] Qplayer Error:\x1b[0m ${qRes.error?.message || 'Execution failed'}`;
          err(errorMsg);
          return { exitCode: 1, stdout: '', stderr: errorMsg };
        }
        for (const line of qRes.output) {
          log(line);
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      } catch (e: any) {
        const errorMsg = `\x1b[31mQplayer Error:\x1b[0m ${e.message || String(e)}`;
        err(errorMsg);
        return { exitCode: 1, stdout: '', stderr: errorMsg };
      }
    }

    try {
      const compiler = new UnifiedCompiler();
      const result = compiler.execute(source);

      if (!result.compilation.success) {
        const formatted = DiagnosticFormatter.formatAll(
          result.compilation.diagnostics as any[],
          source
        );
        const echo = Echo1Assistant.getInstance();
        const firstDiag = result.compilation.diagnostics[0];
        const echoHint = firstDiag ? echo.explainError(firstDiag.code, firstDiag.message) : '';
        const finalError = echoHint ? `${formatted}\n${echoHint}` : formatted;
        err(finalError);
        return { exitCode: 1, stdout: '', stderr: finalError };
      }

      if (result.vmResult) {
        if (!result.vmResult.success && result.vmResult.error) {
          const echo = Echo1Assistant.getInstance();
          const echoHint = echo.explainError(result.vmResult.error.code, result.vmResult.error.message);
          const errorMsg = `\x1b[31m[${result.vmResult.error.code}] Runtime Error:\x1b[0m ${result.vmResult.error.message}\n${echoHint}`;
          err(errorMsg);
          return { exitCode: 1, stdout: '', stderr: errorMsg };
        }

        for (const line of result.vmResult.output) {
          log(line);
        }
      }

      return { exitCode: 0, stdout: '', stderr: '' };
    } catch (e: any) {
      const echo = Echo1Assistant.getInstance();
      const codeMatch = (e.message || '').match(/\[(E\d{4})/);
      const errCode = codeMatch ? codeMatch[1] : 'E1001';
      const echoHint = echo.explainError(errCode, e.message || String(e), source);
      const errMsg = `\x1b[31mCompilation Error:\x1b[0m ${e.message || String(e)}\n${echoHint}`;
      err(errMsg);
      return { exitCode: 1, stdout: '', stderr: errMsg };
    }
  }

  // ── 3. one check ──────────────────────────────────────────────────────────
  public static handleCheck(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err("\x1b[31mError:\x1b[0m Missing file to check. Usage: one check <file.one>");
      return { exitCode: 1, stdout: '', stderr: 'Missing file to check' };
    }

    let source = '';
    const firstArg = args[0];
    const isEval = firstArg === '-e' || firstArg === '--eval';

    let targetName = 'source';
    if (isEval) {
      if (args.length < 2) {
        err("\x1b[31mError:\x1b[0m Missing expression for check. Usage: one check -e <code>");
        return { exitCode: 1, stdout: '', stderr: 'Missing expression for check' };
      }
      source = args.slice(1).join(' ');
    } else {
      const filePath = path.resolve(firstArg);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        source = fs.readFileSync(filePath, 'utf-8');
        targetName = path.basename(filePath);
      } else if (firstArg.endsWith('.one') || firstArg.endsWith('.ir') || (!firstArg.includes(';') && !firstArg.startsWith('let ') && !firstArg.startsWith('const ') && !firstArg.startsWith('fn ') && !firstArg.startsWith('function ') && !firstArg.startsWith('print ') && !firstArg.startsWith('node ') && !firstArg.startsWith('rss_max'))) {
        const errMsg = `\x1b[31mError:\x1b[0m File not found: ${filePath}`;
        err(errMsg);
        return { exitCode: 1, stdout: '', stderr: errMsg };
      } else {
        source = args.join(' ');
      }
    }

    try {
      const compiler = new UnifiedCompiler({ checkOnly: true });
      const result = compiler.compile(source);

      if (!result.success) {
        const formatted = DiagnosticFormatter.formatAll(
          result.diagnostics as any[],
          source
        );
        const echo = Echo1Assistant.getInstance();
        const firstDiag = result.diagnostics[0];
        const echoHint = firstDiag ? echo.explainError(firstDiag.code, firstDiag.message) : '';
        const finalError = echoHint ? `${formatted}\n${echoHint}` : formatted;
        err(finalError);
        return { exitCode: 1, stdout: '', stderr: finalError };
      }

      log(`\x1b[32m✔ [Check Passed]\x1b[0m ${targetName} is valid (0 errors, 0 warnings).`);
      return { exitCode: 0, stdout: '', stderr: '' };
    } catch (e: any) {
      const echo = Echo1Assistant.getInstance();
      const codeMatch = (e.message || '').match(/\[(E\d{4})/);
      const errCode = codeMatch ? codeMatch[1] : 'E1001';
      const echoHint = echo.explainError(errCode, e.message || String(e), source);
      const errMsg = `\x1b[31mCheck Error:\x1b[0m ${e.message || String(e)}\n${echoHint}`;
      err(errMsg);
      return { exitCode: 1, stdout: '', stderr: errMsg };
    }
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
    const isObi = args.includes('--target=obi') || args.includes('--obi');

    if (isObi) {
      try {
        const startMs = performance.now();
        const obiBuf = Qplayer.compileToOBI(source);
        const obiPath = filePath.replace(/\.one$/, '.obi');
        fs.writeFileSync(obiPath, obiBuf);
        const duration = performance.now() - startMs;

        log(`\x1b[32m✔ Qplayer Build Succeeded:\x1b[0m ${path.basename(filePath)}`);
        log(`  - Target:       ${obiPath}`);
        log(`  - Format:       One Binary Intelligence (OBI v1.0)`);
        log(`  - Size:         ${obiBuf.length} bytes`);
        log(`  - Build time:   ${duration.toFixed(2)} ms`);

        return { exitCode: 0, stdout: '', stderr: '' };
      } catch (e: any) {
        const errMsg = `\x1b[31mQplayer Build Error:\x1b[0m ${e.message || String(e)}`;
        err(errMsg);
        return { exitCode: 1, stdout: '', stderr: errMsg };
      }
    }

    try {
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

      const oxPath = filePath.replace(/\.one$/, '.ox');
      const packBuffer = ExecutablePacker.pack(result.ir);
      fs.writeFileSync(oxPath, packBuffer);

      log(`\x1b[32m✔ Build Succeeded:\x1b[0m ${path.basename(filePath)}`);
      log(`  - Target:       ${outPath}`);
      log(`  - Executable:   ${oxPath}`);
      log(`  - Instructions: ${result.ir.instructions.length}`);
      log(`  - Size:         ${packBuffer.length} bytes`);
      log(`  - Build time:   ${result.metrics.totalTimeMs.toFixed(2)} ms`);

      return { exitCode: 0, stdout: '', stderr: '' };
    } catch (e: any) {
      const errMsg = `\x1b[31mBuild Error:\x1b[0m ${e.message || String(e)}`;
      err(errMsg);
      return { exitCode: 1, stdout: '', stderr: errMsg };
    }
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

  /**
   * Handler for 'one reason <spec.json> [--trace] [--json]'
   */
  private static handleReason(
    args: string[],
    log: (msg: string) => void,
    err: (msg: string) => void
  ): DeveloperCLIResult {
    let filePath: string | null = null;
    let showTrace = false;
    let jsonOutput = false;

    for (const a of args) {
      if (a === '--trace') {
        showTrace = true;
      } else if (a === '--json') {
        jsonOutput = true;
      } else if (!a.startsWith('-') && !filePath) {
        filePath = a;
      }
    }

    if (!filePath) {
      err('\x1b[31mError:\x1b[0m Missing task specification file for reasoning.');
      err('Usage: one reason <spec.json> [--trace] [--json]');
      return { exitCode: 1, stdout: '', stderr: '' };
    }

    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      err(`\x1b[31mError:\x1b[0m Reasoning task file '${filePath}' not found.`);
      return { exitCode: 1, stdout: '', stderr: '' };
    }

    try {
      const raw = fs.readFileSync(resolved, 'utf-8');
      const parsed = JSON.parse(raw);

      const input = parsed.input !== undefined ? parsed.input : 0;
      const target = parsed.target !== undefined ? parsed.target : (parsed.goal !== undefined ? parsed.goal : 0);
      const maxSteps = parsed.maxSteps !== undefined ? Number(parsed.maxSteps) : 50;
      const maxCandidates = parsed.maxCandidates !== undefined ? Number(parsed.maxCandidates) : 250;
      const maxDepth = parsed.maxDepth !== undefined ? Number(parsed.maxDepth) : 20;

      const session = new ReasoningSession<number>();

      session.registerRule({
        id: 'increment',
        description: 'Increment integer by 1',
        priority: 5,
        isApplicable: (n: number) => typeof n === 'number' && n < Number(target),
        apply: (n: number) => [Number(n) + 1],
      });
      session.registerRule({
        id: 'decrement',
        description: 'Decrement integer by 1',
        priority: 5,
        isApplicable: (n: number) => typeof n === 'number' && n > Number(target),
        apply: (n: number) => [Number(n) - 1],
      });
      session.registerRule({
        id: 'double',
        description: 'Double integer towards target',
        priority: 10,
        isApplicable: (n: number) => typeof n === 'number' && n > 0 && n * 2 <= Number(target),
        apply: (n: number) => [Number(n) * 2],
      });
      session.registerRule({
        id: 'halve_even',
        description: 'Halve even integer towards target',
        priority: 15,
        isApplicable: (n: number) => typeof n === 'number' && n > Number(target) && n % 2 === 0,
        apply: (n: number) => [Number(n) / 2],
      });

      const bundle = session.solveWithBinaryTrace({
        input: Number(input),
        goal: (n: number) => n === Number(target),
        maxSteps,
        maxCandidates,
        maxDepth,
      });

      if (jsonOutput) {
        log(JSON.stringify({
          status: bundle.result.status,
          isSolved: bundle.result.isSolved,
          bestValue: bundle.result.bestCandidate ? bundle.result.bestCandidate.value : null,
          stepsUsed: bundle.result.metrics.stepsUsed,
          candidatesGenerated: bundle.result.metrics.candidatesGenerated,
          isBitExact: bundle.isBitExact,
          envelopesCount: bundle.solutionEnvelopes.length,
          trace: showTrace ? bundle.result.trace : undefined,
        }, null, 2));
      } else {
        log(`\x1b[32m✔ Reasoning Execution Completed\x1b[0m`);
        log(`  Status:               ${bundle.result.status}`);
        log(`  Solved:               ${bundle.result.isSolved}`);
        log(`  Best Candidate Value: ${bundle.result.bestCandidate ? bundle.result.bestCandidate.value : 'none'}`);
        log(`  Steps Used:           ${bundle.result.metrics.stepsUsed} / ${maxSteps}`);
        log(`  Candidates Generated: ${bundle.result.metrics.candidatesGenerated}`);
        log(`  Binary Trace Exact:   ${bundle.isBitExact}`);
        log(`  Envelopes Emitted:    ${bundle.solutionEnvelopes.length}`);
        if (showTrace) {
          log(`  Trace Events:`);
          for (const ev of bundle.result.trace) {
            log(`    [step ${ev.step}] ${ev.eventType}: ${ev.reasonCode}`);
          }
        }
      }

      return {
        exitCode: bundle.result.isSolved ? 0 : 2,
        stdout: '',
        stderr: '',
      };
    } catch (e: any) {
      err(`\x1b[31mError:\x1b[0m Failed to execute reasoning task: ${e.message}`);
      return { exitCode: 1, stdout: '', stderr: '' };
    }
  }

  // ── 8. one ask ────────────────────────────────────────────────────────────
  public static handleAsk(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      err('\x1b[31mError:\x1b[0m Please provide a prompt or question.');
      err('Usage: one ask "how to define a function?"');
      return { exitCode: 1, stdout: '', stderr: 'Please provide a prompt or question' };
    }

    const echo = Echo1Assistant.getInstance();
    const res = echo.ask(prompt);

    log('\x1b[36m================================================================\x1b[0m');
    log('\x1b[1m\x1b[35m🤖 ECHO-1 Assistant (Offline Sovereign AI)\x1b[0m');
    log('\x1b[36m================================================================\x1b[0m');
    log(`\x1b[32mQuestion:\x1b[0m ${prompt}\n`);
    log(`\x1b[1mAnswer:\x1b[0m ${res.answer}\n`);

    if (res.codeSnippet) {
      log('\x1b[33mExample Code (.one):\x1b[0m');
      log(res.codeSnippet);
      log('');
    }

    if (res.romanUrduTip) {
      log(`\x1b[36m💡 ${res.romanUrduTip}\x1b[0m\n`);
    }

    log(`\x1b[90m[Latency: ${res.latencyMs}ms | Status: ${res.epistemicStatus} | Offline Local CPU]\x1b[0m`);
    log('\x1b[36m================================================================\x1b[0m');
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  // ── 9. one tutor ──────────────────────────────────────────────────────────
  public static handleTutor(args: string[], log: (m: string) => void, _err: (m: string) => void): DeveloperCLIResult {
    const echo = Echo1Assistant.getInstance();
    log('\x1b[36m================================================================\x1b[0m');
    log('\x1b[1m\x1b[35m🎓 ECHO-1 Interactive Learning Shell (Sovereign Offline AI)\x1b[0m');
    log('\x1b[90mModel: 25.75MB Neural Checkpoint | 100% Offline Local Inference\x1b[0m');
    log('\x1b[90mType "exit" or "quit" to leave. Ask anything about ONE Language!\x1b[0m');
    log('\x1b[36m================================================================\x1b[0m\n');

    if (args.length > 0) {
      const q = args.join(' ');
      const res = echo.ask(q);
      log(`\x1b[1m${res.answer}\x1b[0m\n`);
      if (res.codeSnippet) {
        log('\x1b[33m' + res.codeSnippet + '\x1b[0m\n');
      }
      if (res.romanUrduTip) {
        log(`\x1b[36m💡 ${res.romanUrduTip}\x1b[0m\n`);
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    }

    try {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '\x1b[35mecho1>\x1b[0m ',
      });

      rl.prompt();
      rl.on('line', (line: string) => {
        const q = line.trim();
        if (q.toLowerCase() === 'exit' || q.toLowerCase() === 'quit') {
          process.stdout.write('\x1b[32mGoodbye! Keep building with ONE Language.\x1b[0m\n');
          rl.close();
          return;
        }
        if (q) {
          const res = echo.ask(q);
          process.stdout.write(`\n\x1b[1m${res.answer}\x1b[0m\n\n`);
          if (res.codeSnippet) {
            process.stdout.write(`\x1b[33m${res.codeSnippet}\x1b[0m\n\n`);
          }
          if (res.romanUrduTip) {
            process.stdout.write(`\x1b[36m💡 ${res.romanUrduTip}\x1b[0m\n\n`);
          }
        }
        rl.prompt();
      });
    } catch {
      log('Interactive TTY not available. Use: one ask "<question>"');
    }

    return { exitCode: 0, stdout: '', stderr: '' };
  }

  // ── 8. one olto ───────────────────────────────────────────────────────────
  public static handleOlto(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
      log(`
OLTO Frontend CLI — Developer Commands
Usage: one olto <subcommand> [options]

Subcommands:
  check <file.olto>                Parse and validate OLTO component syntax & security rules
  build <file.olto> [options]      Compile OLTO source into a standalone zero-dependency HTML app
  dev   <file.olto> [options]      Start local development server with auto-recompile & live reload
  ai    "<prompt>"  [options]      Generate complete sovereign OLTO application using ECHO-1 AI

Options for 'ai':
  --out, -o <path>                 Save generated source to .olto file

Options for 'build':
  --out, -o <path>                 Output HTML destination (default: dist/<name>.html)
  --theme <dark|light>             Default visual theme (default: dark)
  --title <string>                 Document title (default: component name)

Options for 'dev':
  --port, -p <number>              HTTP port for development server (default: 3000)
  --theme <dark|light>             Default visual theme (default: dark)
`);
      return { exitCode: 0, stdout: '', stderr: '' };
    }

    const sub = args[0].toLowerCase();
    const subArgs = args.slice(1);

    switch (sub) {
      case 'check':
        return this.handleOltoCheck(subArgs, log, err);
      case 'build':
        return this.handleOltoBuild(subArgs, log, err);
      case 'dev':
        return this.handleOltoDev(subArgs, log, err);
      case 'ai':
      case 'generate':
        return this.handleOltoAI(subArgs, log, err);
      default:
        err(`\x1b[31mError:\x1b[0m Unknown OLTO subcommand '${sub}'. Run 'one olto --help' for available subcommands.`);
        return { exitCode: 1, stdout: '', stderr: '' };
    }
  }

  private static handleOltoCheck(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err('\x1b[31mError:\x1b[0m Missing OLTO source file. Usage: one olto check <file.olto>');
      return { exitCode: 1, stdout: '', stderr: '' };
    }

    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath)) {
      err(`\x1b[31mError:\x1b[0m OLTO source file not found: ${filePath}`);
      return { exitCode: 1, stdout: '', stderr: '' };
    }

    try {
      const source = fs.readFileSync(filePath, 'utf-8');
      const res = OltoCompiler.compile(source);

      if (!res.success) {
        err(`\x1b[31mOLTO Diagnostic Check Failed:\x1b[0m ${res.diagnostics.length} issue(s) found in ${path.basename(filePath)}`);
        for (const d of res.diagnostics) {
          err(`  [${d.code}] Line ${d.line}, Col ${d.column}: ${d.message}`);
        }
        return { exitCode: 1, stdout: '', stderr: '' };
      }

      log(`\x1b[32m✓ [OLTO]\x1b[0m Syntax and semantic checks passed for: ${path.basename(filePath)}`);
      if (res.ast && res.ast.declarations.length > 0) {
        const names = res.ast.declarations.map(d => d.name).join(', ');
        const stateCount = res.ast.declarations.reduce((acc, d) => acc + d.state.length, 0);
        const actionCount = res.ast.declarations.reduce((acc, d) => acc + d.actions.length, 0);
        log(`  Declared components: ${names}`);
        log(`  Reactive state count: ${stateCount} | Actions: ${actionCount}`);
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    } catch (e: any) {
      err(`\x1b[31mOLTO Check Exception:\x1b[0m ${e.message}`);
      return { exitCode: 1, stdout: '', stderr: '' };
    }
  }

  private static handleOltoBuild(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err('\x1b[31mError:\x1b[0m Missing OLTO source file. Usage: one olto build <file.olto> [--out <dest.html>]');
      return { exitCode: 1, stdout: '', stderr: '' };
    }

    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath)) {
      err(`\x1b[31mError:\x1b[0m OLTO source file not found: ${filePath}`);
      return { exitCode: 1, stdout: '', stderr: '' };
    }

    let outPath = path.resolve(process.cwd(), 'dist', `${path.basename(filePath, path.extname(filePath))}.html`);
    let theme: 'dark' | 'light' = 'dark';
    let title: string | undefined = undefined;

    for (let i = 1; i < args.length; i++) {
      if ((args[i] === '--out' || args[i] === '-o') && args[i + 1]) {
        outPath = path.resolve(args[i + 1]);
        i++;
      } else if (args[i] === '--theme' && args[i + 1]) {
        theme = args[i + 1].toLowerCase() === 'light' ? 'light' : 'dark';
        i++;
      } else if (args[i] === '--title' && args[i + 1]) {
        title = args[i + 1];
        i++;
      }
    }

    try {
      OltoWebBundler.bundleToFile(filePath, outPath, { theme, title });
      const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(2);
      log(`\x1b[32m✓ [OLTO]\x1b[0m Standalone web application bundled successfully!`);
      log(`  Source: ${path.relative(process.cwd(), filePath) || filePath}`);
      log(`  Output: ${path.relative(process.cwd(), outPath) || outPath} (${sizeKb} KB)`);
      log(`  Theme:  ${theme}`);
      return { exitCode: 0, stdout: '', stderr: '' };
    } catch (e: any) {
      err(`\x1b[31mOLTO Build Error:\x1b[0m ${e.message}`);
      return { exitCode: 1, stdout: '', stderr: '' };
    }
  }

  private static handleOltoDev(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err('\x1b[31mError:\x1b[0m Missing OLTO source file. Usage: one olto dev <file.olto> [--port 3000]');
      return { exitCode: 1, stdout: '', stderr: '' };
    }

    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath)) {
      err(`\x1b[31mError:\x1b[0m OLTO source file not found: ${filePath}`);
      return { exitCode: 1, stdout: '', stderr: '' };
    }

    let port = 3000;
    let theme: 'dark' | 'light' = 'dark';

    for (let i = 1; i < args.length; i++) {
      if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
        const parsed = parseInt(args[i + 1], 10);
        if (!isNaN(parsed) && parsed > 0) port = parsed;
        i++;
      } else if (args[i] === '--theme' && args[i + 1]) {
        theme = args[i + 1].toLowerCase() === 'light' ? 'light' : 'dark';
        i++;
      }
    }

    try {
      const server = new OltoDevServer({
        entryFile: filePath,
        port,
        theme,
        verbose: true,
      });

      // Start server asynchronously; it keeps Node.js event loop alive
      server.start().catch((err: any) => {
        console.error(`[OLTO DevServer Startup Error]`, err);
      });

      log(`\x1b[32m🚀 [OLTO DevServer]\x1b[0m Running at http://localhost:${port}`);
      log(`  Watching: ${filePath}`);
      log(`  Theme:    ${theme}`);
      log(`  Press Ctrl+C to terminate.`);

      return { exitCode: 0, stdout: '', stderr: '' };
    } catch (e: any) {
      err(`\x1b[31mOLTO DevServer Error:\x1b[0m ${e.message}`);
      return { exitCode: 1, stdout: '', stderr: '' };
    }
  }

  private static handleOltoAI(args: string[], log: (m: string) => void, err: (m: string) => void): DeveloperCLIResult {
    if (args.length === 0) {
      err('\x1b[31mError:\x1b[0m Missing prompt for AI application generator. Usage: one olto ai "<prompt>" [--out <file.olto>]');
      return { exitCode: 1, stdout: '', stderr: '' };
    }

    const prompt = args[0];
    let outPath: string | null = null;

    for (let i = 1; i < args.length; i++) {
      if ((args[i] === '--out' || args[i] === '-o') && args[i + 1]) {
        outPath = path.resolve(args[i + 1]);
        i++;
      }
    }

    try {
      const echo1 = Echo1Assistant.getInstance();
      const generated = echo1.generateOltoApp(prompt);

      if (outPath) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, generated.code, 'utf-8');
        log(`\x1b[32m✓ [ECHO-1 AI]\x1b[0m Successfully generated sovereign OLTO application!`);
        log(`  Prompt: "${prompt}"`);
        log(`  Target: ${path.relative(process.cwd(), outPath) || outPath} (${generated.code.length} bytes)`);
        if (generated.repaired) {
          log(`  Status: Auto-repaired and verified by self-healing compiler loop.`);
        }
        log(`\nTo run live: one olto dev "${path.relative(process.cwd(), outPath) || outPath}"`);
      } else {
        log(`\x1b[32m✓ [ECHO-1 AI]\x1b[0m Generated OLTO Application for: "${prompt}"\n`);
        log(generated.code);
        log(`\n\x1b[36mTip:\x1b[0m Save with '--out ${generated.schema.name}.olto' to build or serve.`);
      }

      return { exitCode: 0, stdout: '', stderr: '' };
    } catch (e: any) {
      err(`\x1b[31mECHO-1 Generator Error:\x1b[0m ${e.message}`);
      return { exitCode: 1, stdout: '', stderr: '' };
    }
  }

  public static getHelpText(): string {
    return `
ONE Language Developer CLI (v1.4.0)
Usage: one <command> [options]

Commands:
  init [dir]         Scaffold a new ONE project with manifest and main.one
  run <file.one>     Compile and execute a ONE program on UnifiedVM (or -e <code>)
  check <file.one>   Check program for syntax and type errors without executing
  build <file.one>   Compile program into an intermediate representation artifact
  format <file.one>  Format ONE source file deterministically (--write for in-place)
  test [dir]         Run all *.test.one files in project
  reason <spec.json> Bounded 0/1 binary reasoning session (--trace, --json)
  ask "<prompt>"     Ask embedded offline AI Copilot (ECHO-1) for code or concepts
  tutor [query]      Launch interactive conversational learning terminal with ECHO-1
  olto <subcommand>  Build, validate, or live-serve OLTO reactive frontend web apps

Options:
  -v, --version      Show version number
  -h, --help         Show this help message
`;
  }
}

// Auto-execute if invoked directly as CLI script or via Node SEA standalone executable
if (typeof process !== 'undefined' && process.argv && process.argv.length > 1) {
  let isSea = false;
  try {
    const sea = require('node:sea');
    isSea = typeof sea?.isSea === 'function' && sea.isSea();
  } catch {}

  const scriptPath = process.argv[1] ? path.resolve(process.argv[1]).replace(/\\/g, '/') : '';
  const isDirectCLI = isSea ||
                      scriptPath.endsWith('/OneDeveloperCLI.ts') || 
                      scriptPath.endsWith('/OneDeveloperCLI.js') || 
                      scriptPath.endsWith('/cli-bundle.js') || 
                      scriptPath.endsWith('/cli-bundle.cjs') ||
                      scriptPath.endsWith('/one.cjs') ||
                      scriptPath.endsWith('/one') ||
                      scriptPath.endsWith('/one.exe') ||
                      scriptPath.endsWith('one.exe') ||
                      scriptPath.endsWith('/one.cmd') ||
                      scriptPath.endsWith('/one.ps1');
  if (isDirectCLI) {
    const result = OneDeveloperCLI.run(process.argv.slice(2));
    if (result.stdout) {
      process.stdout.write(result.stdout + '\n');
    }
    if (result.stderr) {
      process.stderr.write(result.stderr + '\n');
    }
    process.exit(result.exitCode);
  }
}
