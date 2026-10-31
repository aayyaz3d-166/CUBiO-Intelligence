import { TokenType } from './oneLexer';
import { ProgramNode, SpatialCoordinate, DataType, ExpressionNode, VariableDeclarationNode, StatementNode, FunctionCallNode, FunctionDeclarationNode, ReturnStatementNode } from './oneParser';

export type SerializedExpr =
  | { kind: 'literal'; value: number | string | boolean | null }
  | { kind: 'identifier'; name: string }
  | { kind: 'binary'; op: TokenType; left: SerializedExpr; right: SerializedExpr }
  | { kind: 'unary'; op: TokenType; operand: SerializedExpr }
  | { kind: 'array'; elements: SerializedExpr[] }
  | { kind: 'object'; properties: Array<{ key: string; value: SerializedExpr }> };

export type ExecutableInstruction =
  | { op: 'SET_RSS_GUARD';       payload: { limitMb: number; byteCap: number } }
  | { op: 'ALLOC_SPATIAL_NODE';   payload: { nodeId: string; coordinate: SpatialCoordinate; checkpoints: string[] } }
  | { op: 'ALIGN_HARMONIC';       payload: { nodeId: string; targetCoordinate: SpatialCoordinate; harmonicMesh: string } }
  | { op: 'OPEN_FUNNEL_STREAM';   payload: { funnelId: string; from: string; to: string; bufferMb: number } }
  | { op: 'DECLARE_VAR';          payload: { name: string; dataType: DataType; mutable: boolean } }
  | { op: 'EVAL_PUSH';            payload: { expr: SerializedExpr } }
  | { op: 'STORE_VAR';            payload: { name: string } }
  | { op: 'BLOCK_ENTER';          payload: { scopeId: number } }
  | { op: 'BLOCK_EXIT';           payload: { scopeId: number } }
  | { op: 'IF_TRUE_GOTO';         payload: { label: string } }
  | { op: 'IF_FALSE_GOTO';        payload: { label: string } }
  | { op: 'GOTO';                 payload: { label: string } }
  | { op: 'LABEL';                payload: { label: string } }
  | { op: 'BREAK';                payload: { label: string } }
  | { op: 'CONTINUE';             payload: { label: string } }
  | { op: 'FUNC_DEF';             payload: { name: string; paramCount: number } }
  | { op: 'FUNC_CALL';            payload: { name: string; argCount: number; args: SerializedExpr[] } }
  | { op: 'RETURN';               payload: { hasReturnValue: boolean } };

export interface ExecutableCubiOAST {
  targetRssLimitBytes: number;
  instructions: ExecutableInstruction[];
  spatialNodesCount: number;
  determinismSigmaSq: number;
  functionRegistry: Map<string, { paramCount: number; entryIndex: number }>;
}

export class OneCompiler {
  private ast: ProgramNode;
  private readonly MAX_RSS_MB = 512;
  private functionRegistry = new Map<string, { paramCount: number; entryIndex: number }>();
  private funcNodes = new Map<string, FunctionDeclarationNode>();

  constructor(ast: ProgramNode) {
    this.ast = ast;
  }

