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
  StructDeclarationNode,
  EnumDeclarationNode,
  CallExpressionNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  ArrayLiteralNode,
  ObjectLiteralNode,
  MemberExpressionNode,
  AwaitExpressionNode,
  IdentifierNode,
  LiteralNode,
} from '../ast/UnifiedAST';
import {
  Type,
  TypeI32,
  TypeF32,
  TypeBool,
  TypeNumber,
  TypeString,
  TypeBoolean,
  TypeNull,
  TypeVoid,
  TypeAny,
  createArrayType,
  createFunctionType,
  createPromiseType,
  createStructType,
  createEnumType,
  areTypesEqual,
  isTypeAssignable,
  parseTypeString,
  typeToString,
  isNumericType,
  isBooleanType,
} from './TypeSystem';
import { ONE_BUILTIN_FUNCTIONS } from '../stdlib/OneStdLib';

export interface TypeDiagnostic {
  code: string;
  message: string;
  expected?: string;
  received?: string;
  line?: number;
  column?: number;
}

class TypeEnv {
  private bindings: Map<string, Type> = new Map();
  public parent?: TypeEnv;

  constructor(parent?: TypeEnv) {
    this.parent = parent;
  }

  public bind(name: string, type: Type): void {
    this.bindings.set(name, type);
  }

  public lookup(name: string): Type | undefined {
    if (this.bindings.has(name)) {
      return this.bindings.get(name);
    }
    if (this.parent) {
      return this.parent.lookup(name);
    }
    return undefined;
  }
}

export class TypeChecker {
  private currentEnv: TypeEnv;
  private currentExpectedReturnType?: Type;
  private diagnostics: TypeDiagnostic[] = [];
  private customTypes: Map<string, Type> = new Map();

  constructor() {
    this.currentEnv = new TypeEnv();
  }

  public check(
    program: UnifiedProgramNode,
    externalTypes?: Map<string, Type>
  ): { isValid: boolean; diagnostics: TypeDiagnostic[] } {
    this.diagnostics = [];
    this.customTypes.clear();
    this.currentEnv = new TypeEnv();
    for (const bName of Object.keys(ONE_BUILTIN_FUNCTIONS)) {
      this.currentEnv.bind(bName, TypeAny);
    }
    if (externalTypes) {
      for (const [k, v] of externalTypes.entries()) {
        this.customTypes.set(k, v);
        this.currentEnv.bind(k, v);
      }
    }
    this.currentExpectedReturnType = undefined;

    // Pre-bind top-level function signatures for mutual recursion
    for (const stmt of program.body) {
      let fnNode: FunctionDeclarationNode | undefined = undefined;
      if (stmt.kind === 'FunctionDeclaration') {
        fnNode = stmt as FunctionDeclarationNode;
      } else if (stmt.kind === 'ExportStatement' && (stmt as any).declaration?.kind === 'FunctionDeclaration') {
        fnNode = (stmt as any).declaration as FunctionDeclarationNode;
      }

      if (fnNode) {
        const paramTypes = fnNode.params.map((p) => parseTypeString(p.typeAnnotation));
        const returnType = fnNode.returnTypeAnnotation
          ? parseTypeString(fnNode.returnTypeAnnotation)
          : TypeAny;
        const actualReturnType = fnNode.isAsync ? createPromiseType(returnType) : returnType;
        this.currentEnv.bind(fnNode.name, createFunctionType(paramTypes, actualReturnType));
      }
    }

    for (const stmt of program.body) {
      this.checkStatement(stmt);
    }

    return {
      isValid: this.diagnostics.length === 0,
      diagnostics: this.diagnostics,
    };
  }

  // ── Statement Checking ─────────────────────────────────────────────────────

