import {
  UnifiedProgramNode,
  UnifiedStatementNode,
  ExpressionNode,
  VariableDeclarationNode,
  FunctionDeclarationNode,
  ReturnStatementNode,
  IfStatementNode,
  WhileStatementNode,
  ForStatementNode,
  BlockStatementNode,
  ExpressionStatementNode,
  PrintStatementNode,
  BreakStatementNode,
  InputStatementNode,
  ImportStatementNode,
  ExportStatementNode,
  ModuleDeclarationNode,
  StructDeclarationNode,
  EnumDeclarationNode,
  DeclarativeSpatialNodeWrapper,
  CallExpressionNode,
  IdentifierNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  ArrayLiteralNode,
  ObjectLiteralNode,
  MemberExpressionNode,
  AwaitExpressionNode,
} from '../ast/UnifiedAST';
import { Scope, SymbolEntry } from './SymbolTable';
import { ONE_BUILTIN_FUNCTIONS } from '../stdlib/OneStdLib';

export interface SemanticDiagnostic {
  code: string;
  message: string;
  line?: number;
  column?: number;
}

export class SemanticAnalyzer {
  private currentScope: Scope;
  private globalScope: Scope;
  private diagnostics: SemanticDiagnostic[] = [];
  private importedModules: Set<string> = new Set();
  private structRegistry: Map<string, StructDeclarationNode> = new Map();
  private enumRegistry: Map<string, EnumDeclarationNode> = new Map();
  private asyncContextStack: boolean[] = [true];
  private loopDepth: number = 0;

  constructor() {
    this.globalScope = new Scope('global');
    this.currentScope = this.globalScope;
  }

  public analyze(
    program: UnifiedProgramNode,
    externalSymbols?: {
      structs?: StructDeclarationNode[];
      enums?: EnumDeclarationNode[];
      functions?: Array<{ name: string; paramCount?: number; returnTypeAnnotation?: string }>;
    }
  ): { isValid: boolean; diagnostics: SemanticDiagnostic[] } {
    this.diagnostics = [];
    this.importedModules.clear();
    this.structRegistry.clear();
    this.enumRegistry.clear();
    this.asyncContextStack = [true];
    this.loopDepth = 0;
    this.globalScope = new Scope('global');
    for (const bName of Object.keys(ONE_BUILTIN_FUNCTIONS)) {
      this.globalScope.define({
        name: bName,
        kind: 'function',
        scopeLevel: 0,
      });
    }
    // Predefined runtime objects
    this.globalScope.define({
      name: 'spatial',
      kind: 'variable',
      scopeLevel: 0,
    });
    this.currentScope = this.globalScope;

    if (externalSymbols) {
      if (externalSymbols.structs) {
        for (const s of externalSymbols.structs) {
          this.structRegistry.set(s.name, s);
          this.globalScope.define({
            name: s.name,
            kind: 'struct',
            scopeLevel: 0,
            span: s.span,
          });
        }
      }
      if (externalSymbols.enums) {
        for (const e of externalSymbols.enums) {
          this.enumRegistry.set(e.name, e);
          this.globalScope.define({
            name: e.name,
            kind: 'enum',
            scopeLevel: 0,
            span: e.span,
          });
        }
      }
      if (externalSymbols.functions) {
        for (const fn of externalSymbols.functions) {
          this.globalScope.define({
            name: fn.name,
            kind: 'function',
            paramCount: fn.paramCount,
            typeAnnotation: fn.returnTypeAnnotation,
            scopeLevel: 0,
          });
        }
      }
    }

    // Pre-register top-level functions to support mutual recursion and forward references
    for (const stmt of program.body) {
      let fnNode: FunctionDeclarationNode | undefined = undefined;
      if (stmt.kind === 'FunctionDeclaration') {
        fnNode = stmt as FunctionDeclarationNode;
      } else if (stmt.kind === 'ExportStatement' && (stmt as ExportStatementNode).declaration?.kind === 'FunctionDeclaration') {
        fnNode = (stmt as ExportStatementNode).declaration as FunctionDeclarationNode;
      }

      if (fnNode) {
        const defined = this.globalScope.define({
          name: fnNode.name,
          kind: 'function',
          typeAnnotation: fnNode.returnTypeAnnotation,
          scopeLevel: 0,
          paramCount: fnNode.params.length,
          isAsync: !!fnNode.isAsync,
          span: fnNode.span,
        });
        if (!defined) {
          this.addDiagnostic(
            'E3001',
            `Duplicate declaration of function '${fnNode.name}' in the same scope`,
            fnNode.span?.start.line,
            fnNode.span?.start.column
          );
        }
      }
    }

    for (const stmt of program.body) {
      this.analyzeStatement(stmt);
    }

    return {
      isValid: this.diagnostics.length === 0,
      diagnostics: this.diagnostics,
    };
  }