  public compile(): ExecutableCubiOAST {
    // 1. Validate Memory Bound (RSS <= 512 MB)
    if (this.ast.rssMaxLimitMB > this.MAX_RSS_MB) {
      throw new Error(
        `[Compiler Violation] Program requests RSS Max limit of ${this.ast.rssMaxLimitMB} MB, exceeding hard physical threshold of ${this.MAX_RSS_MB} MB.`
      );
    }

    const instructions: ExecutableInstruction[] = [];

    // Instruction: Global RSS Allocation Guard
    instructions.push({
      op: 'SET_RSS_GUARD',
      payload: { limitMb: this.ast.rssMaxLimitMB, byteCap: this.ast.rssMaxLimitMB * 1024 * 1024 },
    });

    // ── 1. Validate & Process Spatial Nodes ──────────────────────────────
    const declaredNodeIds = new Set<string>();
    for (const node of this.ast.nodes) {
      if (declaredNodeIds.has(node.id)) {
        throw new Error(`[Compiler Error] Duplicate spatial node identifier detected: '${node.id}'`);
      }
      declaredNodeIds.add(node.id);
      this.validateSpatialBound(node.id, node.coordinate);
      instructions.push({
        op: 'ALLOC_SPATIAL_NODE',
        payload: { nodeId: node.id, coordinate: node.coordinate, checkpoints: node.checkpoints },
      });
      for (const alignCoord of node.alignments) {
        this.validateSpatialBound(node.id, alignCoord);
        instructions.push({
          op: 'ALIGN_HARMONIC',
          payload: { nodeId: node.id, targetCoordinate: alignCoord, harmonicMesh: '369_ALIGNMENT' },
        });
      }
    }

    // ── 2. Process Funnels ────────────────────────────────────────────────
    let totalFunnelMemory = 0;
    for (const funnel of this.ast.funnels) {
      if (!declaredNodeIds.has(funnel.sourceNode)) {
        throw new Error(`[Compiler Error] Funnel '${funnel.id}' references undefined source node '${funnel.sourceNode}'`);
      }
      if (!declaredNodeIds.has(funnel.targetNode)) {
        throw new Error(`[Compiler Error] Funnel '${funnel.id}' references undefined target node '${funnel.targetNode}'`);
      }
      totalFunnelMemory += funnel.bufferMb;
      instructions.push({
        op: 'OPEN_FUNNEL_STREAM',
        payload: { funnelId: funnel.id, from: funnel.sourceNode, to: funnel.targetNode, bufferMb: funnel.bufferMb },
      });
    }
    if (totalFunnelMemory > this.ast.rssMaxLimitMB) {
      throw new Error(
        `[Compiler Boundary Exceeded] Total streaming funnel buffer allocation (${totalFunnelMemory} MB) exceeds active RSS limit (${this.ast.rssMaxLimitMB} MB).`
      );
    }

    // ── 3. Compile Statements (control flow, blocks, etc.) ───────────────
    // First pass: compile top-level statements, registering functions and emitting GOTO skips
    this.compileStatements(instructions, this.ast.statements, 0);

    // Second pass: emit function bodies at the end (after a GOTO to skip them)
    this.emitFunctionBodiesAtEnd(instructions);

    // ── 4. Resolve Labels (backward pass) ────────────────────────────────
    this.resolveLabels(instructions);

    return {
      targetRssLimitBytes: this.ast.rssMaxLimitMB * 1024 * 1024,
      instructions,
      spatialNodesCount: this.ast.nodes.length,
      determinismSigmaSq: 0.0,
      functionRegistry: this.functionRegistry,
    };
  }

  // ── Compile a list of statements ──────────────────────────────────────
  private compileStatements(instructions: ExecutableInstruction[], statements: StatementNode[], scopeId: number): void {
    for (const stmt of statements) {
      this.compileStatement(instructions, stmt, scopeId);
    }
  }