  private checkStatement(stmt: UnifiedStatementNode): void {
    switch (stmt.kind) {
      case 'VariableDeclaration':
        this.checkVariableDeclaration(stmt);
        break;

      case 'FunctionDeclaration':
        this.checkFunctionDeclaration(stmt);
        break;

      case 'ReturnStatement':
        this.checkReturnStatement(stmt);
        break;

      case 'IfStatement':
        this.checkIfStatement(stmt);
        break;

      case 'WhileStatement':
        this.checkWhileStatement(stmt);
        break;

      case 'ForStatement':
        this.checkForStatement(stmt);
        break;

      case 'BlockStatement':
        this.checkBlockStatement(stmt);
        break;

      case 'ExpressionStatement':
        this.inferExpressionType(stmt.expression);
        break;

      case 'PrintStatement':
        this.inferExpressionType(stmt.expression);
        break;

      case 'ImportStatement':
        if (stmt.specifiers && stmt.specifiers.length > 0) {
          for (const spec of stmt.specifiers) {
            this.currentEnv.bind(spec.alias || spec.name, TypeAny);
          }
        } else {
          this.currentEnv.bind(stmt.alias || stmt.moduleName, TypeAny);
        }
        break;

      case 'ModuleDeclaration':
        this.currentEnv.bind(stmt.name, TypeAny);
        break;

      case 'ExportStatement':
        if (stmt.declaration) {
          this.checkStatement(stmt.declaration);
        }
        break;

      case 'StructDeclaration': {
        const propMap = new Map<string, Type>();
        for (const f of stmt.fields) {
          propMap.set(f.name, parseTypeString(f.typeAnnotation, this.customTypes));
        }
        const structType = createStructType(stmt.name, propMap);
        this.customTypes.set(stmt.name, structType);
        this.currentEnv.bind(stmt.name, structType);
        stmt.inferredType = stmt.name;
        break;
      }

      case 'EnumDeclaration': {
        const varMap = new Map<string, number | string>();
        for (const v of stmt.variants) {
          varMap.set(v.name, v.value);
        }
        const enumType = createEnumType(stmt.name, varMap);
        this.customTypes.set(stmt.name, enumType);
        this.currentEnv.bind(stmt.name, enumType);
        stmt.inferredType = stmt.name;
        break;
      }

      case 'DeclarativeSpatialNode':
        // Spatial declarative nodes are governed by spatial invariants
        break;

      case 'BreakStatement':
        break;

      case 'InputStatement':
        this.currentEnv.bind(stmt.target, TypeString);
        break;
    }
  }

  private checkVariableDeclaration(node: VariableDeclarationNode): void {
    let declaredType: Type | undefined = undefined;
    if (node.typeAnnotation) {
      declaredType = parseTypeString(node.typeAnnotation, this.customTypes);
    }

    let initType: Type = TypeAny;
    if (node.initializer) {
      initType = this.inferExpressionType(node.initializer);
    }

    if (declaredType && node.initializer) {
      if (!isTypeAssignable(declaredType, initType)) {
        this.addDiagnostic(
          'E2001',
          `Type mismatch for variable '${node.identifier}'`,
          typeToString(declaredType),
          typeToString(initType),
          node.span?.start.line,
          node.span?.start.column
        );
      }
    }

    const effectiveType = declaredType || (node.initializer ? initType : TypeAny);
    node.inferredType = typeToString(effectiveType);
    this.currentEnv.bind(node.identifier, effectiveType);
  }

