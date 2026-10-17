import { ExecutableCubiOAST, ExecutableInstruction, SerializedExpr } from '../../one/oneCompiler';
import { TokenType } from '../../one/oneLexer';
import { RSSGuard } from '../memory/rssGuard';
import { SpatialHarmonic369Engine, Point3D } from './spatialHarmonic369';

export interface RuntimeSpatialNode {
  id: string;
  coordinate: Point3D;
  checkpoints: string[];
  activeAlignments: Point3D[];
}

export interface RuntimeFunnelStream {
  id: string;
  source: string;
  target: string;
  bufferSizeBytes: number;
}

interface VariableScope {
  variables: Map<string, any>;
  scopeId: number;
}

export class CubiOVirtualMachine {
  private rssGuard: RSSGuard;
  private harmonicEngine: SpatialHarmonic369Engine;
  private activeNodes: Map<string, RuntimeSpatialNode> = new Map();
  private activeStreams: Map<string, RuntimeFunnelStream> = new Map();
  private scopeStack: VariableScope[] = [];
  private evalStack: any[] = [];
  private instructionPointer: number = 0;
  private instructionList: ExecutableInstruction[] = [];
  private labelMap: Map<string, number> = new Map();
  private loopStack: Array<{ continueTarget: string; breakTarget: string }> = [];
  private funcRegistry: Map<string, { paramCount: number; entryIndex: number }> = new Map();
  private callStack: number[] = [];
  private returnStack: any[] = [];

  constructor() {
    this.rssGuard = new RSSGuard(512);
    this.harmonicEngine = new SpatialHarmonic369Engine();
    this.scopeStack.push({ variables: new Map(), scopeId: 0 });
  }

  public execute(ast: ExecutableCubiOAST): void {
    console.log('[CubiO VM] Initializing Execution Fabric...');
    this.instructionList = ast.instructions;
    this.instructionPointer = 0;
    this.buildLabelMap(ast.instructions);
    this.funcRegistry = new Map(ast.functionRegistry);
    this.callStack = [];
    this.returnStack = [];

    while (this.instructionPointer < this.instructionList.length) {
      const instruction = this.instructionList[this.instructionPointer];
      const jumped = this.dispatch(instruction);
      if (!jumped) {
        this.instructionPointer++;
      }
    }

    console.log(`[CubiO VM] Execution Complete. Active Memory: ${this.rssGuard.getUsedMb().toFixed(2)} MB`);
  }