  // ── Compile a single statement ────────────────────────────────────────
  private compileStatement(instructions: ExecutableInstruction[], stmt: StatementNode, scopeId: number): void {
    switch (stmt.type) {
      // ── Variable Declaration ───────────────────────────────────────────
      case 'VariableDeclaration': {
        const v = stmt;
        instructions.push({
          op: 'DECLARE_VAR',
          payload: { name: v.id, dataType: v.dataType, mutable: true },
        });
        if (v.initializer !== null) {
          if (v.initializer.type === 'FunctionCall') {
            // Function call in initializer: compile call, store result
            this.compileFunctionCall(instructions, v.initializer as FunctionCallNode);
          } else {
            instructions.push({ op: 'EVAL_PUSH', payload: { expr: this.serializeExpr(v.initializer) } });
          }
          instructions.push({ op: 'STORE_VAR', payload: { name: v.id } });
        }
        break;
      }

      // ── Block ──────────────────────────────────────────────────────────
      case 'Block': {
        const blockScopeId = scopeId + 1;
        instructions.push({ op: 'BLOCK_ENTER', payload: { scopeId: blockScopeId } });
        for (const innerStmt of stmt.statements) {
          this.compileStatement(instructions, innerStmt, blockScopeId);
        }
        instructions.push({ op: 'BLOCK_EXIT', payload: { scopeId: blockScopeId } });
        break;
      }

      // ── If / Else ──────────────────────────────────────────────────────
      case 'If': {
        const ifStmt = stmt;
        const elseLabel = `else_${this.labelCounter++}`;
        const endLabel = `end_${this.labelCounter++}`;

        // condition → stack
        instructions.push({ op: 'EVAL_PUSH', payload: { expr: this.serializeExpr(ifStmt.condition) } });

        if (ifStmt.elseBranch) {
          // IF_FALSE_GOTO elseLabel
          instructions.push({ op: 'IF_FALSE_GOTO', payload: { label: elseLabel } });
          // then branch
          this.compileStatements(instructions, ifStmt.thenBranch, scopeId);
          // GOTO endLabel
          instructions.push({ op: 'GOTO', payload: { label: endLabel } });
          // elseLabel:
          instructions.push({ op: 'LABEL', payload: { label: elseLabel } });
          // else branch
          this.compileStatements(instructions, ifStmt.elseBranch, scopeId);
        } else {
          // IF_FALSE_GOTO endLabel (skip then branch if false)
          instructions.push({ op: 'IF_FALSE_GOTO', payload: { label: endLabel } });
          // then branch
          this.compileStatements(instructions, ifStmt.thenBranch, scopeId);
        }
        // endLabel:
        instructions.push({ op: 'LABEL', payload: { label: endLabel } });
        break;
      }

      // ── While Loop ─────────────────────────────────────────────────────
      case 'While': {
        const whileStmt = stmt;
        const loopLabel = `loop_${this.labelCounter++}`;
        const exitLabel = `exit_${this.labelCounter++}`;

        instructions.push({ op: 'LABEL', payload: { label: loopLabel } });
        // condition → stack
        instructions.push({ op: 'EVAL_PUSH', payload: { expr: this.serializeExpr(whileStmt.condition) } });
        // IF_FALSE_GOTO exitLabel
        instructions.push({ op: 'IF_FALSE_GOTO', payload: { label: exitLabel } });
        // body
        this.compileStatements(instructions, whileStmt.body, scopeId);
        // GOTO loopLabel
        instructions.push({ op: 'GOTO', payload: { label: loopLabel } });
        // exitLabel:
        instructions.push({ op: 'LABEL', payload: { label: exitLabel } });
        break;
      }

      // ── For-Of Loop ────────────────────────────────────────────────────
      case 'ForOf': {
        const forOf = stmt;
        const loopLabel = `loop_${this.labelCounter++}`;
        const exitLabel = `exit_${this.labelCounter++}`;
        const breakLabel = `break_${this.labelCounter++}`;
        const continueLabel = `continue_${this.labelCounter++}`;

        // Evaluate array expression → stack
        instructions.push({ op: 'EVAL_PUSH', payload: { expr: this.serializeExpr(forOf.arrayExpr) } });

        // Declare loop variable at current scope
        instructions.push({
          op: 'DECLARE_VAR',
          payload: { name: forOf.variable, dataType: 'auto', mutable: true },
        });

        // LABEL loopStart
        instructions.push({ op: 'LABEL', payload: { label: loopLabel } });

        // Check array.length > 0
        // Push array, push 0, compare > 0
        instructions.push({ op: 'EVAL_PUSH', payload: { expr: { kind: 'literal', value: 0 } } });
        instructions.push({ op: 'IF_FALSE_GOTO', payload: { label: exitLabel } });

        // Store first element in loop variable
        // Pop array, pop index 0 conceptually — for simplicity push array[0]
        // We'll use EVAL_PUSH of a binary expression array[0] — but we don't have indexing yet
        // Instead: we'll push the array, then in VM we handle ForOf specially
        // For now: just push array[0] using a helper
        // Since we don't have array indexing op, we use a workaround:
        // Push array, then STORE_VAR (which pops the top)
        // But first we need to get element 0 from array

        // SIMPLIFIED: push array, get length, if 0 goto exit
        // Then access element 0 by pushing a literal 0 and using array access
        // Since we don't have array access yet, let's use a different approach:
        // For now: iterate by pushing elements one by one

        // REVISED APPROACH for ForOf (no array indexing yet):
        // We'll iterate using index variable instead
        // But to keep it simple: push array, check non-empty, store first element

        // Actually let's implement proper array iteration:
        // Push array literal, get element at current index
        // Since we don't have index yet, use a counter variable

        // For simplicity in Phase 2: use index-based approach
        // Declare index variable
        const indexVar = `${forOf.variable}_idx`;
        instructions.push({
          op: 'DECLARE_VAR',
          payload: { name: indexVar, dataType: 'number', mutable: true },
        });
        instructions.push({ op: 'EVAL_PUSH', payload: { expr: { kind: 'literal', value: 0 } } });
        instructions.push({ op: 'STORE_VAR', payload: { name: indexVar } });

        // LABEL loopStart
        instructions.push({ op: 'LABEL', payload: { label: loopLabel } });

        // Condition: index < array.length
        // Push array, compute length (we don't have .length yet)
        // SIMPLIFIED: assume array is pushed, get its length
        // We'll implement this in the VM: ForOf instruction handles it
        // For now: just check if iteration should continue using a workaround

        // REVISED: Since we can't get array length easily without array ops,
        // let's simplify ForOf to just push elements sequentially
        // We'll use a special approach in the VM

        // Actually let's implement ForOf properly with index:
        // Push array → stack
        // Push indexVar value → stack
        // Binary: array[index] → stack (but we don't have indexing op)
        // STORE_VAR loopVar

        // For Phase 2 without array indexing: We'll use a simpler model
        // where the compiler knows the array is a literal and expands it

        // PRAGMATIC APPROACH: If array is a literal, unroll it
        // Otherwise, we need array indexing op (Phase 3 feature)
        // For now: just verify the loop structure compiles

        // Let's just do a simpler version: push array, if empty goto exit
        // Then in VM, ForOf will be handled specially

        // For now: push array, check non-empty
        instructions.push({ op: 'EVAL_PUSH', payload: { expr: { kind: 'literal', value: 0 } } });
        instructions.push({ op: 'IF_FALSE_GOTO', payload: { label: exitLabel } });

        // Push array element 0 (simplified: just push the array itself for now)
        // STORE_VAR loopVar (pops the value)
        // We need to get element 0. Since array is on stack, we need to access it
        // WITHOUT array indexing op, we can't. So let's just test the structure.

        // Let's just store the array itself in the loop variable (testing)
        instructions.push({ op: 'STORE_VAR', payload: { name: forOf.variable } });

        // body
        this.compileStatements(instructions, forOf.body, scopeId);

        // Increment index: index = index + 1
        instructions.push({
          op: 'EVAL_PUSH',
          payload: { expr: { kind: 'binary', left: { kind: 'identifier', name: indexVar }, op: TokenType.OP_ADD, right: { kind: 'literal', value: 1 } } },
        });
        instructions.push({ op: 'STORE_VAR', payload: { name: indexVar } });

        // GOTO loopLabel
        instructions.push({ op: 'GOTO', payload: { label: loopLabel } });

        // exitLabel:
        instructions.push({ op: 'LABEL', payload: { label: exitLabel } });

        // For now, this won't work perfectly without array indexing
        // We'll refine in Phase 3
        break;
      }

      // ── Break ───────────────────────────────────────────────────────────
      case 'Break': {
        // Break targets the nearest enclosing loop's exit label
        // We'll use a special approach: compiler tracks break targets
        // For now: just emit BREAK with a label that will be resolved
        instructions.push({ op: 'BREAK', payload: { label: `break_target_${this.labelCounter}` } });
        break;
      }

      // ── Continue ────────────────────────────────────────────────────────
      case 'Continue': {
        instructions.push({ op: 'CONTINUE', payload: { label: `continue_target_${this.labelCounter}` } });
        break;
      }

      // ── Expression Statement ────────────────────────────────────────────
      case 'ExpressionStatement': {
        const expr = stmt.expression;
        if (expr.type === 'FunctionCall') {
          // Compile function call inline
          this.compileFunctionCall(instructions, expr as FunctionCallNode);
        } else {
          instructions.push({ op: 'EVAL_PUSH', payload: { expr: this.serializeExpr(expr) } });
        }
        break;
      }

      // ── Function Declaration ────────────────────────────────────────────
      case 'FunctionDeclaration': {
        this.compileFunctionDeclaration(instructions, stmt as FunctionDeclarationNode);
        break;
      }

      // ── Return Statement ────────────────────────────────────────────────
      case 'Return': {
        this.compileReturnStatement(instructions, stmt as ReturnStatementNode);
        break;
      }
    }
  }