  private inferFunctionDeclarationType(node: FunctionDeclarationNode): Type {
    const paramTypes = node.params.map((p) => parseTypeString(p.typeAnnotation));
    const returnType = node.returnTypeAnnotation
      ? parseTypeString(node.returnTypeAnnotation)
      : TypeAny;

    const actualReturnType = node.isAsync ? createPromiseType(returnType) : returnType;
    const fnType = createFunctionType(paramTypes, actualReturnType);
    if (node.name) {
      this.currentEnv.bind(node.name, fnType);
    }
    node.inferredType = typeToString(fnType);

    // Enter Function Type Environment
    const fnEnv = new TypeEnv(this.currentEnv);
    this.currentEnv = fnEnv;
    const prevExpectedReturn = this.currentExpectedReturnType;
    this.currentExpectedReturnType = returnType;

    for (let i = 0; i < node.params.length; i++) {
      fnEnv.bind(node.params[i].name, paramTypes[i]);
    }

    // Pre-bind nested functions for mutual recursion
    for (const stmt of node.body.statements) {
      if (stmt.kind === 'FunctionDeclaration' && stmt.name) {
        const pTypes = stmt.params.map((p) => parseTypeString(p.typeAnnotation));
        const rType = stmt.returnTypeAnnotation
          ? parseTypeString(stmt.returnTypeAnnotation)
          : TypeAny;
        const actualRType = stmt.isAsync ? createPromiseType(rType) : rType;
        fnEnv.bind(stmt.name, createFunctionType(pTypes, actualRType));
      }
    }

    for (const stmt of node.body.statements) {
      this.checkStatement(stmt);
    }

    this.currentExpectedReturnType = prevExpectedReturn;
    this.currentEnv = this.currentEnv.parent!;

    return fnType;
  }

  private checkFunctionDeclaration(node: FunctionDeclarationNode): void {
    this.inferFunctionDeclarationType(node);
  }

  private checkReturnStatement(node: ReturnStatementNode): void {
    const valueType = node.value ? this.inferExpressionType(node.value) : TypeVoid;
    node.inferredType = typeToString(valueType);

    if (this.currentExpectedReturnType && this.currentExpectedReturnType.kind !== 'any') {
      if (!isTypeAssignable(this.currentExpectedReturnType, valueType)) {
        this.addDiagnostic(
          'E2004',
          'Return type mismatch',
          typeToString(this.currentExpectedReturnType),
          typeToString(valueType),
          node.span?.start.line,
          node.span?.start.column
        );
      }
    }
  }

  private checkIfStatement(node: IfStatementNode): void {
    const condType = this.inferExpressionType(node.condition);
    if (!isBooleanType(condType) && condType.kind !== 'any') {
      this.addDiagnostic(
        'E2005',
        `Condition in 'if' statement must be boolean, got '${typeToString(condType)}'`,
        'boolean',
        typeToString(condType),
        node.condition.span?.start.line,
        node.condition.span?.start.column
      );
    }

    this.checkBlockStatement(node.consequent);
    if (node.alternate) {
      if (node.alternate.kind === 'IfStatement') {
        this.checkIfStatement(node.alternate);
      } else {
        this.checkBlockStatement(node.alternate);
      }
    }
  }

  private checkWhileStatement(node: WhileStatementNode): void {
    const condType = this.inferExpressionType(node.condition);
    if (!isBooleanType(condType) && condType.kind !== 'any') {
      this.addDiagnostic(
        'E2005',
        `Condition in 'while' statement must be boolean, got '${typeToString(condType)}'`,
        'boolean',
        typeToString(condType),
        node.condition.span?.start.line,
        node.condition.span?.start.column
      );
    }

    this.checkBlockStatement(node.body);
  }

  private checkForStatement(node: ForStatementNode): void {
    const iterableType = this.inferExpressionType(node.iterable);
    const loopEnv = new TypeEnv(this.currentEnv);
    this.currentEnv = loopEnv;

    const itemType = iterableType.kind === 'array' && iterableType.elementType
      ? iterableType.elementType
      : TypeAny;

    loopEnv.bind(node.iterator, itemType);

    for (const stmt of node.body.statements) {
      this.checkStatement(stmt);
    }

    this.currentEnv = this.currentEnv.parent!;
  }

  private checkBlockStatement(node: BlockStatementNode): void {
    const blockEnv = new TypeEnv(this.currentEnv);
    this.currentEnv = blockEnv;

    for (const stmt of node.statements) {
      this.checkStatement(stmt);
    }

    this.currentEnv = this.currentEnv.parent!;
  }