  public getGlobalScope(): Scope {
    return this.globalScope;
  }

  // ── Statement Analysis ─────────────────────────────────────────────────────

  private analyzeStatement(stmt: UnifiedStatementNode): void {
    switch (stmt.kind) {
      case 'VariableDeclaration':
        this.analyzeVariableDeclaration(stmt);
        break;

      case 'FunctionDeclaration':
        this.analyzeFunctionDeclaration(stmt);
        break;

      case 'ReturnStatement':
        this.analyzeReturnStatement(stmt);
        break;

      case 'IfStatement':
        this.analyzeIfStatement(stmt);
        break;

      case 'WhileStatement':
        this.analyzeWhileStatement(stmt);
        break;

      case 'ForStatement':
        this.analyzeForStatement(stmt);
        break;

      case 'BlockStatement':
        this.analyzeBlockStatement(stmt);
        break;

      case 'ExpressionStatement':
        this.analyzeExpressionStatement(stmt);
        break;

      case 'PrintStatement':
        this.analyzePrintStatement(stmt);
        break;

      case 'ImportStatement':
        this.analyzeImportStatement(stmt);
        break;

      case 'ModuleDeclaration':
        this.analyzeModuleDeclaration(stmt);
        break;

      case 'ExportStatement':
        this.analyzeExportStatement(stmt);
        break;

      case 'StructDeclaration':
        this.analyzeStructDeclaration(stmt);
        break;

      case 'EnumDeclaration':
        this.analyzeEnumDeclaration(stmt);
        break;

      case 'DeclarativeSpatialNode':
        this.analyzeDeclarativeSpatialNode(stmt);
        break;

      case 'BreakStatement':
        if (this.loopDepth <= 0) {
          this.addDiagnostic(
            'E3010',
            `'one stop' statement is not allowed outside of a loop body`,
            stmt.span?.start.line,
            stmt.span?.start.column
          );
        }
        break;

      case 'InputStatement':
        if (!this.currentScope.resolve(stmt.target)) {
          this.currentScope.define({
            name: stmt.target,
            kind: 'variable',
            typeAnnotation: 'string',
            scopeLevel: this.currentScope.level,
            span: stmt.span,
          });
        }
        break;
    }
  }

  private analyzeVariableDeclaration(node: VariableDeclarationNode): void {
    // 1. Analyze initializer first (cannot reference self in declaration)
    if (node.initializer) {
      this.analyzeExpression(node.initializer);
    }

    // 2. Define in current scope
    const defined = this.currentScope.define({
      name: node.identifier,
      kind: node.isConst ? 'constant' : 'variable',
      typeAnnotation: node.typeAnnotation,
      scopeLevel: this.currentScope.level,
      span: node.span,
    });

    if (!defined) {
      this.addDiagnostic(
        'E3001',
        `Duplicate declaration of identifier '${node.identifier}' in the same scope`,
        node.span?.start.line,
        node.span?.start.column
      );
    }
  }