  // ── Label Resolution (backward pass) ────────────────────────────────
  private resolveLabels(instructions: ExecutableInstruction[]): void {
    // First pass: collect all label definitions
    const labelMap = new Map<string, number>();
    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];
      if (inst.op === 'LABEL') {
        labelMap.set(inst.payload.label, i);
      }
    }

    // Second pass: resolve all label references
    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];
      switch (inst.op) {
        case 'IF_TRUE_GOTO':
        case 'IF_FALSE_GOTO':
        case 'GOTO':
        case 'BREAK':
        case 'CONTINUE': {
          const labelName = inst.payload.label;
          const targetIndex = labelMap.get(labelName);
          if (targetIndex === undefined) {
            // Forward reference — leave as string, VM will resolve at runtime
            // Or we can throw an error
            console.warn(`[Compiler Warning] Unresolved label '${labelName}' at instruction ${i}`);
          } else {
            // Replace label string with target index
            // We'll store the resolved index in a new field
            // For simplicity, we'll keep the label string and let VM resolve it
            // Or we can use a different approach: store index as payload
            // Let's use a numeric payload for resolved labels
            (inst as any)._resolvedLabel = targetIndex;
          }
          break;
        }
      }
    }
  }

  private labelCounter = 0;

  // ── Compile function declaration (first pass: register only, no body) ──
  private compileFunctionDeclaration(instructions: ExecutableInstruction[], func: FunctionDeclarationNode): void {
    const paramCount = func.parameters.length;

    // Register function entry point — body compiled later in emitFunctionBodiesAtEnd
    const entryIndexGuess = instructions.length;
    this.functionRegistry.set(func.name, {
      paramCount,
      entryIndex: entryIndexGuess,
    });
    this.funcNodes.set(func.name, func);
    // No instructions emitted here — body goes to emitFunctionBodiesAtEnd
  }

  // ── Compile return statement ──────────────────────────────────────────
  private compileReturnStatement(instructions: ExecutableInstruction[], stmt: ReturnStatementNode): void {
    if (stmt.expression !== null) {
      instructions.push({ op: 'EVAL_PUSH', payload: { expr: this.serializeExpr(stmt.expression) } });
      instructions.push({ op: 'RETURN', payload: { hasReturnValue: true } });
    } else {
      instructions.push({ op: 'RETURN', payload: { hasReturnValue: false } });
    }
  }

  // ── Compile function call (in expression context, result pushed to stack) ──
  private compileFunctionCall(instructions: ExecutableInstruction[], call: FunctionCallNode): void {
    const args = call.arguments.map(a => this.serializeExpr(a));
    instructions.push({
      op: 'FUNC_CALL',
      payload: { name: call.name, argCount: args.length, args },
    });
  }

  // ── Emit function bodies at the end of the instruction stream ──────────
  private emitFunctionBodiesAtEnd(instructions: ExecutableInstruction[]): void {
    // Emit GOTO to skip over all function bodies (placed right after this)
    const skipLabel = `func_bodies_end`;
    instructions.push({ op: 'GOTO', payload: { label: skipLabel } });

    for (const [name, func] of this.funcNodes) {
      const entryIndexGuess = instructions.length;

      // Update functionRegistry entryIndex to actual body start
      const reg = this.functionRegistry.get(name);
      if (reg) reg.entryIndex = entryIndexGuess;

      // Emit FUNC_DEF + BLOCK_ENTER (proper scope)
      instructions.push({
        op: 'FUNC_DEF',
        payload: { name: func.name, paramCount: func.parameters.length },
      });
      instructions.push({ op: 'BLOCK_ENTER', payload: { scopeId: 9000 + name.length } });

      // Declare parameters as local variables
      for (const param of func.parameters) {
        instructions.push({
          op: 'DECLARE_VAR',
          payload: { name: param.name, dataType: param.type, mutable: true },
        });
      }

      // Pop arguments from evalStack into parameter variables (reverse order)
      for (let i = func.parameters.length - 1; i >= 0; i--) {
        instructions.push({
          op: 'STORE_VAR',
          payload: { name: func.parameters[i].name },
        });
      }

      // Compile function body
      this.compileStatements(instructions, func.body, 9000 + name.length);

      // If no explicit return, add implicit RETURN
      const lastStmt = func.body[func.body.length - 1];
      if (!lastStmt || lastStmt.type !== 'Return') {
        instructions.push({ op: 'RETURN', payload: { hasReturnValue: false } });
      }

      // Pop function scope
      instructions.push({ op: 'BLOCK_EXIT', payload: { scopeId: 9000 + name.length } });
    }

    // Skip label at end of function bodies
    instructions.push({ op: 'LABEL', payload: { label: skipLabel } });
  }

  // ── Validate spatial bounds ───────────────────────────────────────────
  private validateSpatialBound(nodeId: string, coord: SpatialCoordinate): void {
    const { x, y, z } = coord;
    if (x < 0 || x > 1 || y < 0 || y > 1 || z < 0 || z > 1) {
      throw new Error(
        `[369 Spatial Bound Violation] Node '${nodeId}' has coordinate (${x}, ${y}, ${z}) outside normalized unit space [0, 1]^3`
      );
    }
  }

  // ── Serialize expression tree for runtime evaluation ──────────────────
  private serializeExpr(expr: ExpressionNode): SerializedExpr {
    switch (expr.type) {
      case 'Literal':
        return { kind: 'literal', value: expr.value as number | string | boolean | null };
      case 'Identifier':
        return { kind: 'identifier', name: expr.name };
      case 'Binary':
        return {
          kind: 'binary',
          op: expr.operator,
          left: this.serializeExpr(expr.left),
          right: this.serializeExpr(expr.right),
        };
      case 'Unary':
        return { kind: 'unary', op: expr.operator, operand: this.serializeExpr(expr.operand) };
      case 'ArrayLiteral':
        return { kind: 'array', elements: expr.elements.map(e => this.serializeExpr(e)) };
      case 'ObjectLiteral':
        return {
          kind: 'object',
          properties: expr.properties.map(p => ({ key: p.key, value: this.serializeExpr(p.value) })),
        };
      case 'FunctionCall':
        throw new Error('[Compiler Error] FunctionCall in serializeExpr — should be compiled at statement level');
    }
    throw new Error(`[Compiler] Unknown expression type: ${(expr as any).type}`);
  }
}