  // ── Expression Type Inference ──────────────────────────────────────────────

  public inferExpressionType(expr: ExpressionNode): Type {
    let resultType: Type = TypeAny;

    switch (expr.kind) {
      case 'Literal':
        resultType = this.inferLiteralType(expr);
        break;

      case 'Identifier':
        resultType = this.inferIdentifierType(expr);
        break;

      case 'BinaryExpression':
        resultType = this.inferBinaryExpressionType(expr);
        break;

      case 'UnaryExpression':
        resultType = this.inferUnaryExpressionType(expr);
        break;

      case 'CallExpression':
        resultType = this.inferCallExpressionType(expr);
        break;

      case 'ArrayLiteral':
        resultType = this.inferArrayLiteralType(expr);
        break;

      case 'ObjectLiteral':
        resultType = this.inferObjectLiteralType(expr);
        break;

      case 'MemberExpression':
        resultType = this.inferMemberExpressionType(expr);
        break;

      case 'AwaitExpression':
        resultType = this.inferAwaitExpressionType(expr);
        break;

      case 'FunctionDeclaration':
        resultType = this.inferFunctionDeclarationType(expr);
        break;
    }

    expr.inferredType = typeToString(resultType);
    return resultType;
  }

  private inferLiteralType(node: LiteralNode): Type {
    switch (node.literalType) {
      case 'number': {
        if (node.raw && (node.raw.endsWith('f') || node.raw.endsWith('F'))) {
          return TypeF32;
        }
        return TypeNumber;
      }
      case 'string':
        return TypeString;
      case 'boolean':
        return TypeBool;
      case 'null':
        return TypeNull;
    }
  }

  private inferAwaitExpressionType(node: AwaitExpressionNode): Type {
    const argType = this.inferExpressionType(node.argument);
    if (argType.kind === 'promise' && argType.elementType) {
      return argType.elementType;
    }
    return argType;
  }

  private inferIdentifierType(node: IdentifierNode): Type {
    const bound = this.currentEnv.lookup(node.name);
    return bound || TypeAny;
  }

