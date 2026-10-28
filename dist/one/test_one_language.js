import { OneLexer } from './oneLexer';
import { OneParser } from './oneParser';
import { OneCompiler } from './oneCompiler';
const sampleOneProgram = `
// CubiO Spatial Processing Configuration
rss_max = 512;

node CoreOrigin {
  @Space(0.333, 0.666, 0.999);
  align => (0.3, 0.6, 0.9);
  checkpoint alpha;
}

node TargetNode {
  @Space(0.111, 0.222, 0.333);
  checkpoint beta;
}

funnel PrimaryStream {
  stream CoreOrigin -> TargetNode : 128;
}
`;
function runTestSuite() {
    console.log('=== ONE Language Core Backend Test Suite ===\n');
    try {
        // Step 1: Lexical Analysis
        console.log('[1/3] Running Lexer...');
        const lexer = new OneLexer(sampleOneProgram);
        const tokens = lexer.tokenize();
        console.log(`  ✓ Successfully tokenized ${tokens.length} tokens.`);
        // Step 2: Parsing AST
        console.log('[2/3] Parsing Abstract Syntax Tree (AST)...');
        const parser = new OneParser(tokens);
        const ast = parser.parse();
        console.log(`  ✓ AST Generation successful.`);
        console.log(`    - RSS Limit: ${ast.rssMaxLimitMB} MB`);
        console.log(`    - Nodes: ${ast.nodes.length}`);
        console.log(`    - Funnels: ${ast.funnels.length}`);
        // Step 3: Compilation & Spatial Bound Validation
        console.log('[3/3] Compiling and Validating 369 Spatial & RSS Bounds...');
        const compiler = new OneCompiler(ast);
        const executableAST = compiler.compile();
        console.log('  ✓ Compilation succeeded!');
        console.log('  ✓ Executable CubiO AST Instructions Generated:');
        console.log(JSON.stringify(executableAST, null, 2));
        console.log('\n✅ PASS: ONE Language Core Compiler Backend Phase 1 Fully Verified.');
    }
    catch (err) {
        if (err instanceof Error) {
            console.error('\n❌ FAIL: Compilation error detected:');
            console.error(err.message);
        }
        else {
            console.error('\n❌ FAIL: Unknown error occurred during execution');
        }
        process.exit(1);
    }
}
runTestSuite();
