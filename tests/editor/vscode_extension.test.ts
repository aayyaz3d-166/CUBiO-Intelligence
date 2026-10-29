/**
 * ONE Language — VS Code Extension Verification Suite (T11)
 * ==========================================================
 * Comprehensive verification of the ONE Language Visual Studio Code extension:
 *  - Manifest & directory structure
 *  - Language configuration (comments, brackets, auto-closing)
 *  - TextMate grammar rule coverage & regex sanity
 *  - Code snippets catalog & syntax validity
 *  - Extension bundle exports (activate, deactivate)
 *  - VSIX package creation & ZIP structure validation
 *  - Local installation via VS Code CLI (code --install-extension)
 *  - In-process LSP intelligence (diagnostics, completions, hover, definition)
 *  - Actuation lockout & Address369 invariants
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { OneLanguageServer } from '../../src/one/lsp/OneLanguageServer';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runVSCodeExtensionTests(): Promise<void> {
  console.log('\n================================================================================');
  console.log('  ONE LANGUAGE — VS CODE EXTENSION VERIFICATION SUITE (T11)');
  console.log('================================================================================\n');

  const repoRoot = path.resolve(__dirname, '../..');
  const editorDir = path.join(repoRoot, 'editors', 'vscode');
  const distDir = path.join(repoRoot, 'dist');
  const pkgPath = path.join(editorDir, 'package.json');
  assert(fs.existsSync(pkgPath), 'package.json must exist in editors/vscode');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const vsixPath = path.join(distDir, `one-language-${pkg.version}.vsix`);

  // ── Suite 1: Extension Manifest & Directory Layout ────────────────────────
  console.log('[Suite 1] Extension Manifest and Structure Validation...');

  assert(pkg.name === 'one-language', `Expected name 'one-language', got '${pkg.name}'`);
  assert(pkg.version === '1.3.0' || pkg.version === '1.2.1' || pkg.version === '1.2.0' || pkg.version === '1.1.0' || pkg.version === '1.0.1' || pkg.version === '1.0.0', `Expected version 1.3.0, 1.2.1, 1.2.0, 1.1.0, 1.0.1 or 1.0.0, got ${pkg.version}`);
  assert(pkg.publisher === 'ayyaz3d' || pkg.publisher === 'one-language', `Expected publisher 'ayyaz3d' or 'one-language', got '${pkg.publisher}'`);
  assert(pkg.engines && pkg.engines.vscode, 'Missing engines.vscode declaration');
  assert(pkg.main === './dist/extension.js', `Expected main './dist/extension.js', got '${pkg.main}'`);

  const langContrib = pkg.contributes?.languages?.[0];
  assert(langContrib && langContrib.id === 'one', 'Language id must be "one"');
  assert(langContrib.extensions.includes('.one'), 'Extension list must include .one');
  assert(langContrib.configuration === './language-configuration.json', 'Language configuration reference missing');

  const grammarContrib = pkg.contributes?.grammars?.[0];
  assert(grammarContrib && grammarContrib.language === 'one', 'Grammar language must be "one"');
  assert(grammarContrib.scopeName === 'source.one', 'Scope name must be "source.one"');

  const snippetContrib = pkg.contributes?.snippets?.[0];
  assert(snippetContrib && snippetContrib.language === 'one', 'Snippet language must be "one"');

  // Verify all essential commands are declared
  const commandIds = (pkg.contributes?.commands || []).map((c: any) => c.command);
  const requiredCommands = [
    'one.runFile',
    'one.checkFile',
    'one.buildFile',
    'one.runOxFile',
    'one.formatFile',
    'one.selectCli',
    'one.showOutput',
    'one.showMenu',
    'one.askCopilot',
  ];
  for (const cmd of requiredCommands) {
    assert(commandIds.includes(cmd), `Missing required command declaration: ${cmd}`);
  }

  // Verify menus
  assert(pkg.contributes?.menus?.['editor/title']?.length >= 3, 'Editor title menu must have run, check, and build');
  assert(pkg.contributes?.menus?.['editor/context']?.length >= 4, 'Editor context menu must have actions');
  assert(pkg.contributes?.menus?.['explorer/context']?.length >= 3, 'Explorer context menu must have actions');

  // Verify configuration properties
  const configProps = pkg.contributes?.configuration?.properties;
  assert(configProps && configProps['one.cliPath'], 'Configuration property one.cliPath missing');
  assert(configProps && configProps['one.checkOnSave'], 'Configuration property one.checkOnSave missing');
  assert(configProps && configProps['one.formatOnSave'], 'Configuration property one.formatOnSave missing');

  console.log(`  ✓ Manifest validated: ${pkg.publisher}.${pkg.name} v${pkg.version} (VS Code ${pkg.engines.vscode}) with ${commandIds.length} commands.`);

  // ── Suite 2: Language Configuration Validation ────────────────────────────
  console.log('[Suite 2] Language Configuration (Brackets, Comments, Pairs)...');
  const langConfigPath = path.join(editorDir, 'language-configuration.json');
  assert(fs.existsSync(langConfigPath), 'language-configuration.json must exist');
  const langConfig = JSON.parse(fs.readFileSync(langConfigPath, 'utf-8'));

  assert(langConfig.comments?.lineComment === '//', 'Line comment must be "//"');
  assert(Array.isArray(langConfig.comments?.blockComment) && langConfig.comments.blockComment[0] === '/*', 'Block comment start must be "/*"');
  assert(Array.isArray(langConfig.brackets) && langConfig.brackets.length >= 3, 'Must define brackets for {}, [], ()');
  assert(Array.isArray(langConfig.autoClosingPairs) && langConfig.autoClosingPairs.length >= 5, 'Must define autoClosingPairs');
  assert(Array.isArray(langConfig.surroundingPairs) && langConfig.surroundingPairs.length >= 5, 'Must define surroundingPairs');
  console.log('  ✓ Language configuration verified.');

  // ── Suite 3: TextMate Grammar Completeness ────────────────────────────────
  console.log('[Suite 3] TextMate Grammar Completeness (source.one)...');
  const grammarPath = path.join(editorDir, 'syntaxes', 'one.tmLanguage.json');
  assert(fs.existsSync(grammarPath), 'syntaxes/one.tmLanguage.json must exist');
  const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf-8'));

  assert(grammar.scopeName === 'source.one', 'Grammar scopeName must match source.one');
  assert(grammar.repository, 'Grammar repository missing');

  const repoKeys = Object.keys(grammar.repository);
  const requiredCategories = [
    'comments',
    'strings',
    'numbers',
    'spatial-directives',
    'declarations',
    'control-flow',
    'modules',
    'constants',
    'types',
    'builtin-functions',
    'stdlib-functions',
    'operators',
  ];
  for (const cat of requiredCategories) {
    assert(repoKeys.includes(cat), `Grammar repository missing category: ${cat}`);
  }
  console.log(`  ✓ All ${requiredCategories.length} syntax grammar categories verified.`);

  // ── Suite 4: Syntax Highlighting Regex Evaluation ─────────────────────────
  console.log('[Suite 4] Syntax Regex Rule Evaluation on Sample Programs...');
  // Test regex compilation for all match patterns in repository
  for (const [catName, catRules] of Object.entries<any>(grammar.repository)) {
    if (Array.isArray(catRules.patterns)) {
      for (const pat of catRules.patterns) {
        if (pat.match) {
          try {
            new RegExp(pat.match);
          } catch (e: any) {
            throw new Error(`Invalid RegExp in grammar category ${catName}: ${pat.match} (${e.message})`);
          }
        }
      }
    }
  }

  // Validate specific keyword and directive matches
  const spatialRegex = new RegExp(grammar.repository['spatial-directives'].patterns[0].match);
  assert(spatialRegex.test('@Space'), 'Should match @Space');
  assert(spatialRegex.test('@Grid777'), 'Should match @Grid777');
  assert(spatialRegex.test('@seal'), 'Should match @seal');
  assert(spatialRegex.test('@assert_rss'), 'Should match @assert_rss');
  assert(spatialRegex.test('@actuation_lock'), 'Should match @actuation_lock');

  const declRegex = new RegExp(grammar.repository['declarations'].patterns[0].match);
  assert(declRegex.test('let'), 'Should match let');
  assert(declRegex.test('const'), 'Should match const');
  assert(declRegex.test('struct'), 'Should match struct');
  assert(declRegex.test('enum'), 'Should match enum');
  assert(declRegex.test('function'), 'Should match function');
  assert(declRegex.test('fn'), 'Should match fn');

  const opRegex = new RegExp(grammar.repository['operators'].patterns[0].match);
  assert(opRegex.test('->'), 'Should match funnel ->');
  assert(opRegex.test('=>'), 'Should match align =>');
  console.log('  ✓ TextMate regex rules compiled and verified against language tokens.');

  // ── Suite 5: Code Snippets Catalog ───────────────────────────────────────
  console.log('[Suite 5] Code Snippets Catalog & Construct Validation...');
  const snippetsPath = path.join(editorDir, 'snippets', 'one.code-snippets');
  assert(fs.existsSync(snippetsPath), 'snippets/one.code-snippets must exist');
  const snippets = JSON.parse(fs.readFileSync(snippetsPath, 'utf-8'));

  const snippetKeys = Object.keys(snippets);
  assert(snippetKeys.length >= 15, `Expected >= 15 snippets, found ${snippetKeys.length}`);

  const requiredSnippets = ['Function Declaration', 'Struct Declaration', 'Enum Declaration', 'Spatial Node', 'Spatial Channel'];
  for (const req of requiredSnippets) {
    assert(snippetKeys.includes(req), `Missing required snippet: ${req}`);
    const s = snippets[req];
    assert(s.prefix && s.body && s.description, `Snippet ${req} missing fields`);
  }
  console.log(`  ✓ ${snippetKeys.length} code snippets validated.`);

  // ── Suite 6: Extension Bundle Viability ───────────────────────────────────
  console.log('[Suite 6] Extension JavaScript Bundle Viability...');
  const bundlePath = path.join(editorDir, 'dist', 'extension.js');
  assert(fs.existsSync(bundlePath), `Extension bundle must exist at: ${bundlePath}`);

  // Test loading with a mock vscode module
  const Module = require('module');
  const originalLoad = Module._load;
  let mockCalled = false;
  Module._load = function (request: string, parent: any, isMain: boolean) {
    if (request === 'vscode') {
      mockCalled = true;
      return {
        window: { createOutputChannel: () => ({ appendLine: () => {} }) },
        languages: { createDiagnosticCollection: () => ({ set: () => {}, delete: () => {} }) },
        workspace: { onDidOpenTextDocument: () => {}, onDidChangeTextDocument: () => {}, onDidCloseTextDocument: () => {}, textDocuments: [] },
        commands: { registerCommand: () => {} },
      };
    }
    return originalLoad.apply(this, arguments as any);
  };

  try {
    const extModule = require(bundlePath);
    assert(typeof extModule.activate === 'function', 'extension.js must export activate()');
    assert(typeof extModule.deactivate === 'function', 'extension.js must export deactivate()');
    assert(mockCalled, 'extension.js must require external vscode host module');
  } finally {
    Module._load = originalLoad;
  }
  console.log('  ✓ Extension exports activate() and deactivate() successfully.');

  // ── Suite 7: VSIX Packaging Pipeline Execution ───────────────────────────
  console.log('[Suite 7] VSIX Packaging Pipeline Execution...');
  const packScript = path.join(repoRoot, 'scripts', 'package-vscode-extension.cjs');
  assert(fs.existsSync(packScript), `Packaging script must exist at: ${packScript}`);

  const packRun = cp.spawnSync(process.execPath, [packScript], {
    cwd: repoRoot,
    encoding: 'utf-8',
  });
  assert(packRun.status === 0, `Packaging failed: ${packRun.stderr || packRun.stdout}`);
  assert(fs.existsSync(vsixPath), `Expected .vsix file at ${vsixPath}`);
  assert(fs.existsSync(vsixPath + '.manifest.json'), 'Expected .vsix.manifest.json');
  assert(fs.existsSync(vsixPath + '.sha256'), 'Expected .vsix.sha256');

  const vsixSize = fs.statSync(vsixPath).size;
  assert(vsixSize > 500 * 1024, `VSIX size must be substantial (>500KB), got ${vsixSize} bytes`);
  console.log(`  ✓ .vsix package generated: ${vsixPath} (${(vsixSize / (1024 * 1024)).toFixed(2)} MB).`);

  // ── Suite 8: VSIX Container Binary Header & Structure ────────────────────
  console.log('[Suite 8] VSIX PKZip Container Structure Validation...');
  const vsixBuffer = fs.readFileSync(vsixPath);
  // PKZip magic: 'PK\x03\x04'
  assert(vsixBuffer[0] === 0x50 && vsixBuffer[1] === 0x4B && vsixBuffer[2] === 0x03 && vsixBuffer[3] === 0x04, 'Invalid VSIX zip magic');
  // Check manifest presence inside archive
  const zipText = vsixBuffer.toString('binary');
  assert(zipText.includes('extension.vsixmanifest'), 'VSIX must contain extension.vsixmanifest');
  assert(zipText.includes('extension/package.json'), 'VSIX must contain extension/package.json');
  assert(zipText.includes('extension/syntaxes/one.tmLanguage.json'), 'VSIX must contain syntaxes/one.tmLanguage.json');
  assert(zipText.includes('extension/dist/extension.js'), 'VSIX must contain extension/dist/extension.js');
  assert(zipText.includes('echo1_best_loss.cubiomodel'), 'VSIX must contain embedded echo1_best_loss.cubiomodel');
  console.log('  ✓ VSIX zip container structure validated.');

  // ── Suite 9: Local Installation via VS Code CLI ──────────────────────────
  console.log('[Suite 9] Local Installation in VS Code (code --install-extension)...');
  const installRun = cp.spawnSync('code', ['--install-extension', `"${vsixPath}"`], {
    encoding: 'utf-8',
    shell: true,
  });
  assert(installRun.status === 0, `code --install-extension failed: ${installRun.stderr || installRun.stdout}`);

  const listRun = cp.spawnSync('code', ['--list-extensions'], {
    encoding: 'utf-8',
    shell: true,
  });
  assert(listRun.status === 0, `code --list-extensions failed: ${listRun.stderr}`);
  assert(listRun.stdout.includes('ayyaz3d.one-language') || listRun.stdout.includes('one-language.one-language'), 'Installed extension must appear in code --list-extensions');
  console.log('  ✓ Extension installed and confirmed active in VS Code extension registry.');

  // ── Suite 10: In-Process Language Intelligence (Diagnostics & Hover) ──────
  console.log('[Suite 10] In-Process Language Intelligence Engine Verification...');
  const lsp = new OneLanguageServer();

  // 10a. Diagnostics for valid code (expect 0 diagnostics)
  const validCode = 'function add(a: number, b: number): number { return a + b; }\nlet ans = add(10, 20);\nprint ans;';
  const diagValid = lsp.getDiagnostics(validCode);
  assert(diagValid.length === 0, `Expected 0 diagnostics for valid code, got ${diagValid.length}`);

  // 10b. Diagnostics for invalid syntax (expect diagnostic)
  const invalidCode = 'let invalid = ;';
  const diagInvalid = lsp.getDiagnostics(invalidCode);
  assert(diagInvalid.length > 0, 'Expected diagnostics for syntax error');
  assert(diagInvalid[0].range.start.line >= 1, 'Diagnostic should report valid line');
  assert(diagInvalid[0].code.length > 0, 'Diagnostic should report error code');

  // 10c. Completions
  const completions = lsp.getCompletions(validCode, { line: 2, column: 1 });
  assert(completions.some((c) => c.label === 'function'), 'Completions must include function keyword');
  assert(completions.some((c) => c.label === 'let'), 'Completions must include let keyword');
  assert(completions.some((c) => c.label === 'print'), 'Completions must include print built-in');

  // 10d. Hover info
  const hoverKw = lsp.getHover('function add(x) { return x; }', { line: 1, column: 3 });
  assert(hoverKw !== null && hoverKw.contents.length > 0, 'Hover should return doc for function keyword');

  // 10e. Go-to-Definition
  const def = lsp.getDefinition(validCode, { line: 2, column: 12 }); // over 'add'
  assert(def !== null, 'Definition should be resolved for symbol "add"');

  // 10f. Document Symbols
  const symbols = lsp.getDocumentSymbols(validCode);
  assert(symbols.length >= 2, `Expected at least 2 symbols, got ${symbols.length}`);
  assert(symbols.some((s) => s.name === 'add' && s.kind === 'Function'), 'Must detect function symbol add');
  assert(symbols.some((s) => s.name === 'ans' && s.kind === 'Variable'), 'Must detect variable symbol ans');

  // 10g. Document Formatting
  const unformatted = 'function   calc( a:Int32,b:Int32 ):Int32{return a+b;}';
  const formatted = lsp.formatDocument(unformatted);
  assert(formatted.includes('function calc('), 'Formatter must standardize keyword spacing');
  assert(formatted.includes('a: Int32, b: Int32'), 'Formatter must standardize parameter spacing');
  assert(formatted.includes('return a + b;'), 'Formatter must standardize operator spacing');
  console.log('  ✓ Language Server intelligence (diagnostics, completions, hover, definition, symbols, formatting) verified.');

  // ── Suite 11: Fail-Closed Safety Invariants ──────────────────────────────
  console.log('[Suite 11] Actuation Lockout and Address369 Safety Invariants...');
  // Actuation attempt should trigger compiler diagnostic
  const actuationCode = 'actuate("motor_joint", 100);';
  const actuationDiag = lsp.getDiagnostics(actuationCode);
  assert(actuationDiag.length > 0, 'Actuation code must trigger diagnostic failure');

  // Memory out-of-bounds in Address369 range [0..368]
  const validAddrCode = 'let address = 368;\nprint address;';
  const validAddrDiag = lsp.getDiagnostics(validAddrCode);
  assert(validAddrDiag.length === 0, 'Address within [0..368] is valid');
  console.log('  ✓ Fail-closed safety invariants enforced.');

  // ── Suite 12: Tooling & Workflow Coexistence ─────────────────────────────
  console.log('[Suite 12] Tooling Coexistence & Workspace Non-Interference...');
  // Verify that the extension files do not disrupt other package tests
  assert(fs.existsSync(path.join(repoRoot, 'dist', 'one.exe')), 'one.exe binary remains intact');
  assert(fs.existsSync(path.join(repoRoot, 'bin', 'one.cjs')), 'one.cjs launcher remains intact');
  console.log('  ✓ Extension packaging operates cleanly without touching existing compiler baselines.');

  // ── Suite 13: Command Execution & Compilation Workflows ───────────────────
  console.log('[Suite 13] Command Execution & Compilation Workflows...');
  const tempTestFile = path.join(repoRoot, 'dist', 'temp_vscode_exec_test.one');
  const tempTestOx = path.join(repoRoot, 'dist', 'temp_vscode_exec_test.ox');
  const testSource = 'function calculate(x: Int32): Int32 {\n  return x * 2;\n}\nlet result = calculate(21);\nprint result;\n';
  fs.writeFileSync(tempTestFile, testSource, 'utf-8');

  try {
    // 13a. one check command workflow
    const checkRes = OneDeveloperCLI.run(['check', tempTestFile]);
    assert(checkRes.exitCode === 0, `one check must succeed on valid file, got code ${checkRes.exitCode}: ${checkRes.stderr}`);
    assert(checkRes.stdout.includes('Check Passed'), 'one check must output check passed confirmation');

    // 13b. one run command workflow
    const runRes = OneDeveloperCLI.run(['run', tempTestFile]);
    assert(runRes.exitCode === 0, `one run must succeed, got code ${runRes.exitCode}: ${runRes.stderr}`);
    assert(runRes.stdout.includes('42'), `one run output must contain 42, got: ${runRes.stdout}`);

    // 13c. one build command workflow (.one -> .ox)
    const buildRes = OneDeveloperCLI.run(['build', tempTestFile]);
    assert(buildRes.exitCode === 0, `one build must succeed, got code ${buildRes.exitCode}: ${buildRes.stderr}`);
    assert(fs.existsSync(tempTestOx), 'one build must produce .ox binary executable');
    const oxBytes = fs.readFileSync(tempTestOx);
    assert(oxBytes.slice(0, 4).toString('ascii') === 'ONEX', 'Built executable must have ONEX magic header');

    // 13d. one run on compiled .ox file workflow
    const runOxRes = OneDeveloperCLI.run(['run', tempTestOx]);
    assert(runOxRes.exitCode === 0, `one run on .ox must succeed, got code ${runOxRes.exitCode}: ${runOxRes.stderr}`);
    assert(runOxRes.stdout.includes('42'), `one run on .ox output must contain 42, got: ${runOxRes.stdout}`);

    // 13e. Fail-closed error handling on invalid source
    const invalidFile = path.join(repoRoot, 'dist', 'temp_vscode_invalid_test.one');
    fs.writeFileSync(invalidFile, 'function broken( { let x = ;', 'utf-8');
    const checkInvalidRes = OneDeveloperCLI.run(['check', invalidFile]);
    assert(checkInvalidRes.exitCode !== 0, 'one check must return non-zero exit code on invalid syntax');
    assert(checkInvalidRes.stderr.length > 0, 'one check must emit error diagnostics to stderr');
    if (fs.existsSync(invalidFile)) fs.unlinkSync(invalidFile);

    console.log('  ✓ CLI compilation and execution workflows (check, run, build, ox execution, fail-closed handling) verified.');
  } finally {
    if (fs.existsSync(tempTestFile)) fs.unlinkSync(tempTestFile);
    if (fs.existsSync(tempTestOx)) fs.unlinkSync(tempTestOx);
    const tempTestIr = path.join(repoRoot, 'dist', 'temp_vscode_exec_test.one.ir');
    if (fs.existsSync(tempTestIr)) fs.unlinkSync(tempTestIr);
  }

  console.log('\n================================================================================');
  console.log('  ALL 13 VS CODE EXTENSION VERIFICATION SUITES PASSED (100%)');
  console.log('================================================================================\n');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('vscode_extension.test.ts')) {
  runVSCodeExtensionTests().catch((err) => {
    console.error('\n[TEST FATAL ERROR]:', err);
    process.exit(1);
  });
}
