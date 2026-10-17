// oneREPL.ts — Interactive REPL for ONE language (fast iteration)
// Addresses: "Developer iteration speed" (Python 100 → ONE needs 20),
//            "Ease of use / DX" (Python 100 → ONE needs 25)
// Provides: read-eval-print loop for interactive ONE language development

import * as readline from 'readline';
import { OneLexer } from './oneLexer';
import { OneParser } from './oneParser';
import { OneCompiler } from './oneCompiler';
import { CubiOVirtualMachine } from '../core/engine/cubioVM';

export class OneREPL {
  private rl: readline.Interface;
  private history: string[] = [];
  private historyIndex: number = -1;
  private running: boolean = true;
  private startTime: number = 0;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'ONE> ',
    });

    this.rl.on('line', (line: string) => {
      this.evaluateLine(line.trim());
    });

    this.rl.on('close', () => {
      console.log('\n👋 Goodbye from ONE Language REPL.');
      this.running = false;
    });
  }

  /**
   * Start the REPL
   */
  public start(): void {
    console.log('══════════════════════════════════════════════════════');
    console.log('  ONE Language Interactive REPL');
    console.log('  Type "exit" to quit, "help" for commands');
    console.log('  Type "clear" to clear the screen');
    console.log('══════════════════════════════════════════════════════');
    this.rl.prompt();

    // Load previous history from file
    try {
      const historyFile = '.one_history';
      if (require('fs').existsSync(historyFile)) {
        const history = require('fs').readFileSync(historyFile, 'utf-8').trim().split('\n');
        this.history = history;
      }
    } catch {
      // ignore history loading errors
    }
  }

  /**
   * Evaluate a single line of ONE language code
   */
  private async evaluateLine(line: string): Promise<void> {
    const self = this;
    if (line === 'exit' || line === 'quit') {
      this.rl.close();
      return;
    }

    if (line === 'help') {
      this.printHelp();
      this.rl.prompt();
      return;
    }

    if (line === 'clear') {
      console.clear();
      this.rl.prompt();
      return;
    }

    if (line === 'history') {
      this.printHistory();
      this.rl.prompt();
      return;
    }

    if (line === '') {
      this.rl.prompt();
      return;
    }

    // Save to history
    this.history.push(line);
    this.historyIndex = -1;
    this.saveHistory();

    // Execute in REPL mode (no compile step needed for quick eval)
    try {
      const start = Date.now();

      // 1. Lex
      const lexer = new OneLexer(line);
      const tokens = lexer.tokenize();
      console.log(`  Tokens: ${tokens.length}`);

      // 2. Parse
      const parser = new OneParser(tokens);
      const ast = parser.parse();
      console.log(`  AST: ${ast.statements.length} statements`);

      // 3. Compile
      const compiler = new OneCompiler(ast);
      const bytecode = compiler.compile();
      console.log(`  Instructions: ${bytecode.instructions.length}`);

      // 4. Execute
      const vm = new CubiOVirtualMachine();
      vm.execute(bytecode);

      const elapsed = Date.now() - this.startTime;
      console.log(`  Result: ✓ Executed in ${elapsed}ms`);
      console.log(`  Variables: ${Object.keys(vm.getVMState().variables).length}`);

      // Show variable states
      const state = vm.getVMState();
      for (const [key, val] of Object.entries(state.variables)) {
        console.log(`    ${key.padEnd(12)} = ${JSON.stringify(val)}`);
      }

    } catch (err: any) {
      const elapsed = Date.now() - this.startTime;
      console.error(`  ❌ Error (${elapsed}ms): ${err.message}`);
    } finally {
      this.rl.prompt();
    }
  }

  /**
   * Print REPL help
   */
  private printHelp(): void {
    console.log('  ONE Language REPL Commands:');
    console.log('  help           - Show this help');
    console.log('  clear          - Clear the screen');
    console.log('  history        - Show command history');
    console.log('  exit / quit    - Exit the REPL');
    console.log('  ───────────────────────');
    console.log('  Interactive ONE language commands (compile first, then run):');
    console.log('  node dist/one/oneCLI.js eval "code"  - Quick eval without REPL');
    console.log('  node dist/one/oneCLI.js compile "file.one"  - Compile to bytecode');
    console.log('  node dist/one/oneCLI.js run "file.one"  - Execute compiled code');
  }

  /**
   * Print command history
   */
  private printHistory(): void {
    console.log('  Command history:');
    this.history.forEach((h, i) => {
      console.log(`    ${i + 1}. ${h}`);
    });
  }

  /**
   * Save command history to file
   */
  private saveHistory(): void {
    try {
      const fs = require('fs');
      fs.writeFileSync('.one_history', this.history.slice(-50).join('\n'));
    } catch {
      // ignore save errors
    }
  }
}

/**
 * Quick eval without REPL
 */
export async function evalOne(code: string): Promise<any> {
  const start = Date.now();

  try {
    // 1. Lex
    const lexer = new OneLexer(code);
    const tokens = lexer.tokenize();

    // 2. Parse
    const parser = new OneParser(tokens);
    const ast = parser.parse();

    // 3. Compile
    const compiler = new OneCompiler(ast);
    const bytecode = compiler.compile();

    // 4. Execute
    const vm = new CubiOVirtualMachine();
    vm.execute(bytecode);

    const elapsed = Date.now() - start;
    console.log(`  Result: ✓ Executed in ${elapsed}ms`);

    return vm.getVMState();
  } catch (err: any) {
    const elapsed = Date.now() - start;
    console.error(`  ❌ Error (${elapsed}ms): ${err.message}`);
    return null;
  }
}