  private inferBinaryExpressionType(node: BinaryExpressionNode): Type {
    const leftType = this.inferExpressionType(node.left);
    const rightType = this.inferExpressionType(node.right);

    // Assignment operator '='
    if (node.operator === '=') {
      if (!isTypeAssignable(leftType, rightType)) {
        this.addDiagnostic(
          'E2001',
          `Cannot assign value of type '${typeToString(rightType)}' to target of type '${typeToString(leftType)}'`,
          typeToString(leftType),
          typeToString(rightType),
          node.span?.start.line,
          node.span?.start.column
        );
      }
      return rightType;
    }

    // Arithmetic operators: +, -, *, /, %
    if (['+', '-', '*', '/', '%'].includes(node.operator)) {
      if (node.operator === '+' && (leftType.kind === 'string' || rightType.kind === 'string')) {
        // In ONE Language, string concatenation is allowed only when both are string
        if (leftType.kind !== 'string' || rightType.kind !== 'string') {
          this.addDiagnostic(
            'E2002',
            `Incompatible operand types for '+': '${typeToString(leftType)}' and '${typeToString(rightType)}'. Explicit type conversion required.`,
            'string + string OR number + number',
            `${typeToString(leftType)} + ${typeToString(rightType)}`,
            node.span?.start.line,
            node.span?.start.column
          );
        }
        return TypeString;
      }

      if (!isNumericType(leftType) && leftType.kind !== 'any') {
        this.addDiagnostic(
          'E2002',
          `Left operand of '${node.operator}' must be a number, got '${typeToString(leftType)}'`,
          'number',
          typeToString(leftType),
          node.left.span?.start.line,
          node.left.span?.start.column
        );
      }
      if (!isNumericType(rightType) && rightType.kind !== 'any') {
        this.addDiagnostic(
          'E2002',
          `Right operand of '${node.operator}' must be a number, got '${typeToString(rightType)}'`,
          'number',
          typeToString(rightType),
          node.right.span?.start.line,
          node.right.span?.start.column
        );
      }

      // Precise numeric type propagation
      if (leftType.kind === 'i32' && rightType.kind === 'i32') {
        return TypeI32;
      }
      if (
        (leftType.kind === 'f32' && isNumericType(rightType)) ||
        (rightType.kind === 'f32' && isNumericType(leftType))
      ) {
        return TypeF32;
      }
      if (leftType.kind === 'i32' && rightType.kind === 'number') {
        return TypeI32;
      }
      if (rightType.kind === 'i32' && leftType.kind === 'number') {
        return TypeI32;
      }
      return TypeNumber;
    }

    // Comparison operators: <, <=, >, >=
    if (['<', '<=', '>', '>='].includes(node.operator)) {
      if (
        (!isNumericType(leftType) && leftType.kind !== 'any') ||
        (!isNumericType(rightType) && rightType.kind !== 'any')
      ) {
        this.addDiagnostic(
          'E2002',
          `Comparison operator '${node.operator}' requires number operands, got '${typeToString(leftType)}' and '${typeToString(rightType)}'`,
          'number',
          `${typeToString(leftType)}, ${typeToString(rightType)}`,
          node.span?.start.line,
          node.span?.start.column
        );
      }
      return TypeBool;
    }

    // Equality operators: ==, !=
    if (['==', '!='].includes(node.operator)) {
      return TypeBool;
    }

    // Logical operators: &&, ||
    if (['&&', '||'].includes(node.operator)) {
      if (
        (!isBooleanType(leftType) && leftType.kind !== 'any') ||
        (!isBooleanType(rightType) && rightType.kind !== 'any')
      ) {
        this.addDiagnostic(
          'E2002',
          `Logical operator '${node.operator}' requires boolean operands, got '${typeToString(leftType)}' and '${typeToString(rightType)}'`,
          'boolean',
          `${typeToString(leftType)}, ${typeToString(rightType)}`,
          node.span?.start.line,
          node.span?.start.column
        );
      }
      return TypeBool;
    }

    return TypeAny;
  }

  private inferUnaryExpressionType(node: UnaryExpressionNode): Type {
    const operandType = this.inferExpressionType(node.operand);

    if (node.operator === '!') {
      if (!isBooleanType(operandType) && operandType.kind !== 'any') {
        this.addDiagnostic(
          'E2002',
          `Logical NOT operator '!' requires boolean operand, got '${typeToString(operandType)}'`,
          'boolean',
          typeToString(operandType),
          node.span?.start.line,
          node.span?.start.column
        );
      }
      return TypeBool;
    }

    if (node.operator === '-' || node.operator === '+') {
      if (!isNumericType(operandType) && operandType.kind !== 'any') {
        this.addDiagnostic(
          'E2002',
          `Unary operator '${node.operator}' requires number operand, got '${typeToString(operandType)}'`,
          'number',
          typeToString(operandType),
          node.span?.start.line,
          node.span?.start.column
        );
      }
      if (operandType.kind === 'i32') return TypeI32;
      if (operandType.kind === 'f32') return TypeF32;
      return TypeNumber;
    }

    return TypeAny;
  }

