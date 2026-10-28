/**
 * Phase 4 — VM State Inspector
 *
 * Enriches getVMState() with deeper runtime introspection:
 *   - evalStack (current evaluation stack contents)
 *   - callStack (active call chain — function returns pending)
 *   - instructionPointer (current execution position)
 *   - funcRegistry (registered functions with param counts + entry points)
 */

import { CubiOVirtualMachine } from '../core/engine/cubioVM';

export interface VMStateInspectorResult {
  // Core state (from getVMState)
  nodesCount: number;
  streamsCount: number;
  allocatedMemoryMb: number;
  determinismSigmaSq: number;
  variables: Record<string, any>;
  activeScopes: number;

  // Extended runtime introspection
  evalStack: any[];
  callStack: number[];
  instructionPointer: number;
  funcRegistry: Map<string, { paramCount: number; entryIndex: number }>;
  rssLimitMb: number;
  rssUsedBytes: number;
  rssUsedMb: number;
}

/**
 * Create a fresh VM, execute the given ONE program, and return a
 * full introspection snapshot for external inspection (e.g. by a
 * bridge / LLM layer).
 */
export function inspectRun(
  oneSource: string,
): VMStateInspectorResult | { error: string; phase: 'lexer' | 'parser' | 'compiler' | 'vm'; detail: string } {
  const { OneLexer } = require('./oneLexer');
  const { OneParser } = require('./oneParser');
  const { OneCompiler } = require('./oneCompiler');

  try {
    // 1. Lexer
    const lexer = new OneLexer(oneSource);
    const tokens = lexer.tokenize();

    // 2. Parser
    const parser = new OneParser(tokens);
    const ast = parser.parse();

    // 3. Compiler
    const compiler = new OneCompiler(ast);
    const executableAST = compiler.compile();

    // 4. VM
    const vm = new CubiOVirtualMachine();
    vm.execute(executableAST);

    const base = (vm as any).getVMState();

    // Capture evalStack / callStack / instructionPointer via
    // a one-shot dump before the VM is garbage-collected.
    // We reflect into private fields via any.
    const vmAny = vm as any;
    const evalStack = vmAny.evalStack ? [...vmAny.evalStack] : [];
    const callStack = vmAny.callStack ? [...vmAny.callStack] : [];
    const instructionPointer = vmAny.instructionPointer ?? 0;
    const funcRegistry = vmAny.funcRegistry ? new Map(vmAny.funcRegistry) : new Map();
    const rssGuard = vmAny.rssGuard;
    const rssLimitMb = 512; // Cubió hard limit — RSSGuard enforces this internally
    const rssUsedBytes = rssGuard ? rssGuard.getUsedBytes() : 0;
    const rssUsedMb = rssGuard ? rssGuard.getUsedMb() : 0;

    return {
      nodesCount: base.nodesCount,
      streamsCount: base.streamsCount,
      allocatedMemoryMb: base.allocatedMemoryMb,
      determinismSigmaSq: base.determinismSigmaSq,
      variables: base.variables,
      activeScopes: base.activeScopes,
      evalStack,
      callStack,
      instructionPointer,
      funcRegistry,
      rssLimitMb,
      rssUsedBytes,
      rssUsedMb,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Heuristic phase detection
    let phase: 'lexer' | 'parser' | 'compiler' | 'vm' = 'vm';
    if (msg.includes('[Lexer Error]')) phase = 'lexer';
    else if (msg.includes('[Parser Error]')) phase = 'parser';
    else if (msg.includes('[Compiler') || msg.includes('Violation') || msg.includes('Bound')) phase = 'compiler';
    return { error: msg, phase, detail: msg };
  }
}