  private analyzeFunctionDeclaration(node: FunctionDeclarationNode): void {
    // 1. Define function in outer scope if not already pre-registered
    if (!this.currentScope.resolveLocal(node.name)) {
      const defined = this.currentScope.define({
        name: node.name,
        kind: 'function',
        typeAnnotation: node.returnTypeAnnotation,
        scopeLevel: this.currentScope.level,
        paramCount: node.params.length,
        isAsync: !!node.isAsync,
        span: node.span,
      });

      if (!defined) {
        this.addDiagnostic(
          'E3001',
          `Duplicate declaration of function '${node.name}' in the same scope`,
          node.span?.start.line,
          node.span?.start.column
        );
      }
    }

    // 2. Enter Function Scope
    const functionScope = new Scope('function', this.currentScope);
    this.currentScope = functionScope;
    this.asyncContextStack.push(!!node.isAsync);

    // 3. Define parameters
    for (const param of node.params) {
      const paramDefined = this.currentScope.define({
        name: param.name,
        kind: 'parameter',
        typeAnnotation: param.typeAnnotation,
        scopeLevel: this.currentScope.level,
        span: param.span,
      });

      if (!paramDefined) {
        this.addDiagnostic(
          'E3002',
          `Duplicate parameter name '${param.name}' in function '${node.name}'`,
          param.span?.start.line,
          param.span?.start.column
        );
      }
    }

    // Pre-register nested functions in this function scope for mutual recursion
    for (const bodyStmt of node.body.statements) {
      if (bodyStmt.kind === 'FunctionDeclaration') {
        const defined = this.currentScope.define({
          name: bodyStmt.name,
          kind: 'function',
          typeAnnotation: bodyStmt.returnTypeAnnotation,
          scopeLevel: this.currentScope.level,
          paramCount: bodyStmt.params.length,
          isAsync: !!bodyStmt.isAsync,
          span: bodyStmt.span,
        });
        if (!defined) {
          this.addDiagnostic(
            'E3001',
            `Duplicate declaration of function '${bodyStmt.name}' in the same scope`,
            bodyStmt.span?.start.line,
            bodyStmt.span?.start.column
          );
        }
      }
    }

    // 4. Analyze Function Body
    for (const bodyStmt of node.body.statements) {
      this.analyzeStatement(bodyStmt);
    }

    // 5. Exit Function Scope
    node.capturedVars = Array.from(functionScope.capturedVars);
    this.asyncContextStack.pop();
    this.currentScope = this.currentScope.parent!;
  }

  private analyzeReturnStatement(node: ReturnStatementNode): void {
    const enclosingFunc = this.currentScope.getEnclosingFunction();
    if (!enclosingFunc) {
      this.addDiagnostic(
        'E3003',
        `'return' statement is not allowed outside of a function body`,
        node.span?.start.line,
        node.span?.start.column
      );
    }

    if (node.value) {
      this.analyzeExpression(node.value);
    }
  }

  private analyzeIfStatement(node: IfStatementNode): void {
    this.analyzeExpression(node.condition);
    this.analyzeBlockStatement(node.consequent);

    if (node.alternate) {
      if (node.alternate.kind === 'IfStatement') {
        this.analyzeIfStatement(node.alternate);
      } else {
        this.analyzeBlockStatement(node.alternate);
      }
    }
  }

  private analyzeWhileStatement(node: WhileStatementNode): void {
    this.analyzeExpression(node.condition);
    this.loopDepth++;
    this.analyzeBlockStatement(node.body);
    this.loopDepth--;
  }

  private analyzeForStatement(node: ForStatementNode): void {
    this.analyzeExpression(node.iterable);

    // Block scope for iterator variable
    const loopScope = new Scope('block', this.currentScope);
    this.currentScope = loopScope;

    this.currentScope.define({
      name: node.iterator,
      kind: 'variable',
      scopeLevel: this.currentScope.level,
      span: node.span,
    });

    this.loopDepth++;
    for (const stmt of node.body.statements) {
      this.analyzeStatement(stmt);
    }
    this.loopDepth--;

    this.currentScope = this.currentScope.parent!;
  }

  private analyzeBlockStatement(node: BlockStatementNode): void {
    const blockScope = new Scope('block', this.currentScope);
    this.currentScope = blockScope;

    for (const stmt of node.statements) {
      this.analyzeStatement(stmt);
    }

    this.currentScope = this.currentScope.parent!;
  }

  private analyzeExpressionStatement(node: ExpressionStatementNode): void {
    this.analyzeExpression(node.expression);
  }

