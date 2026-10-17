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
  ImportStatementNode,
  DeclarativeSpatialNodeWrapper,
  CallExpressionNode,
  IdentifierNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  ArrayLiteralNode,
  ObjectLiteralNode,
  MemberExpressionNode,
} from '../ast/UnifiedAST';
import { Scope } from './SymbolTable';
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

  constructor() {
    this.globalScope = new Scope('global');
    this.currentScope = this.globalScope;
  }

  public analyze(program: UnifiedProgramNode): { isValid: boolean; diagnostics: SemanticDiagnostic[] } {
    this.diagnostics = [];
    this.importedModules.clear();
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

      case 'DeclarativeSpatialNode':
        this.analyzeDeclarativeSpatialNode(stmt);
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
    // 1. Define function in outer scope
    const defined = this.currentScope.define({
      name: node.name,
      kind: 'function',
      typeAnnotation: node.returnTypeAnnotation,
      scopeLevel: this.currentScope.level,
      paramCount: node.params.length,
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

    // 2. Enter Function Scope
    const functionScope = new Scope('function', this.currentScope);
    this.currentScope = functionScope;

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

    // 4. Analyze Function Body
    for (const bodyStmt of node.body.statements) {
      this.analyzeStatement(bodyStmt);
    }

    // 5. Exit Function Scope
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
    this.analyzeBlockStatement(node.body);
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

    for (const stmt of node.body.statements) {
      this.analyzeStatement(stmt);
    }

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
    const importName = node.alias || node.moduleName;
    this.currentScope.define({
      name: importName,
      kind: 'module',
      scopeLevel: this.currentScope.level,
      span: node.span,
    });
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
        for (const prop of expr.properties) {
          this.analyzeExpression(prop.value);
        }
        break;

      case 'MemberExpression':
        this.analyzeExpression(expr.object);
        if (expr.computed && typeof expr.property !== 'string') {
          this.analyzeExpression(expr.property as ExpressionNode);
        }
        break;

      case 'Literal':
        // Literals are always semantically valid
        break;
    }
  }

  private analyzeIdentifier(node: IdentifierNode): void {
    const symbol = this.currentScope.resolve(node.name);
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
        const symbol = this.currentScope.resolve(node.left.name);
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

  private analyzeCallExpression(node: CallExpressionNode): void {
    this.analyzeExpression(node.callee);

    // If calling by name, check parameter count
    if (node.callee.kind === 'Identifier') {
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

    for (const arg of node.args) {
      this.analyzeExpression(arg);
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
