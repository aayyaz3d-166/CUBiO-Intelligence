/**
 * ONE LANGUAGE v1.0.1 — MINIMAL COMMAND SYNTAX VERIFICATION SUITE
 * ===============================================================
 * Tests the approved command syntax introduced in version 1.0.1:
 *   - one's name = expression;
 *   - one set name = expression;
 *   - one out expression;
 *   - one in name;
 *   - one up name [by expression];
 *   - one down name [by expression];
 *   - one if condition { ... } one else { ... }
 *   - one repeat count { ... }
 *   - one repeat while condition { ... }
 *   - one stop;
 *   - one make name(parameters) { ... }
 *   - one way expression;
 *   - one done;
 *   - left one is right (equality)
 *   - deferred 'one dot' rejection
 *   - backward compatibility with existing single-quoted strings & struct properties
 */

import * as path from 'path';
import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import { OneLexer, TokenType } from '../../src/one/oneLexer';
import { ComputationalParser } from '../../src/one/computational/ComputationalParser';
import { SemanticAnalyzer } from '../../src/one/semantics/SemanticAnalyzer';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runV101CommandSyntaxTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE LANGUAGE v1.0.1 — MINIMAL COMMAND SYNTAX VERIFICATION');
  console.log('='.repeat(80));

  const compiler = new UnifiedCompiler();

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Variable Declaration (`one's name = expression;`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[Suite 1] Variable Declaration (one's)...");
  {
    const src = `
      one's x = 42;
      one's y: int = 100;
      one's message = "hello";
      one out x;
      one out y;
      one out message;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, "one's declaration must compile");
    assert(res.vmResult?.success === true, "one's declaration must execute");
    assert(res.vmResult?.output[0] === '42', 'x should be 42');
    assert(res.vmResult?.output[1] === '100', 'y should be 100');
    assert(res.vmResult?.output[2] === 'hello', 'message should be hello');
    console.log("  ✓ Variable declaration (one's) with and without type annotations verified.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Variable Mutation (`one set name = expression;`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Variable Mutation (one set)...');
  {
    const src = `
      one's counter = 10;
      one set counter = 25;
      one out counter;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one set must compile');
    assert(res.vmResult?.success === true, 'one set must execute');
    assert(res.vmResult?.output[0] === '25', 'counter should be updated to 25');
    console.log('  ✓ Variable mutation (one set) verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Increment & Decrement (`one up`, `one down`, optional `by`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Increment & Decrement (one up / one down [by expression])...');
  {
    const src = `
      one's val = 10;
      one up val;
      one out val; // 11
      one up val by 5;
      one out val; // 16
      one down val;
      one out val; // 15
      one down val by 7;
      one out val; // 8
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one up/down must compile');
    assert(res.vmResult?.success === true, 'one up/down must execute');
    assert(res.vmResult?.output[0] === '11', 'val after up should be 11');
    assert(res.vmResult?.output[1] === '16', 'val after up by 5 should be 16');
    assert(res.vmResult?.output[2] === '15', 'val after down should be 15');
    assert(res.vmResult?.output[3] === '8', 'val after down by 7 should be 8');
    console.log('  ✓ Increment (one up) and decrement (one down) with and without by verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Output (`one out expression;`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Output (one out)...');
  {
    const src = `
      one out "Test Output";
      one out 123 + 456;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one out must compile');
    assert(res.vmResult?.success === true, 'one out must execute');
    assert(res.vmResult?.output[0] === 'Test Output', 'String output correct');
    assert(res.vmResult?.output[1] === '579', 'Computed expression output correct');
    console.log('  ✓ Output (one out) verified for strings and evaluated expressions.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Input (`one in name;`) — Fail-Closed & Multi-Source
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Input (one in) with Mock Inputs & Fail-Closed Safety...');
  {
    // 5.1 FIFO mock queue
    const srcFifo = `
      one in username;
      one in role;
      one out "User: " + username;
      one out "Role: " + role;
    `;
    const resFifo = compiler.execute(srcFifo, {
      mockInputs: ['CyberOne', 'Administrator'],
    });
    assert(resFifo.compilation.success, 'one in must compile');
    assert(resFifo.vmResult?.success === true, 'one in must execute');
    assert(resFifo.vmResult?.output[0] === 'User: CyberOne', 'Input 1 read correctly in FIFO order');
    assert(resFifo.vmResult?.output[1] === 'Role: Administrator', 'Input 2 read correctly in FIFO order');

    // 5.2 Explicitly supplied empty string in mockInputs
    const srcEmptyMock = `
      one in emptyField;
      one out ("Field:[" + emptyField + "]");
    `;
    const resEmptyMock = compiler.execute(srcEmptyMock, {
      mockInputs: [''],
    });
    assert(resEmptyMock.vmResult?.success === true, 'Explicit empty input from mock queue must succeed');
    assert(resEmptyMock.vmResult?.output[0] === 'Field:[]', 'Explicit empty input preserved');

    // 5.3 Explicitly supplied empty string from inputHandler
    const resEmptyHandler = compiler.execute(srcEmptyMock, {
      inputHandler: () => '',
    });
    assert(resEmptyHandler.vmResult?.success === true, 'Explicit empty input from handler must succeed');
    assert(resEmptyHandler.vmResult?.output[0] === 'Field:[]', 'Explicit empty input from handler preserved');

    // 5.4 Queue exhausted -> throws E5012
    const srcExhausted = `
      one in first;
      one in second;
    `;
    const resExhausted = compiler.execute(srcExhausted, {
      mockInputs: ['only_one_supplied'],
    });
    assert(resExhausted.vmResult?.success === false, 'Exhausted mock queue must fail closed');
    assert(resExhausted.vmResult?.error?.code === 'E5012', 'Must fail with E5012 when queue is exhausted');

    // 5.5 Absent handler & empty queue -> throws E5012
    const srcAbsent = `
      one in missingInput;
    `;
    const resAbsent = compiler.execute(srcAbsent);
    assert(resAbsent.vmResult?.success === false, 'Missing input handler & empty queue must fail closed');
    assert(resAbsent.vmResult?.error?.code === 'E5012', 'Must fail with E5012 when no handler or mock input exists');

    // 5.6 inputHandler success when mock queue empty
    const resHandler = compiler.execute(srcAbsent, {
      inputHandler: () => 'DynamicUser',
    });
    assert(resHandler.vmResult?.success === true, 'inputHandler must supply input when mock queue empty');
    assert(resHandler.vmResult?.globals['missingInput'] === 'DynamicUser', 'Input bound from handler');

    // 5.7 inputHandler error propagation
    let handlerThrew = false;
    const resHandlerErr = compiler.execute(srcAbsent, {
      inputHandler: () => {
        throw new Error('Device IO failure during input');
      },
    });
    assert(resHandlerErr.vmResult?.success === false, 'Handler error must cause execution failure');
    assert(
      resHandlerErr.vmResult?.error?.message.includes('Device IO failure'),
      'Handler exception message must propagate'
    );

    // 5.8 Local function variable input vs global variable input
    const srcScope = `
      one in globalVar;
      one make readLocal(): string {
        one in localVar;
        one way localVar;
      }
      one's res = readLocal();
      one out ("global=" + globalVar + ", local=" + res);
    `;
    const resScope = compiler.execute(srcScope, {
      mockInputs: ['GVal', 'LVal'],
    });
    assert(resScope.vmResult?.success === true, 'Input in local and global scopes must succeed');
    assert(resScope.vmResult?.output[0] === 'global=GVal, local=LVal', 'Local and global input values isolated');

    console.log('  ✓ Input (one in) verified: FIFO queue, explicit empty string, E5012 fail-closed, handler, and scope isolation.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Conditionals (`one if` & `one else`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Conditionals (one if ... one else)...');
  {
    const src = `
      one's status = 200;
      one if status one is 200 {
        one out "OK";
      } one else {
        one out "Error";
      }

      one's code = 404;
      one if code one is 200 {
        one out "Success";
      } one else one if code one is 404 {
        one out "Not Found";
      } one else {
        one out "Unknown";
      }
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one if/else must compile');
    assert(res.vmResult?.success === true, 'one if/else must execute');
    assert(res.vmResult?.output[0] === 'OK', 'Consequent branch taken');
    assert(res.vmResult?.output[1] === 'Not Found', 'Chained one else one if branch taken');
    console.log('  ✓ Conditionals with one if, one else, and chained else-if verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Loops — Repeat Count (`one repeat count { ... }`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Loops: Repeat Count (one repeat count)...');
  {
    const src = `
      one's total = 0;
      one repeat 5 {
        one up total;
      }
      one out total;

      one's zeroRun = 0;
      one repeat 0 {
        one up zeroRun;
      }
      one out zeroRun;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one repeat count must compile');
    assert(res.vmResult?.success === true, 'one repeat count must execute');
    assert(res.vmResult?.output[0] === '5', 'Repeated exactly 5 times');
    assert(res.vmResult?.output[1] === '0', 'Zero count does not execute body');
    console.log('  ✓ Loop repeat count verified with dynamic bound and zero-count safety.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 8: Loops — Repeat While (`one repeat while condition { ... }`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 8] Loops: Repeat While (one repeat while condition)...');
  {
    const src = `
      one's n = 1;
      one repeat while n < 8 {
        one set n = n * 2;
      }
      one out n;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one repeat while must compile');
    assert(res.vmResult?.success === true, 'one repeat while must execute');
    assert(res.vmResult?.output[0] === '8', 'While loop terminated when condition became false (8)');
    console.log('  ✓ Loop repeat while verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 9: Loop Break (`one stop;` inside loops)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 9] Loop Break (one stop inside loop)...');
  {
    const src = `
      one's hit = 0;
      one repeat 10 {
        one up hit;
        one if hit one is 3 {
          one stop;
        }
      }
      one out hit;

      one's wHit = 0;
      one repeat while wHit < 100 {
        one up wHit by 10;
        one if wHit one is 30 {
          one stop;
        }
      }
      one out wHit;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one stop inside loops must compile');
    assert(res.vmResult?.success === true, 'one stop inside loops must execute');
    assert(res.vmResult?.output[0] === '3', 'one stop broke repeat count loop at 3');
    assert(res.vmResult?.output[1] === '30', 'one stop broke repeat while loop at 30');
    console.log('  ✓ Loop break (one stop) verified in both repeat count and repeat while loops.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 10: Reject `one stop;` Outside Loop (Canonical Diagnostic Ownership)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 10] Reject one stop Outside Loops (Fail-Closed)...');
  {
    // 10.1 Standard compiler entry point fail-fast with E1016: Syntax Error
    let compileThrew = false;
    let compileErrorMsg = '';
    try {
      compiler.compile('one stop;');
    } catch (err: any) {
      compileThrew = true;
      compileErrorMsg = err.message;
    }
    assert(compileThrew, 'Compilation of one stop outside loop must throw parser error');
    assert(
      compileErrorMsg.includes('[E1016: Syntax Error]'),
      `Expected [E1016: Syntax Error], got: ${compileErrorMsg}`
    );

    // 10.2 Direct parser invocation asserts exact E1016: Syntax Error format
    let parserThrew = false;
    let parserMsg = '';
    try {
      const lexer = new OneLexer('one stop;');
      const tokens = lexer.tokenize();
      const parser = new ComputationalParser(tokens);
      parser.parse();
    } catch (err: any) {
      parserThrew = true;
      parserMsg = err.message;
    }
    assert(parserThrew, "Parser must throw E1016 when 'one stop' is outside loop");
    assert(
      parserMsg.includes('[E1016: Syntax Error]'),
      `Message must have category 'Syntax Error' matching parser convention, got: ${parserMsg}`
    );
    assert(
      parserMsg.includes("'one stop' can only be used inside a loop"),
      'Message must explain loop requirement'
    );

    // 10.3 Verify SemanticAnalyzer emits E3010 if a BreakStatement AST node is passed outside loop
    const analyzer = new SemanticAnalyzer();
    const semResult = analyzer.analyze({
      kind: 'Program',
      body: [{ kind: 'BreakStatement' }],
    });
    assert(!semResult.isValid, 'Semantic analyzer must report invalid for break outside loop');
    assert(
      semResult.diagnostics.some((d) => d.code === 'E3010'),
      "Semantic analyzer must emit diagnostic E3010 for 'one stop' outside loop"
    );
    console.log("  ✓ 'one stop' outside loop rejected fail-closed with consistent E1016 Syntax Error and E3010 AST guard.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 11: Functions & Returns (`one make`, `one way`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 11] Function Declaration & Return (one make / one way)...');
  {
    const src = `
      one make multiply(a: int, b: int): int {
        one way a * b;
      }
      one's product = multiply(6, 7);
      one out product;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one make with one way must compile');
    assert(res.vmResult?.success === true, 'one make with one way must execute');
    assert(res.vmResult?.output[0] === '42', 'Function multiply(6, 7) returned 42');
    console.log('  ✓ Function declaration (one make) and return (one way) verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 12: Void Function & Completion (`one done;`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 12] Void Function Completion (one done)...');
  {
    const src = `
      one's flag = 0;
      one make markComplete() {
        one set flag = 1;
        one done;
      }
      markComplete();
      one out flag;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one make with one done must compile');
    assert(res.vmResult?.success === true, 'one make with one done must execute');
    assert(res.vmResult?.output[0] === '1', 'markComplete executed and returned via one done');
    console.log('  ✓ Void completion (one done) verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 13: Equality Comparison Expression (`left one is right`)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 13] Equality Comparison Expression (one is)...');
  {
    const src = `
      one's a = 15;
      one's b = 15;
      one's c = 20;

      one's eq1 = (a one is b);
      one's eq2 = (a one is c);

      one if a one is b {
        one out "a equals b";
      } one else {
        one out "a does not equal b";
      }

      one if a one is c {
        one out "a equals c";
      } one else {
        one out "a does not equal c";
      }
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'one is equality expression must compile');
    assert(res.vmResult?.success === true, 'one is equality expression must execute');
    assert(res.vmResult?.output[0] === 'a equals b', 'a one is b evaluates true');
    assert(res.vmResult?.output[1] === 'a does not equal c', 'a one is c evaluates false');
    console.log('  ✓ Equality expression (one is) verified in boolean expressions and if conditions.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 14: Deferred `one dot` Rejection
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n[Suite 14] Deferred 'one dot' Rejection (Fail-Closed)...");
  {
    let dotThrew = false;
    let dotMsg = '';
    try {
      const lexer = new OneLexer('one dot 369;');
      const tokens = lexer.tokenize();
      const parser = new ComputationalParser(tokens);
      parser.parse();
    } catch (err: any) {
      dotThrew = true;
      dotMsg = err.message;
    }
    assert(dotThrew, "'one dot' must throw a syntax error");
    assert(
      dotMsg.includes('E1017') && dotMsg.includes('deferred in v1.0.1'),
      `Error must contain E1017 and deferred notice, got: ${dotMsg}`
    );
    console.log("  ✓ 'one dot' deferred in v1.0.1 rejected with E1017 as required.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 15: Backward Compatibility & Invariant Preservation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 15] Backward Compatibility & Address369 Invariant Preservation...');
  {
    // 1. Single-quoted strings with apostrophes
    const strSrc = `
      one's s1 = 'hello world';
      one's s2 = 'one\\'s string test';
      one out s1;
      one out s2;
    `;
    const strRes = compiler.execute(strSrc);
    assert(strRes.compilation.success, 'Single-quoted strings must compile');
    assert(strRes.vmResult?.output[0] === 'hello world', 's1 matched');
    assert(strRes.vmResult?.output[1] === "one's string test", 's2 matched with apostrophe');

    // 2. Keyword property access (spatial.set, etc.)
    const kwPropSrc = `
      struct Config {
        set: int;
        out: int;
      }
      let cfg = Config(10, 20);
      print cfg.set;
      print cfg.out;
    `;
    const kwPropRes = compiler.execute(kwPropSrc);
    assert(kwPropRes.compilation.success, 'Keyword properties in struct must compile');
    assert(kwPropRes.vmResult?.output[0] === '10', 'cfg.set read correctly');
    assert(kwPropRes.vmResult?.output[1] === '20', 'cfg.out read correctly');

    // 3. Address369 invariants
    assert(CanonicalAddress369.TOTAL_ADDRESSES === 369, 'CanonicalAddress369 must have 369 addresses');
    assert(CanonicalAddress369.SPATIAL_START === 26, 'Spatial start address must be 26');
    assert(CanonicalAddress369.SPATIAL_END === 368, 'Spatial end address must be 368');
    assert(CanonicalAddress369.SYMBOLIC_START === 0, 'Symbolic start address must be 0');
    assert(CanonicalAddress369.SYMBOLIC_END === 25, 'Symbolic end address must be 25');

    console.log('  ✓ Single-quoted strings, keyword member properties, and Address369 bounds remain 100% intact.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 16: Development Source-CLI Workflow (Remediation 3)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 16] Development Source-CLI Workflow & Execution...');
  {
    // 16.1 Test direct OneDeveloperCLI execution with new syntax
    const resCliNew = OneDeveloperCLI.run(['run', '-e', "one's x = 42; one out x;"]);
    assert(resCliNew.exitCode === 0, `Expected exitCode 0, got ${resCliNew.exitCode}: ${resCliNew.stderr}`);
    assert(resCliNew.stdout.trim() === '42', `Expected stdout '42', got '${resCliNew.stdout.trim()}'`);

    // 16.2 Test direct OneDeveloperCLI execution with legacy syntax
    const resCliLegacy = OneDeveloperCLI.run(['run', '-e', "let x = 10; print x;"]);
    assert(resCliLegacy.exitCode === 0, `Expected exitCode 0 for legacy syntax, got ${resCliLegacy.exitCode}`);
    assert(resCliLegacy.stdout.trim() === '10', `Expected stdout '10', got '${resCliLegacy.stdout.trim()}'`);

    // 16.3 Test scripts/one-dev.cjs process invocation
    const { execSync } = require('child_process');
    const projectRoot = path.resolve(__dirname, '../../');
    const outNew = execSync('node scripts/one-dev.cjs run -e "one\'s x = 42; one out x;"', {
      encoding: 'utf8',
      cwd: projectRoot,
    });
    assert(outNew.trim() === '42', `Expected dev script output '42', got '${outNew.trim()}'`);

    const outLegacy = execSync('node scripts/one-dev.cjs run -e "let x = 10; print x;"', {
      encoding: 'utf8',
      cwd: projectRoot,
    });
    assert(outLegacy.trim() === '10', `Expected dev script output '10', got '${outLegacy.trim()}'`);

    console.log('  ✓ Development CLI successfully runs new v1.0.1 command syntax and legacy syntax without touching release bundle.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ALL 16 v1.0.1 COMMAND SYNTAX VERIFICATION SUITES PASSED (100%)');
  console.log('='.repeat(80));
}

// Auto-execute when run directly
runV101CommandSyntaxTests();