  private analyzePrintStatement(node: PrintStatementNode): void {
    this.analyzeExpression(node.expression);
  }

  private analyzeImportStatement(node: ImportStatementNode): void {
    if (this.importedModules.has(node.moduleName)) {
      this.addDiagnostic(
        'E3007',
        `Duplicate import of module '${node.moduleName}'`,
        node.span?.start.line,
        node.span?.start.column
      );
      return;
    }

    this.importedModules.add(node.moduleName);
    if (node.specifiers && node.specifiers.length > 0) {
      for (const spec of node.specifiers) {
        const importName = spec.alias || spec.name;
        this.currentScope.define({
          name: importName,
          kind: 'variable',
          scopeLevel: this.currentScope.level,
          span: spec.span,
        });
      }
    } else {
      const importName = node.alias || node.moduleName;
      this.currentScope.define({
        name: importName,
        kind: 'module',
        scopeLevel: this.currentScope.level,
        span: node.span,
      });
    }
  }

  private analyzeModuleDeclaration(node: ModuleDeclarationNode): void {
    this.currentScope.define({
      name: node.name,
      kind: 'module',
      scopeLevel: this.currentScope.level,
      span: node.span,
    });
  }

  private analyzeExportStatement(node: ExportStatementNode): void {
    if (node.declaration) {
      this.analyzeStatement(node.declaration);
    } else if (node.specifiers) {
      for (const spec of node.specifiers) {
        const sym = this.currentScope.resolve(spec.name);
        if (!sym) {
          this.addDiagnostic(
            'E3001',
            `Export of undeclared identifier '${spec.name}'`,
            spec.span?.start.line,
            spec.span?.start.column
          );
        }
      }
    }
  }

  private analyzeDeclarativeSpatialNode(node: DeclarativeSpatialNodeWrapper): void {
    if (node.nodeType === 'Node') {
      const id = node.payload.id as string;
      const defined = this.globalScope.define({
        name: id,
        kind: 'spatial_node',
        scopeLevel: 0,
      });

      if (!defined) {
        this.addDiagnostic('E3006', `Duplicate spatial node identifier '${id}'`);
      }
    }
  }

  // ── Expression Analysis ────────────────────────────────────────────────────

  private analyzeExpression(expr: ExpressionNode): void {
    switch (expr.kind) {
      case 'Identifier':
        this.analyzeIdentifier(expr);
        break;

      case 'BinaryExpression':
        this.analyzeBinaryExpression(expr);
        break;

      case 'UnaryExpression':
        this.analyzeUnaryExpression(expr);
        break;

      case 'CallExpression':
        this.analyzeCallExpression(expr);
        break;

      case 'ArrayLiteral':
        for (const el of expr.elements) {
          this.analyzeExpression(el);
        }
        break;

      case 'ObjectLiteral':
        this.analyzeObjectLiteral(expr);
        break;

      case 'MemberExpression':
        this.analyzeMemberExpression(expr);
        break;

      case 'Literal':
        // Literals are always semantically valid
        break;

      case 'AwaitExpression':
        this.analyzeAwaitExpression(expr);
        break;

      case 'FunctionDeclaration':
        this.analyzeFunctionDeclaration(expr);
        break;
    }
  }

  private analyzeAwaitExpression(node: AwaitExpressionNode): void {
    const isAsync = this.asyncContextStack[this.asyncContextStack.length - 1];
    if (!isAsync) {
      this.addDiagnostic(
        'E3006',
        `'await' expression is only valid within an async function or at the top level of a module`,
        node.span?.start.line,
        node.span?.start.column
      );
    }
    this.analyzeExpression(node.argument);
  }

