import assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { OneLexer, TokenType } from '../../src/one/oneLexer';
import { ComputationalParser } from '../../src/one/computational/ComputationalParser';
import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import { ModuleResolver } from '../../src/one/modules/ModuleResolver';
import { ModuleGraph } from '../../src/one/modules/ModuleGraph';
import { VIGCompilationCache } from '../../src/one/vig/VIGCompilationCache';
import { VIGASTExtractor } from '../../src/one/vig/VIGASTExtractor';
import { VIGSecurityGuard } from '../../src/one/vig/VIGSecurityGuard';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';

export function runMultiFileModulesTests(): void {
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — MULTI-FILE MODULE & NAMESPACE RESOLUTION VERIFICATION');
  console.log('================================================================================\n');

  const projectRoot = path.resolve('.');

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 1: Grammar & Parser Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 1] Grammar & Parser Verification (module, export, import)...');
  {
    const source = `
      module Geometry.Shapes;

      export fn calculateArea(width: Int32, height: Int32): Int32 {
        return width * height;
      }

      export struct Point {
        x: Int32,
        y: Int32
      }

      export enum Color {
        Red = 1,
        Green = 2,
        Blue = 3
      }

      export let SCALE = 10;
      export const OFFSET: Int32 = 5;

      let internalA = 1;
      let internalB = 2;
      export { internalA, internalB as aliasB };

      import "./math" as Math;
      import { add, sub as subtract } from "./calculator";
      import "./runtime";
    `;

    const lexer = new OneLexer(source);
    const tokens = lexer.tokenize();

    assert(tokens.some(t => t.type === TokenType.KEYWORD_MODULE), 'Expected KEYWORD_MODULE');
    assert(tokens.some(t => t.type === TokenType.KEYWORD_EXPORT), 'Expected KEYWORD_EXPORT');
    assert(tokens.some(t => t.type === TokenType.KEYWORD_IMPORT), 'Expected KEYWORD_IMPORT');

    const parser = new ComputationalParser(tokens);
    const ast = parser.parse();

    assert.strictEqual(ast.kind, 'Program');
    assert(ast.body.length >= 7, 'Expected parsed statements in AST body');

    const modDecl = ast.body.find(s => s.kind === 'ModuleDeclaration') as any;
    assert(modDecl, 'Expected ModuleDeclaration');
    assert.strictEqual(modDecl.name, 'Geometry.Shapes');

    const exports = ast.body.filter(s => s.kind === 'ExportStatement') as any[];
    assert.strictEqual(exports.length, 6, 'Expected 6 ExportStatements');

    const imports = ast.body.filter(s => s.kind === 'ImportStatement') as any[];
    assert.strictEqual(imports.length, 3, 'Expected 3 ImportStatements');

    // Namespace import
    const nsImport = imports.find(i => i.alias === 'Math');
    assert(nsImport, 'Expected namespace import as Math');
    assert.strictEqual(nsImport.isNamespace, true);
    assert.strictEqual(nsImport.moduleName, './math');

    // Named import
    const namedImport = imports.find(i => i.moduleName === './calculator');
    assert(namedImport, 'Expected named import from ./calculator');
    assert(namedImport.specifiers && namedImport.specifiers.length === 2);
    assert.strictEqual(namedImport.specifiers[0].name, 'add');
    assert.strictEqual(namedImport.specifiers[1].name, 'sub');
    assert.strictEqual(namedImport.specifiers[1].alias, 'subtract');

    console.log('  ✓ Module declaration, export declarations, and all import variants parsed correctly.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 2: Multi-File Named Import Compilation & Execution
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 2] Multi-File Named Import Compilation & Execution...');
  {
    const virtualFiles = new Map<string, string>([
      [
        'src/math_helper.one',
        `
        export fn add(a: Int32, b: Int32): Int32 {
          return a + b;
        }

        export fn multiply(a: Int32, b: Int32): Int32 {
          return a * b;
        }
        `,
      ],
      [
        'src/main.one',
        `
        import { add, multiply } from "./math_helper";

        let sum = add(15, 25);
        let product = multiply(sum, 2);
        print product;
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();
    const result = compiler.executeMultiFile('src/main.one', {
      projectRoot,
      virtualFiles,
    });

    assert.strictEqual(result.success, true, 'Expected compilation and execution success');
    assert(result.vmResult, 'Expected VMExecutionResult');
    assert.strictEqual(result.vmResult.success, true);
    assert.deepStrictEqual(result.vmResult.output, ['80']);

    console.log('  ✓ Multi-file program with named imports compiled and executed cleanly (output: 80).');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 3: Multi-File Namespace Import Compilation & Execution
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 3] Multi-File Namespace Import Compilation & Execution...');
  {
    const virtualFiles = new Map<string, string>([
      [
        'lib/calc.one',
        `
        export fn powerOfTwo(n: Int32): Int32 {
          let res = 1;
          let i = 0;
          while (i < n) {
            res = res * 2;
            i = i + 1;
          }
          return res;
        }

        export let BASE = 100;
        `,
      ],
      [
        'app/entry.one',
        `
        import "../lib/calc" as Calc;

        let p = Calc.powerOfTwo(5);
        let b = Calc.BASE;
        let total = p + b;
        print total;
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();
    const result = compiler.executeMultiFile('app/entry.one', {
      projectRoot,
      virtualFiles,
    });

    assert.strictEqual(result.success, true, 'Expected compilation and execution success');
    assert(result.vmResult, 'Expected VMExecutionResult');
    assert.strictEqual(result.vmResult.success, true);
    // 2^5 = 32, 32 + 100 = 132
    assert.deepStrictEqual(result.vmResult.output, ['132']);

    console.log('  ✓ Multi-file program with namespace import (Calc.powerOfTwo, Calc.BASE) executed cleanly (output: 132).');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 4: Cross-Module Struct & Enum Sharing
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 4] Cross-Module Struct & Enum Semantic Lowering...');
  {
    const virtualFiles = new Map<string, string>([
      [
        'models/types.one',
        `
        export struct Vector2 {
          x: Int32,
          y: Int32
        }

        export enum Quadrant {
          First = 1,
          Second = 2,
          Third = 3,
          Fourth = 4
        }

        export fn getManhattanDist(v: Vector2): Int32 {
          return v.x + v.y;
        }
        `,
      ],
      [
        'main.one',
        `
        import { Vector2, Quadrant, getManhattanDist } from "./models/types";

        let vec = Vector2 { x: 30, y: 40 };
        let dist = getManhattanDist(vec);
        let q = Quadrant.First;

        print dist;
        print q;
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();
    const result = compiler.executeMultiFile('main.one', {
      projectRoot,
      virtualFiles,
    });

    assert.strictEqual(result.success, true, 'Expected compilation and execution success');
    assert(result.vmResult, 'Expected VMExecutionResult');
    assert.strictEqual(result.vmResult.success, true);
    assert.deepStrictEqual(result.vmResult.output, ['70', '1']);

    console.log('  ✓ Cross-module struct instantiation and enum variants passed semantic lowering and execution.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 5: Project-Root Containment & Path Traversal Rejection (E4001)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 5] Project-Root Containment & Path Traversal Rejection (E4001)...');
  {
    const virtualFiles = new Map<string, string>([
      [
        'main.one',
        `
        import "../../escaped_module" as Secret;
        let x = 1;
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();
    const result = compiler.compileMultiFile('main.one', {
      projectRoot,
      virtualFiles,
    });

    assert.strictEqual(result.success, false, 'Path traversal outside root must fail');
    const diag = result.diagnostics.find(d => d.code === 'E4001');
    assert(diag, 'Expected diagnostic E4001 for path traversal');
    assert(diag.message.includes('outside authorized project root'), 'Diagnostic message must mention containment');

    // Poison null byte test
    const resolver = new ModuleResolver({ projectRoot });
    const nullByteRes = resolver.resolve('module\0.one', 'main.one');
    assert.strictEqual(nullByteRes.success, false);
    assert.strictEqual(nullByteRes.errorCode, 'E4001');

    console.log('  ✓ Path traversal outside project root and poison null bytes rejected fail-closed with E4001.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 6: Missing Module Resolution Diagnostics (E4002)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 6] Missing Module Resolution Diagnostics (E4002)...');
  {
    const virtualFiles = new Map<string, string>([
      [
        'main.one',
        `
        import "./missing_dependency" as Missing;
        let x = 1;
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();
    const result = compiler.compileMultiFile('main.one', {
      projectRoot,
      virtualFiles,
    });

    assert.strictEqual(result.success, false, 'Missing module must fail compilation');
    const diag = result.diagnostics.find(d => d.code === 'E4002');
    assert(diag, 'Expected diagnostic E4002 for missing module');
    assert(diag.message.includes("Module not found: './missing_dependency'"));

    console.log('  ✓ Non-existent module specifiers fail closed with E4002 diagnostic.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 7: Duplicate Export Detection (E4003)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 7] Duplicate Export Detection (E4003)...');
  {
    const virtualFiles = new Map<string, string>([
      [
        'dupe.one',
        `
        export fn calculate(): Int32 {
          return 1;
        }

        export fn calculate(): Int32 {
          return 2;
        }
        `,
      ],
      [
        'main.one',
        `
        import "./dupe" as D;
        let res = D.calculate();
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();
    const result = compiler.compileMultiFile('main.one', {
      projectRoot,
      virtualFiles,
    });

    assert.strictEqual(result.success, false, 'Duplicate exports must fail compilation');
    const diag = result.diagnostics.find(d => d.code === 'E4003');
    assert(diag, 'Expected diagnostic E4003 for duplicate export');
    assert(diag.message.includes("Duplicate export of symbol 'calculate'"));

    console.log('  ✓ Duplicate export of the same symbol in a module rejected with E4003.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 8: Circular Module Dependency Detection (E4004)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 8] Circular Module Dependency Detection (E4004)...');
  {
    // A -> B -> C -> A
    const virtualFiles = new Map<string, string>([
      [
        'a.one',
        `
        import "./b" as B;
        export fn fromA(): Int32 { return 10; }
        `,
      ],
      [
        'b.one',
        `
        import "./c" as C;
        export fn fromB(): Int32 { return 20; }
        `,
      ],
      [
        'c.one',
        `
        import "./a" as A;
        export fn fromC(): Int32 { return 30; }
        `,
      ],
      [
        'main.one',
        `
        import "./a" as A;
        let x = A.fromA();
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();
    const result = compiler.compileMultiFile('main.one', {
      projectRoot,
      virtualFiles,
    });

    assert.strictEqual(result.success, false, 'Circular dependencies must fail closed');
    const diag = result.diagnostics.find(d => d.code === 'E4004');
    assert(diag, 'Expected diagnostic E4004 for circular dependency');
    assert(diag.message.includes('Circular module dependency detected'));

    console.log('  ✓ Circular dependencies detected and rejected with E4004 diagnostic.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 9: Invalid Symbol Import Reference Diagnostics (E4005)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 9] Invalid Symbol Import Reference Diagnostics (E4005)...');
  {
    const virtualFiles = new Map<string, string>([
      [
        'provider.one',
        `
        export fn validSymbol(): Int32 {
          return 42;
        }
        `,
      ],
      [
        'consumer.one',
        `
        import { validSymbol, nonExistentSymbol } from "./provider";
        let v = validSymbol();
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();
    const result = compiler.compileMultiFile('consumer.one', {
      projectRoot,
      virtualFiles,
    });

    assert.strictEqual(result.success, false, 'Importing unexported symbol must fail');
    const diag = result.diagnostics.find(d => d.code === 'E4005');
    assert(diag, 'Expected diagnostic E4005 for missing exported symbol');
    assert(diag.message.includes("Symbol 'nonExistentSymbol' is not exported"));

    console.log('  ✓ Named imports of unexported symbols rejected fail-closed with E4005.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 10: VIG Compilation Cache Integration & Public API Hash Binding
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 10] VIG Compilation Cache Integration & Public API Hash Binding...');
  {
    const cache = new VIGCompilationCache(100);
    const virtualFiles = new Map<string, string>([
      [
        'math.one',
        `
        export fn multiply(a: Int32, b: Int32): Int32 {
          return a * b;
        }
        `,
      ],
      [
        'main.one',
        `
        import { multiply } from "./math";
        let r = multiply(6, 7);
        print r;
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();

    // First compilation: Cold cache
    const run1 = compiler.compileMultiFile('main.one', {
      projectRoot,
      virtualFiles,
      compilationCache: cache,
    });
    assert.strictEqual(run1.success, true);
    assert.strictEqual(run1.cacheMetrics?.misses, 2, 'First compilation should have 2 misses');
    assert.strictEqual(run1.cacheMetrics?.hits, 0, 'First compilation should have 0 hits');
    assert.strictEqual(cache.metrics.totalEntries, 2, 'Cache should have 2 entries stored');

    // Second compilation: Warm cache
    const run2 = compiler.compileMultiFile('main.one', {
      projectRoot,
      virtualFiles,
      compilationCache: cache,
    });
    assert.strictEqual(run2.success, true);
    assert.strictEqual(run2.cacheMetrics?.hits, 2, 'Second compilation should have 2 hits');
    assert.strictEqual(run2.cacheMetrics?.misses, 0, 'Second compilation should have 0 misses');

    console.log('  ✓ VIG compilation cache integrated cleanly: cold compile stores entries, warm compile achieves 100% hits.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 11: Fine-Grained Cache Invalidation: Private Edit vs Public API Break
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 11] Fine-Grained Cache Invalidation (Private Edit vs Public API Break)...');
  {
    const cache = new VIGCompilationCache(100);
    const virtualFiles = new Map<string, string>([
      [
        'math.one',
        `
        export fn compute(val: Int32): Int32 {
          return val * 10;
        }
        `,
      ],
      [
        'main.one',
        `
        import { compute } from "./math";
        let ans = compute(5);
        `,
      ],
    ]);

    const compiler = new UnifiedCompiler();

    // 1. Initial compile
    const r1 = compiler.compileMultiFile('main.one', { projectRoot, virtualFiles, compilationCache: cache });
    assert.strictEqual(r1.success, true);
    assert.strictEqual(r1.cacheMetrics?.misses, 2);

    // 2. Private implementation edit in math.one (signature unchanged!)
    virtualFiles.set(
      'math.one',
      `
      export fn compute(val: Int32): Int32 {
        // Internal optimization / refactor
        let multiplier: Int32 = 10;
        return val * multiplier;
      }
      `
    );

    const r2 = compiler.compileMultiFile('main.one', { projectRoot, virtualFiles, compilationCache: cache });
    assert.strictEqual(r2.success, true);
    // math.one changed contentHash -> 1 miss
    // main.one has same publicApiHash for math.one -> 1 HIT!
    assert.strictEqual(r2.cacheMetrics?.misses, 1, 'Only math.one should recompile');
    assert.strictEqual(r2.cacheMetrics?.hits, 1, 'Dependent main.one should HIT cache because math public API is unchanged');

    // 3. Public API break in math.one (add parameter)
    virtualFiles.set(
      'math.one',
      `
      export fn compute(val: Int32, factor: Int32): Int32 {
        return val * factor;
      }
      `
    );

    const r3 = compiler.compileMultiFile('main.one', { projectRoot, virtualFiles, compilationCache: cache });
    // math.one changed -> miss
    // main.one now has different importedPublicApiHashes -> miss!
    assert.strictEqual(r3.cacheMetrics?.misses, 2, 'Both modules must miss when public API hash changes');

    // 4. Test selective invalidation
    const invCount = cache.invalidateDownstreamPaths([path.resolve(projectRoot, 'math.one')]);
    assert(invCount >= 1, 'Should invalidate cached paths');

    console.log('  ✓ Selective invalidation verified: Private body edits preserve dependent cache hits; Public API changes cascade invalidate.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 12: Invariants & Security Hardening Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 12] Invariants & Security Hardening Verification...');
  {
    // Address369 boundaries
    assert.strictEqual(CanonicalAddress369.TOTAL_ADDRESSES, 369, 'Address369 canonical total cells must equal 369');
    assert.strictEqual(CanonicalAddress369.SYMBOLIC_COUNT, 26, 'Symbolic count must be 26');
    assert.strictEqual(CanonicalAddress369.SPATIAL_COUNT, 343, 'Spatial count must be 343');
    assert.strictEqual(CanonicalAddress369.SPATIAL_START, 26, 'Spatial start must be 26');
    assert.strictEqual(CanonicalAddress369.SPATIAL_END, 368, 'Spatial end must be 368');
    assert.throws(() => CanonicalAddress369.toDisplayIndex(369), /outside valid canonical range/);

    // VIGSecurityGuard invariants & actuation lockout keys
    assert(VIGSecurityGuard.ALLOWED_ROLES.has('SYSTEM_CORE'));
    assert(VIGSecurityGuard.MUTATING_ROLES.has('SYSTEM_CORE'));
    assert(!VIGSecurityGuard.MUTATING_ROLES.has('ANALYZER_AGENT'));
    assert(VIGSecurityGuard.PROHIBITED_ACTUATION_KEYS.includes('actuation'));
    assert(VIGSecurityGuard.PROHIBITED_ACTUATION_KEYS.includes('overridelockout'));

    // Verify root escape checks throw VIGSecurityError
    assert.throws(
      () => {
        VIGSecurityGuard.assertSafeRepositoryPath('../../shadow_passwd', projectRoot);
      },
      /Path traversal attack detected/i,
      'Should throw root traversal error'
    );

    console.log('  ✓ Address369 [0..368] boundaries, actuation lockout, and fail-closed security invariants intact.');
  }

  console.log('\n================================================================================');
  console.log('  ALL 12 MULTI-FILE MODULE & NAMESPACE RESOLUTION SUITES PASSED (100%)');
  console.log('================================================================================\n');
}

if (require.main === module) {
  runMultiFileModulesTests();
}