  private inferCallExpressionType(node: CallExpressionNode): Type {
    if (node.callee.kind === 'Identifier') {
      const fnName = (node.callee as IdentifierNode).name;
      if (this.customTypes.has(fnName)) {
        const customType = this.customTypes.get(fnName)!;
        if (customType.kind === 'struct' && customType.properties) {
          const propEntries = Array.from(customType.properties.entries());
          for (let i = 0; i < node.args.length; i++) {
            const argType = this.inferExpressionType(node.args[i]);
            if (i < propEntries.length) {
              const [propName, expectedType] = propEntries[i];
              if (!isTypeAssignable(expectedType, argType)) {
                this.addDiagnostic(
                  'E3001',
                  `Type mismatch for field '${propName}' of struct '${fnName}'`,
                  typeToString(expectedType),
                  typeToString(argType),
                  node.args[i].span?.start.line,
                  node.args[i].span?.start.column
                );
              }
            }
          }
          return customType;
        }
      }

      if (fnName === 'i32') {
        for (const arg of node.args) this.inferExpressionType(arg);
        return TypeI32;
      }
      if (fnName === 'f32') {
        for (const arg of node.args) this.inferExpressionType(arg);
        return TypeF32;
      }
      if (fnName === 'bool' || fnName === 'is_i32' || fnName === 'is_f32' || fnName === 'is_bool') {
        for (const arg of node.args) this.inferExpressionType(arg);
        return TypeBool;
      }
    }

    const calleeType = this.inferExpressionType(node.callee);

    if (calleeType.kind === 'function' && calleeType.paramTypes && calleeType.returnType) {
      for (let i = 0; i < node.args.length; i++) {
        const argType = this.inferExpressionType(node.args[i]);
        const expectedParamType = calleeType.paramTypes[i];
        if (expectedParamType && !isTypeAssignable(expectedParamType, argType)) {
          this.addDiagnostic(
            'E2003',
            `Argument ${i + 1} type mismatch in function call`,
            typeToString(expectedParamType),
            typeToString(argType),
            node.args[i].span?.start.line,
            node.args[i].span?.start.column
          );
        }
      }
      return calleeType.returnType;
    }

    for (const arg of node.args) {
      this.inferExpressionType(arg);
    }

    return TypeAny;
  }

  private inferArrayLiteralType(node: ArrayLiteralNode): Type {
    if (node.elements.length === 0) {
      return createArrayType(TypeAny);
    }
    const firstType = this.inferExpressionType(node.elements[0]);
    for (let i = 1; i < node.elements.length; i++) {
      this.inferExpressionType(node.elements[i]);
    }
    return createArrayType(firstType);
  }

  private inferObjectLiteralType(node: ObjectLiteralNode): Type {
    const propMap = new Map<string, Type>();
    for (const prop of node.properties) {
      propMap.set(prop.key, this.inferExpressionType(prop.value));
    }
    if (node.structName && this.customTypes.has(node.structName)) {
      const structType = this.customTypes.get(node.structName)!;
      if (structType.properties) {
        for (const [key, valType] of propMap.entries()) {
          const expected = structType.properties.get(key);
          if (expected && !isTypeAssignable(expected, valType)) {
            this.addDiagnostic(
              'E3001',
              `Type mismatch for field '${key}' of struct '${node.structName}'`,
              typeToString(expected),
              typeToString(valType),
              node.span?.start.line,
              node.span?.start.column
            );
          }
        }
      }
      return structType;
    }
    return { kind: 'object', properties: propMap, name: 'object' };
  }

  private inferMemberExpressionType(node: MemberExpressionNode): Type {
    if (!node.computed && typeof node.property === 'string') {
      if (node.object.kind === 'Identifier' && this.customTypes.has(node.object.name)) {
        const customType = this.customTypes.get(node.object.name)!;
        if (customType.kind === 'enum') {
          return customType;
        }
      }
    }

    const objType = this.inferExpressionType(node.object);
    if (node.computed) {
      if (typeof node.property !== 'string') {
        this.inferExpressionType(node.property);
      }
      if (objType.kind === 'array' && objType.elementType) {
        return objType.elementType;
      }
    } else if (typeof node.property === 'string' && objType.properties) {
      return objType.properties.get(node.property) || TypeAny;
    }
    return TypeAny;
  }

  private addDiagnostic(
    code: string,
    message: string,
    expected?: string,
    received?: string,
    line?: number,
    column?: number
  ): void {
    this.diagnostics.push({
      code,
      message,
      expected,
      received,
      line,
      column,
    });
  }
}