  private buildLabelMap(instructions: ExecutableInstruction[]): void {
    this.labelMap.clear();
    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];
      if (inst.op === 'LABEL') {
        this.labelMap.set((inst as { payload: { label: string } }).payload.label, i);
      }
    }
  }

  private dispatch(instruction: ExecutableInstruction): boolean {
    switch (instruction.op) {
      case 'SET_RSS_GUARD': {
        const payload = instruction.payload as { limitMb: number };
        this.rssGuard = new RSSGuard(payload.limitMb);
        console.log(`  [VM Op] SET_RSS_GUARD: Enforcing limit at ${payload.limitMb} MB`);
        break;
      }

      case 'ALLOC_SPATIAL_NODE': {
        const payload = instruction.payload as {
          nodeId: string;
          coordinate: Point3D;
          checkpoints: string[];
        };

        this.rssGuard.allocate(64 * 1024, `NodeDescriptor:${payload.nodeId}`);

        const node: RuntimeSpatialNode = {
          id: payload.nodeId,
          coordinate: payload.coordinate,
          checkpoints: payload.checkpoints,
          activeAlignments: [],
        };

        this.activeNodes.set(payload.nodeId, node);
        console.log(`  [VM Op] ALLOC_SPATIAL_NODE: Registered '${payload.nodeId}' at (${payload.coordinate.x}, ${payload.coordinate.y}, ${payload.coordinate.z})`);
        break;
      }

      case 'ALIGN_HARMONIC': {
        const payload = instruction.payload as {
          nodeId: string;
          targetCoordinate: Point3D;
        };

        const node = this.activeNodes.get(payload.nodeId);
        if (!node) {
          throw new Error(`[VM Fault] Cannot align non-existent node '${payload.nodeId}'`);
        }

        const alignedCoord = this.harmonicEngine.align(node.coordinate, payload.targetCoordinate);
        node.activeAlignments.push(alignedCoord);
        console.log(`  [VM Op] ALIGN_HARMONIC: Node '${payload.nodeId}' harmonic locked at (${alignedCoord.x}, ${alignedCoord.y}, ${alignedCoord.z})`);
        break;
      }

      case 'OPEN_FUNNEL_STREAM': {
        const payload = instruction.payload as {
          funnelId: string;
          from: string;
          to: string;
          bufferMb: number;
        };

        const bufferBytes = payload.bufferMb * 1024 * 1024;
        this.rssGuard.allocate(bufferBytes, `FunnelBuffer:${payload.funnelId}`);

        const stream: RuntimeFunnelStream = {
          id: payload.funnelId,
          source: payload.from,
          target: payload.to,
          bufferSizeBytes: bufferBytes,
        };

        this.activeStreams.set(payload.funnelId, stream);
        console.log(`  [VM Op] OPEN_FUNNEL_STREAM: Opened ${payload.funnelId} (${payload.from} -> ${payload.to}) [${payload.bufferMb} MB Stream Allocated]`);
        break;
      }

      case 'DECLARE_VAR': {
        const p = instruction.payload as { name: string; dataType: string; mutable: boolean };
        const def = p.dataType === 'number' ? 0 : p.dataType === 'string' ? '' : p.dataType === 'bool' ? false : p.dataType === 'array' ? [] : p.dataType === 'object' ? {} : null;
        this.scopeStack[this.scopeStack.length - 1].variables.set(p.name, def);
        console.log(`  [VM Op] DECLARE_VAR: '${p.name}' (${p.dataType}) → ${JSON.stringify(def)}`);
        break;
      }
      case 'EVAL_PUSH': {
        const p = instruction.payload as { expr: SerializedExpr };
        const result = this.evalExpr(p.expr);
        this.evalStack.push(result);
        console.log(`  [VM Op] EVAL_PUSH: → ${JSON.stringify(result)}`);
        break;
      }
      case 'STORE_VAR': {
        const p = instruction.payload as { name: string };
        const val = this.evalStack.pop();
        const scope = this.scopeStack[this.scopeStack.length - 1];
        const existing = scope.variables.get(p.name);
        if (existing !== undefined && existing !== null) {
          const nt = typeof val, et = typeof existing;
          if (nt !== et && !(existing === null && val === null))
            console.warn(`  [VM Warning] STORE_VAR: type mismatch '${p.name}' (${et} → ${nt})`);
        }
        scope.variables.set(p.name, val);
        console.log(`  [VM Op] STORE_VAR: '${p.name}' = ${JSON.stringify(val)}`);
        break;
      }
      case 'BLOCK_ENTER': {
        const p = instruction.payload as { scopeId: number };
        this.scopeStack.push({ variables: new Map(), scopeId: p.scopeId });
        console.log(`  [VM Op] BLOCK_ENTER: Scope ${p.scopeId}`);
        break;
      }
      case 'BLOCK_EXIT': {
        const p = instruction.payload as { scopeId: number };
        this.scopeStack.pop();
        console.log(`  [VM Op] BLOCK_EXIT: Scope ${p.scopeId} exited`);
        break;
      }
      case 'IF_TRUE_GOTO': {
        const p = instruction.payload as { label: string };
        const cond = this.evalStack.pop();
        if (cond === true) {
          const t = this.labelMap.get(p.label);
          if (t !== undefined) { this.instructionPointer = t; return true; }
        }
        break;
      }
      case 'IF_FALSE_GOTO': {
        const p = instruction.payload as { label: string };
        const cond = this.evalStack.pop();
        if (cond === false || cond === null || cond === undefined || cond === 0) {
          const t = this.labelMap.get(p.label);
          if (t !== undefined) { this.instructionPointer = t; return true; }
        }
        break;
      }
      case 'GOTO': {
        const p = instruction.payload as { label: string };
        const t = this.labelMap.get(p.label);
        if (t !== undefined) { this.instructionPointer = t; return true; }
        break;
      }
      case 'LABEL':
        break;
      case 'BREAK': {
        if (this.loopStack.length === 0) throw new Error('[VM Fault] BREAK outside loop');
        const t = this.labelMap.get(this.loopStack[this.loopStack.length - 1].breakTarget);
        if (t !== undefined) { this.instructionPointer = t; return true; }
        break;
      }
      case 'CONTINUE': {
        if (this.loopStack.length === 0) throw new Error('[VM Fault] CONTINUE outside loop');
        const t = this.labelMap.get(this.loopStack[this.loopStack.length - 1].continueTarget);
        if (t !== undefined) { this.instructionPointer = t; return true; }
        break;
      }

      // ── Function Definition: register function in registry ──────────────
      case 'FUNC_DEF': {
        const p = instruction.payload as { name: string; paramCount: number };
        this.funcRegistry.set(p.name, { paramCount: p.paramCount, entryIndex: this.instructionPointer + 1 });
        console.log(`  [VM Op] FUNC_DEF: Registered function '${p.name}' (${p.paramCount} params)`);
        break;
      }

      // ── Function Call: push args, jump to entry ─────────────────────────
      case 'FUNC_CALL': {
        const p = instruction.payload as { name: string; argCount: number; args: SerializedExpr[] };
        const func = this.funcRegistry.get(p.name);
        if (!func) throw new Error(`[VM Fault] Function '${p.name}' is not defined`);
        if (func.paramCount !== p.argCount) {
          throw new Error(`[VM Fault] Function '${p.name}' expects ${func.paramCount} args, got ${p.argCount}`);
        }

        // Evaluate and push arguments
        for (const arg of p.args) {
          this.evalStack.push(this.evalExpr(arg));
        }

        // Push return address onto call stack
        this.callStack.push(this.instructionPointer + 1);

        // Jump to function entry
        this.instructionPointer = func.entryIndex;
        return true;
      }

      // ── Return: pop return value, restore IP ────────────────────────────
      case 'RETURN': {
        const p = instruction.payload as { hasReturnValue: boolean };
        let returnValue: any = undefined;
        if (p.hasReturnValue) {
          returnValue = this.evalStack.pop();
        }
        // Pop call stack to get return address
        if (this.callStack.length > 0) {
          const returnAddr = this.callStack.pop()!;
          this.instructionPointer = returnAddr;
          if (p.hasReturnValue) {
            this.evalStack.push(returnValue);
          }
          return true;
        } else {
          // Top-level return — halt execution
          console.log(`  [VM Op] RETURN (top-level): ${p.hasReturnValue ? `value=${JSON.stringify(returnValue)}` : '(void)'}`);
          this.instructionPointer = this.instructionList.length;
          if (p.hasReturnValue) {
            this.evalStack.push(returnValue);
          }
          return true;
        }
      }

      default:
        throw new Error(`[VM Panic] Unknown opcode: ${(instruction as any).op}`);
    }
    return false;
  }

  // ── Recursive expression evaluator ────────────────────────────────────
  private evalExpr(expr: SerializedExpr): any {
    switch (expr.kind) {
      case 'literal':
        return expr.value;

      case 'identifier': {
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
          const val = this.scopeStack[i].variables.get(expr.name);
          if (val !== undefined) return val;
        }
        throw new Error(`[VM Fault] Undefined variable '${expr.name}'`);
      }

      case 'array':
        return expr.elements.map(e => this.evalExpr(e));

      case 'object':
        const obj: Record<string, any> = {};
        for (const p of expr.properties) obj[p.key] = this.evalExpr(p.value);
        return obj;

      case 'unary': {
        const operand = this.evalExpr(expr.operand);
        if (expr.op === TokenType.OP_NOT) return !operand;
        throw new Error(`[VM Fault] Unknown unary operator '!'`);
      }

      case 'binary': {
        const left = this.evalExpr(expr.left);
        const right = this.evalExpr(expr.right);

        switch (expr.op) {
          case TokenType.OP_ADD: return left + right;
          case TokenType.OP_SUB: return left - right;
          case TokenType.OP_MUL: return left * right;
          case TokenType.OP_DIV:
            if (right === 0) throw new Error('[VM Fault] Division by zero');
            return left / right;
          case TokenType.OP_MOD: return left % right;
          case TokenType.OP_EQ:  return left === right;
          case TokenType.OP_NEQ: return left !== right;
          case TokenType.OP_LT:  return left < right;
          case TokenType.OP_GT:  return left > right;
          case TokenType.OP_LTE: return left <= right;
          case TokenType.OP_GTE: return left >= right;
          case TokenType.OP_AND: return left && right;
          case TokenType.OP_OR:  return left || right;
          default:
            throw new Error(`[VM Fault] Unknown binary operator '${TokenType[expr.op]}'`);
        }
      }
    }
    throw new Error(`[VM Panic] unreachable expression kind`);
  }

  public getVMState() {
    const allVars: Record<string, any> = {};
    for (const scope of this.scopeStack)
      for (const [k, v] of scope.variables) allVars[k] = v;
    return {
      nodesCount: this.activeNodes.size,
      streamsCount: this.activeStreams.size,
      allocatedMemoryMb: this.rssGuard.getUsedMb(),
      determinismSigmaSq: 0.0,
      variables: allVars,
      activeScopes: this.scopeStack.length,
    };
  }
}