  private resolveIdentifierWithCapture(name: string): SymbolEntry | undefined {
    let foundScope: Scope | undefined = undefined;
    let curr: Scope | undefined = this.currentScope;
    while (curr) {
      if (curr.symbols.has(name)) {
        foundScope = curr;
        break;
      }
      curr = curr.parent;
    }

    if (!foundScope) {
      return undefined;
    }

    // Top-level global symbols are not captured
    if (foundScope.scopeType === 'global') {
      return foundScope.symbols.get(name);
    }

    // Check if symbol was declared in an enclosing function
    const enclosingFuncOfDecl = foundScope.getEnclosingFunction();
    const enclosingFuncOfUse = this.currentScope.getEnclosingFunction();

    if (enclosingFuncOfUse && enclosingFuncOfUse !== enclosingFuncOfDecl) {
      let s: Scope | undefined = this.currentScope;
      while (s && s !== foundScope) {
        if (s.scopeType === 'function') {
          s.capturedVars.add(name);
        }
        s = s.parent;
      }
    }

    return foundScope.symbols.get(name);
  }

  private analyzeIdentifier(node: IdentifierNode): void {
    const symbol = this.resolveIdentifierWithCapture(node.name);
    if (!symbol) {
      this.addDiagnostic(
        'E3004',
        `Undefined identifier '${node.name}'`,
        node.span?.start.line,
        node.span?.start.column
      );
    }
  }

  private analyzeBinaryExpression(node: BinaryExpressionNode): void {
    // If it's an assignment operator '='
    if (node.operator === '=') {
      if (node.left.kind === 'Identifier') {
        const symbol = this.resolveIdentifierWithCapture(node.left.name);
        if (!symbol) {
          this.addDiagnostic(
            'E3004',
            `Cannot assign to undefined identifier '${node.left.name}'`,
            node.left.span?.start.line,
            node.left.span?.start.column
          );
        } else if (symbol.kind === 'constant') {
          this.addDiagnostic(
            'E3008',
            `Cannot reassign to constant '${node.left.name}'`,
            node.left.span?.start.line,
            node.left.span?.start.column
          );
        }
      }
    } else {
      this.analyzeExpression(node.left);
    }

    this.analyzeExpression(node.right);
  }

  private analyzeUnaryExpression(node: UnaryExpressionNode): void {
    this.analyzeExpression(node.operand);
  }

  private analyzeStructDeclaration(node: StructDeclarationNode): void {
    if (this.currentScope.resolveLocal(node.name)) {
      this.addDiagnostic(
        'E2001',
        `Duplicate declaration of struct '${node.name}'`,
        node.span?.start.line,
        node.span?.start.column
      );
      return;
    }

    const fieldMap = new Map<string, string>();
    for (const field of node.fields) {
      if (!this.isKnownType(field.typeAnnotation)) {
        this.addDiagnostic(
          'E2002',
          `Unknown type '${field.typeAnnotation}' for field '${field.name}' in struct '${node.name}'`,
          field.span?.start.line,
          field.span?.start.column
        );
      }
      fieldMap.set(field.name, field.typeAnnotation);
    }

    this.structRegistry.set(node.name, node);
    this.currentScope.define({
      name: node.name,
      kind: 'struct',
      scopeLevel: this.currentScope.level,
      paramCount: node.fields.length,
      structFields: fieldMap,
      span: node.span,
    });
  }

  private analyzeEnumDeclaration(node: EnumDeclarationNode): void {
    if (this.currentScope.resolveLocal(node.name)) {
      this.addDiagnostic(
        'E2001',
        `Duplicate declaration of enum '${node.name}'`,
        node.span?.start.line,
        node.span?.start.column
      );
      return;
    }

    const variantMap = new Map<string, number | string>();
    for (const v of node.variants) {
      variantMap.set(v.name, v.value);
    }

    this.enumRegistry.set(node.name, node);
    this.currentScope.define({
      name: node.name,
      kind: 'enum',
      scopeLevel: this.currentScope.level,
      enumVariants: variantMap,
      span: node.span,
    });
  }

  private isKnownType(typeStr?: string): boolean {
    if (!typeStr) return false;
    let base = typeStr.trim();
    if (base.endsWith('[]')) {
      base = base.slice(0, -2).trim();
    } else {
      const match = base.match(/^(.+)\[\d+\]$/);
      if (match) {
        base = match[1].trim();
      }
    }
    const primitives = new Set([
      'i32', 'int32', 'int',
      'f32', 'float32', 'float',
      'float64', 'number',
      'bool', 'boolean',
      'string',
      'void',
      'null',
      'any'
    ]);
    if (primitives.has(base.toLowerCase())) return true;
    if (this.structRegistry.has(base) || this.enumRegistry.has(base)) return true;
    return false;
  }

  private analyzeCallExpression(node: CallExpressionNode): void {
    if (node.callee.kind === 'Identifier') {
      const struct = this.structRegistry.get(node.callee.name);
      if (struct) {
        if (node.args.length !== struct.fields.length) {
          this.addDiagnostic(
            'E2006',
            `Expected ${struct.fields.length} arguments for struct '${node.callee.name}', but got ${node.args.length}`,
            node.span?.start.line,
            node.span?.start.column
          );
        }
        for (const arg of node.args) {
          this.analyzeExpression(arg);
        }
        return;
      }

      const symbol = this.currentScope.resolve(node.callee.name);
      if (symbol && symbol.kind === 'function' && symbol.paramCount !== undefined) {
        if (node.args.length !== symbol.paramCount) {
          this.addDiagnostic(
            'E3005',
            `Expected ${symbol.paramCount} argument(s) for function '${node.callee.name}', but got ${node.args.length}`,
            node.span?.start.line,
            node.span?.start.column
          );
        }
      }
    }

    this.analyzeExpression(node.callee);
    for (const arg of node.args) {
      this.analyzeExpression(arg);
    }
  }

  private analyzeObjectLiteral(node: ObjectLiteralNode): void {
    if (node.structName) {
      const struct = this.structRegistry.get(node.structName);
      if (!struct) {
        this.addDiagnostic(
          'E2002',
          `Unknown struct '${node.structName}'`,
          node.span?.start.line,
          node.span?.start.column
        );
      } else {
        const allowed = new Set(struct.fields.map((f) => f.name));
        const provided = new Set<string>();

        for (const prop of node.properties) {
          if (!allowed.has(prop.key)) {
            this.addDiagnostic(
              'E2004',
              `Invalid field '${prop.key}' on struct '${node.structName}' (structs are sealed)`,
              prop.span?.start.line,
              prop.span?.start.column
            );
          }
          provided.add(prop.key);
        }

        for (const f of struct.fields) {
          if (!provided.has(f.name)) {
            this.addDiagnostic(
              'E2005',
              `Missing required field '${f.name}' for struct '${node.structName}'`,
              node.span?.start.line,
              node.span?.start.column
            );
          }
        }
      }
    }

    for (const prop of node.properties) {
      this.analyzeExpression(prop.value);
    }
  }

  private analyzeMemberExpression(node: MemberExpressionNode): void {
    if (node.object.kind === 'Identifier') {
      const enumDef = this.enumRegistry.get(node.object.name);
      if (enumDef) {
        if (!node.computed && typeof node.property === 'string') {
          const hasVariant = enumDef.variants.some((v) => v.name === node.property);
          if (!hasVariant) {
            this.addDiagnostic(
              'E2003',
              `Unknown enum variant '${node.property}' on enum '${node.object.name}'`,
              node.span?.start.line,
              node.span?.start.column
            );
          }
        }
        return; // Enum access validated
      }

      // Check if variable has a known struct type
      const varSym = this.currentScope.resolve(node.object.name);
      if (varSym && varSym.typeAnnotation) {
        const structDef = this.structRegistry.get(varSym.typeAnnotation);
        if (structDef && !node.computed && typeof node.property === 'string') {
          const hasField = structDef.fields.some((f) => f.name === node.property);
          if (!hasField) {
            this.addDiagnostic(
              'E2004',
              `Field '${node.property}' does not exist on struct '${structDef.name}'`,
              node.span?.start.line,
              node.span?.start.column
            );
          }
        }
      }
    }

    this.analyzeExpression(node.object);
    if (node.computed && typeof node.property !== 'string') {
      this.analyzeExpression(node.property as ExpressionNode);
    }
  }

  private addDiagnostic(code: string, message: string, line?: number, column?: number): void {
    this.diagnostics.push({
      code,
      message,
      line,
      column,
    });
  }
}
