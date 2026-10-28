import { Token, TokenType } from '../oneLexer';
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
  ImportSpecifier,
  ExportStatementNode,
  ExportSpecifier,
  ModuleDeclarationNode,
  StructDeclarationNode,
  StructFieldDeclaration,
  EnumDeclarationNode,
  EnumVariantDeclaration,
  LiteralNode,
  IdentifierNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  CallExpressionNode,
  ArrayLiteralNode,
  ObjectLiteralNode,
  MemberExpressionNode,
  ParameterDeclaration,
} from '../ast/UnifiedAST';
import { createSourceSpan, SourceSpan } from '../ast/SourceLocation';

enum Precedence {
  LOWEST = 0,
  ASSIGNMENT = 1,  // =
  LOGICAL_OR = 2,  // ||
  LOGICAL_AND = 3, // &&
  EQUALITY = 4,    // ==, !=
  COMPARISON = 5,  // <, <=, >, >=
  SUM = 6,         // +, -
  PRODUCT = 7,     // *, /, %
  PREFIX = 8,      // !, -, +
  CALL = 9,        // (
  MEMBER = 10,     // ., [
}

export class ComputationalParser {
  private tokens: Token[];
  private current: number = 0;
  private errors: string[] = [];
  private anonFnCounter: number = 0;
  private loopDepth: number = 0;
  private repeatCounter: number = 1;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): UnifiedProgramNode {
    const body: UnifiedStatementNode[] = [];

    while (!this.isAtEnd()) {
      // Skip empty semicolons
      if (this.match(TokenType.SEMICOLON)) {
        continue;
      }

      try {
        const stmt = this.parseStatement();
        if (stmt) {
          body.push(stmt);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          this.errors.push(err.message);
        }
        this.synchronize();
      }
    }

    if (this.errors.length > 0 && body.length === 0) {
      throw new Error(`[Parser Error] Compilation halted with ${this.errors.length} error(s):\n${this.errors.join('\n')}`);
    }

    return {
      kind: 'Program',
      body,
    };
  }

  public getErrors(): string[] {
    return this.errors;
  }

  // ── Statement Parsing ───────────────────────────────────────────────────────

  private parseStatement(): UnifiedStatementNode {
    const token = this.peek();

    if (token.type === TokenType.KEYWORD_ONES) {
      return this.parseOnesDeclaration();
    }

    if (token.type === TokenType.KEYWORD_ONE) {
      return this.parseOneCommand();
    }

    if (token.type === TokenType.KEYWORD_LET || token.type === TokenType.KEYWORD_CONST) {
      return this.parseVariableDeclaration();
    }

    if (token.type === TokenType.KEYWORD_FUNCTION || token.type === TokenType.KEYWORD_FN) {
      return this.parseFunctionDeclaration();
    }

    if (token.type === TokenType.KEYWORD_ASYNC) {
      this.advance(); // consume 'async'
      const next = this.peek();
      if (next.type === TokenType.KEYWORD_FUNCTION || next.type === TokenType.KEYWORD_FN) {
        return this.parseFunctionNode(true, true /* isAsync */);
      }
      throw new Error(`[E1015: Syntax Error] 'async' modifier can only be followed by a function declaration at line ${token.line}, column ${token.column}`);
    }

    if (token.type === TokenType.KEYWORD_RETURN) {
      return this.parseReturnStatement();
    }

    if (token.type === TokenType.KEYWORD_IF) {
      return this.parseIfStatement();
    }

    if (token.type === TokenType.KEYWORD_WHILE) {
      return this.parseWhileStatement();
    }

    if (token.type === TokenType.KEYWORD_FOR) {
      return this.parseForStatement();
    }

    if (token.type === TokenType.KEYWORD_PRINT) {
      return this.parsePrintStatement();
    }

    if (token.type === TokenType.KEYWORD_MODULE) {
      return this.parseModuleDeclaration();
    }

    if (token.type === TokenType.KEYWORD_EXPORT) {
      return this.parseExportStatement();
    }

    if (token.type === TokenType.KEYWORD_IMPORT) {
      return this.parseImportStatement();
    }

    if (token.type === TokenType.KEYWORD_STRUCT) {
      return this.parseStructDeclaration();
    }

    if (token.type === TokenType.KEYWORD_ENUM) {
      return this.parseEnumDeclaration();
    }

    if (token.type === TokenType.LBRACE) {
      return this.parseBlockStatement();
    }

    return this.parseExpressionStatement();
  }

  private parseVariableDeclaration(): VariableDeclarationNode {
    const startToken = this.advance(); // consume 'let' or 'const'
    const isConst = startToken.type === TokenType.KEYWORD_CONST;

    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1001: Syntax Error] Expected variable identifier after '${startToken.value}' at line ${startToken.line}, column ${startToken.column}`);
    }

    const idToken = this.advance();
    let typeAnnotation: string | undefined = undefined;

    if (this.match(TokenType.COLON)) {
      typeAnnotation = this.parseTypeAnnotation();
    }

    let initializer: ExpressionNode | undefined = undefined;
    if (this.match(TokenType.ASSIGN)) {
      initializer = this.parseExpression(Precedence.LOWEST);
    } else if (isConst) {
      throw new Error(`[E1002: Syntax Error] Const variable '${idToken.value}' must be initialized at line ${idToken.line}, column ${idToken.column}`);
    }

    // Consume optional semicolon
    this.match(TokenType.SEMICOLON);

    const endLine = initializer?.span?.end.line || idToken.line;
    const endCol = initializer?.span?.end.column || idToken.column + idToken.value.length;

    return {
      kind: 'VariableDeclaration',
      identifier: idToken.value,
      isConst,
      typeAnnotation,
      initializer,
      span: createSourceSpan(startToken.line, startToken.column, endLine, endCol),
    };
  }

  private parseOnesDeclaration(): VariableDeclarationNode {
    const startToken = this.advance(); // consume "one's"
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1001: Syntax Error] Expected variable identifier after 'one\\'s' at line ${startToken.line}, column ${startToken.column}`);
    }

    const idToken = this.advance();
    let typeAnnotation: string | undefined = undefined;
    if (this.match(TokenType.COLON)) {
      typeAnnotation = this.parseTypeAnnotation();
    }

    this.consume(TokenType.ASSIGN, "Expected '=' in 'one\\'s' declaration");
    const initializer = this.parseExpression(Precedence.LOWEST);
    this.match(TokenType.SEMICOLON);

    const endLine = initializer?.span?.end.line || idToken.line;
    const endCol = initializer?.span?.end.column || idToken.column + idToken.value.length;

    return {
      kind: 'VariableDeclaration',
      identifier: idToken.value,
      isConst: false,
      typeAnnotation,
      initializer,
      span: createSourceSpan(startToken.line, startToken.column, endLine, endCol),
    };
  }

  private parseOneCommand(): UnifiedStatementNode {
    const oneToken = this.advance(); // consume 'one'
    const next = this.peek();

    switch (next.type) {
      case TokenType.KEYWORD_SET:
        return this.parseOneSetStatement(oneToken);
      case TokenType.KEYWORD_OUT:
        return this.parseOneOutStatement(oneToken);
      case TokenType.KEYWORD_IN:
        return this.parseOneInStatement(oneToken);
      case TokenType.KEYWORD_UP:
        return this.parseOneUpDownStatement(oneToken, '+');
      case TokenType.KEYWORD_DOWN:
        return this.parseOneUpDownStatement(oneToken, '-');
      case TokenType.KEYWORD_IF:
        return this.parseOneIfStatement(oneToken);
      case TokenType.KEYWORD_REPEAT:
        return this.parseOneRepeatStatement(oneToken);
      case TokenType.KEYWORD_STOP:
        return this.parseOneStopStatement(oneToken);
      case TokenType.KEYWORD_MAKE:
        return this.parseOneMakeStatement(oneToken);
      case TokenType.KEYWORD_WAY:
        return this.parseOneWayStatement(oneToken);
      case TokenType.KEYWORD_DONE:
        return this.parseOneDoneStatement(oneToken);
      default:
        if (next.type === TokenType.DOT || next.value === 'dot') {
          this.advance();
          throw new Error(`[E1017: Syntax Error] 'one dot' is deferred in v1.0.1 pending explicit spatial point specification at line ${next.line}, column ${next.column}`);
        }
        throw new Error(`[E1014: Syntax Error] Unknown one command '${next.value}' at line ${next.line}, column ${next.column}`);
    }
  }

  private parseOneSetStatement(oneToken: Token): ExpressionStatementNode {
    const setToken = this.advance(); // consume 'set'
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1001: Syntax Error] Expected variable identifier after 'one set' at line ${setToken.line}, column ${setToken.column}`);
    }
    const idToken = this.advance();
    this.consume(TokenType.ASSIGN, "Expected '=' in 'one set' statement");
    const valExpr = this.parseExpression(Precedence.LOWEST);
    this.match(TokenType.SEMICOLON);

    const endLine = valExpr.span?.end.line || idToken.line;
    const endCol = valExpr.span?.end.column || idToken.column + idToken.value.length;

    const assignExpr: BinaryExpressionNode = {
      kind: 'BinaryExpression',
      operator: '=',
      left: {
        kind: 'Identifier',
        name: idToken.value,
        span: createSourceSpan(idToken.line, idToken.column, idToken.line, idToken.column + idToken.value.length),
      },
      right: valExpr,
      span: createSourceSpan(idToken.line, idToken.column, endLine, endCol),
    };

    return {
      kind: 'ExpressionStatement',
      expression: assignExpr,
      span: createSourceSpan(oneToken.line, oneToken.column, endLine, endCol),
    };
  }

  private parseOneOutStatement(oneToken: Token): PrintStatementNode {
    const outToken = this.advance(); // consume 'out'
    const expr = this.parseExpression(Precedence.LOWEST);
    this.match(TokenType.SEMICOLON);

    return {
      kind: 'PrintStatement',
      expression: expr,
      span: createSourceSpan(
        oneToken.line,
        oneToken.column,
        expr.span?.end.line || outToken.line,
        expr.span?.end.column || outToken.column + outToken.value.length
      ),
    };
  }

  private parseOneInStatement(oneToken: Token): InputStatementNode {
    const inToken = this.advance(); // consume 'in'
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1001: Syntax Error] Expected variable identifier after 'one in' at line ${inToken.line}, column ${inToken.column}`);
    }
    const idToken = this.advance();
    this.match(TokenType.SEMICOLON);

    return {
      kind: 'InputStatement',
      target: idToken.value,
      span: createSourceSpan(
        oneToken.line,
        oneToken.column,
        idToken.line,
        idToken.column + idToken.value.length
      ),
    };
  }

  private parseOneUpDownStatement(oneToken: Token, op: '+' | '-'): ExpressionStatementNode {
    const opToken = this.advance(); // consume 'up' or 'down'
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1001: Syntax Error] Expected variable identifier after 'one ${opToken.value}' at line ${opToken.line}, column ${opToken.column}`);
    }
    const idToken = this.advance();
    let stepExpr: ExpressionNode = {
      kind: 'Literal',
      literalType: 'number',
      value: 1,
      raw: '1',
      span: createSourceSpan(idToken.line, idToken.column + idToken.value.length, idToken.line, idToken.column + idToken.value.length),
    };

    if (this.check(TokenType.KEYWORD_BY) || this.peek().value === 'by') {
      this.advance(); // consume 'by'
      stepExpr = this.parseExpression(Precedence.LOWEST);
    }

    this.match(TokenType.SEMICOLON);

    const endLine = stepExpr.span?.end.line || idToken.line;
    const endCol = stepExpr.span?.end.column || idToken.column + idToken.value.length;

    const idNode: IdentifierNode = {
      kind: 'Identifier',
      name: idToken.value,
      span: createSourceSpan(idToken.line, idToken.column, idToken.line, idToken.column + idToken.value.length),
    };

    const binOp: BinaryExpressionNode = {
      kind: 'BinaryExpression',
      operator: op,
      left: idNode,
      right: stepExpr,
      span: createSourceSpan(idToken.line, idToken.column, endLine, endCol),
    };

    const assignExpr: BinaryExpressionNode = {
      kind: 'BinaryExpression',
      operator: '=',
      left: idNode,
      right: binOp,
      span: createSourceSpan(idToken.line, idToken.column, endLine, endCol),
    };

    return {
      kind: 'ExpressionStatement',
      expression: assignExpr,
      span: createSourceSpan(oneToken.line, oneToken.column, endLine, endCol),
    };
  }

  private parseOneIfStatement(oneToken: Token): IfStatementNode {
    this.advance(); // consume 'if'
    const condition = this.parseExpression(Precedence.LOWEST);

    this.consume(TokenType.LBRACE, "Expected '{' after if condition");
    const consequent = this.parseBlockStatementBody();

    let alternate: BlockStatementNode | IfStatementNode | undefined = undefined;

    // Check for 'one else' or 'else'
    if (this.check(TokenType.KEYWORD_ONE) && (this.peekNext()?.type === TokenType.KEYWORD_ELSE || this.peekNext()?.value === 'else')) {
      this.advance(); // consume 'one'
      this.advance(); // consume 'else'
      if (this.check(TokenType.KEYWORD_ONE) && (this.peekNext()?.type === TokenType.KEYWORD_IF || this.peekNext()?.value === 'if')) {
        this.advance(); // consume 'one'
        alternate = this.parseOneIfStatement(this.previous());
      } else if (this.check(TokenType.KEYWORD_IF)) {
        alternate = this.parseIfStatement();
      } else {
        this.consume(TokenType.LBRACE, "Expected '{' after else");
        alternate = this.parseBlockStatementBody();
      }
    } else if (this.match(TokenType.KEYWORD_ELSE)) {
      if (this.check(TokenType.KEYWORD_ONE) && (this.peekNext()?.type === TokenType.KEYWORD_IF || this.peekNext()?.value === 'if')) {
        this.advance(); // consume 'one'
        alternate = this.parseOneIfStatement(this.previous());
      } else if (this.check(TokenType.KEYWORD_IF)) {
        alternate = this.parseIfStatement();
      } else {
        this.consume(TokenType.LBRACE, "Expected '{' after else");
        alternate = this.parseBlockStatementBody();
      }
    }

    return {
      kind: 'IfStatement',
      condition,
      consequent,
      alternate,
      span: createSourceSpan(
        oneToken.line,
        oneToken.column,
        alternate?.span?.end.line || consequent.span?.end.line || oneToken.line,
        alternate?.span?.end.column || consequent.span?.end.column || oneToken.column
      ),
    };
  }

  private parseOneRepeatStatement(oneToken: Token): UnifiedStatementNode {
    this.advance(); // consume 'repeat'

    if (this.match(TokenType.KEYWORD_WHILE) || (this.peek().value === 'while' && this.advance())) {
      const condition = this.parseExpression(Precedence.LOWEST);
      this.consume(TokenType.LBRACE, "Expected '{' after while condition");
      this.loopDepth++;
      const body = this.parseBlockStatementBody();
      this.loopDepth--;

      return {
        kind: 'WhileStatement',
        condition,
        body,
        span: createSourceSpan(
          oneToken.line,
          oneToken.column,
          body.span?.end.line || oneToken.line,
          body.span?.end.column || oneToken.column
        ),
      };
    }

    // one repeat count { ... }
    const countExpr = this.parseExpression(Precedence.LOWEST);
    this.consume(TokenType.LBRACE, "Expected '{' after repeat count");
    this.loopDepth++;
    const body = this.parseBlockStatementBody();
    this.loopDepth--;

    const cntIdx = this.repeatCounter++;
    const counterName = `__repeat_cnt_${cntIdx}`;
    const limitName = `__repeat_limit_${cntIdx}`;

    const limitDecl: VariableDeclarationNode = {
      kind: 'VariableDeclaration',
      identifier: limitName,
      isConst: true,
      initializer: countExpr,
      span: countExpr.span,
    };

    const cntDecl: VariableDeclarationNode = {
      kind: 'VariableDeclaration',
      identifier: counterName,
      isConst: false,
      initializer: {
        kind: 'Literal',
        literalType: 'number',
        value: 0,
        raw: '0',
        span: countExpr.span,
      },
      span: countExpr.span,
    };

    const incStmt: ExpressionStatementNode = {
      kind: 'ExpressionStatement',
      expression: {
        kind: 'BinaryExpression',
        operator: '=',
        left: { kind: 'Identifier', name: counterName, span: countExpr.span },
        right: {
          kind: 'BinaryExpression',
          operator: '+',
          left: { kind: 'Identifier', name: counterName, span: countExpr.span },
          right: { kind: 'Literal', literalType: 'number', value: 1, raw: '1', span: countExpr.span },
          span: countExpr.span,
        },
        span: countExpr.span,
      },
      span: countExpr.span,
    };

    body.statements.push(incStmt);

    const whileStmt: WhileStatementNode = {
      kind: 'WhileStatement',
      condition: {
        kind: 'BinaryExpression',
        operator: '<',
        left: { kind: 'Identifier', name: counterName, span: countExpr.span },
        right: { kind: 'Identifier', name: limitName, span: countExpr.span },
        span: countExpr.span,
      },
      body,
      span: createSourceSpan(
        oneToken.line,
        oneToken.column,
        body.span?.end.line || oneToken.line,
        body.span?.end.column || oneToken.column
      ),
    };

    return {
      kind: 'BlockStatement',
      statements: [limitDecl, cntDecl, whileStmt],
      span: createSourceSpan(
        oneToken.line,
        oneToken.column,
        body.span?.end.line || oneToken.line,
        body.span?.end.column || oneToken.column
      ),
    };
  }

  private parseOneStopStatement(oneToken: Token): BreakStatementNode {
    const stopToken = this.advance(); // consume 'stop'
    if (this.loopDepth <= 0) {
      throw new Error(`[E1016: Syntax Error] 'one stop' can only be used inside a loop at line ${stopToken.line}, column ${stopToken.column}`);
    }
    this.match(TokenType.SEMICOLON);
    return {
      kind: 'BreakStatement',
      span: createSourceSpan(oneToken.line, oneToken.column, stopToken.line, stopToken.column + stopToken.value.length),
    };
  }

  private parseOneMakeStatement(oneToken: Token): FunctionDeclarationNode {
    this.advance(); // consume 'make'
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1003: Syntax Error] Expected function name after 'one make' at line ${oneToken.line}, column ${oneToken.column}`);
    }
    const nameToken = this.advance();
    return this.finishFunctionNode(oneToken, nameToken.value, false);
  }

  private parseOneWayStatement(oneToken: Token): ReturnStatementNode {
    const wayToken = this.advance(); // consume 'way'
    let value: ExpressionNode | undefined = undefined;
    if (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      value = this.parseExpression(Precedence.LOWEST);
    }
    this.match(TokenType.SEMICOLON);

    return {
      kind: 'ReturnStatement',
      value,
      span: createSourceSpan(
        oneToken.line,
        oneToken.column,
        value?.span?.end.line || wayToken.line,
        value?.span?.end.column || wayToken.column + wayToken.value.length
      ),
    };
  }

  private parseOneDoneStatement(oneToken: Token): ReturnStatementNode {
    const doneToken = this.advance(); // consume 'done'
    this.match(TokenType.SEMICOLON);

    return {
      kind: 'ReturnStatement',
      value: undefined,
      span: createSourceSpan(
        oneToken.line,
        oneToken.column,
        doneToken.line,
        doneToken.column + doneToken.value.length
      ),
    };
  }

  private parseFunctionNode(requireName: boolean, isAsync: boolean = false): FunctionDeclarationNode {
    const startToken = this.advance(); // consume 'function' or 'fn'

    let name = '';
    if (this.check(TokenType.IDENTIFIER)) {
      name = this.advance().value;
    } else if (requireName) {
      throw new Error(`[E1003: Syntax Error] Expected function name after '${startToken.value}' at line ${startToken.line}, column ${startToken.column}`);
    } else {
      name = `__anon_fn_${this.anonFnCounter++}`;
    }

    return this.finishFunctionNode(startToken, name, isAsync);
  }

  private finishFunctionNode(startToken: Token, name: string, isAsync: boolean = false): FunctionDeclarationNode {
    this.consume(TokenType.LPAREN, "Expected '(' after function name");

    const params: ParameterDeclaration[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        if (!this.check(TokenType.IDENTIFIER)) {
          throw new Error(`[E1004: Syntax Error] Expected parameter name at line ${this.peek().line}, column ${this.peek().column}`);
        }
        const paramToken = this.advance();
        let paramType: string | undefined = undefined;
        if (this.match(TokenType.COLON)) {
          paramType = this.parseTypeAnnotation();
        }
        params.push({
          name: paramToken.value,
          typeAnnotation: paramType,
          span: createSourceSpan(paramToken.line, paramToken.column, paramToken.line, paramToken.column + paramToken.value.length),
        });
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.RPAREN, "Expected ')' after parameter list");

    let returnTypeAnnotation: string | undefined = undefined;
    if (this.match(TokenType.COLON) || this.match(TokenType.OP_ALIGN)) { // ':' or '=>'
      returnTypeAnnotation = this.parseTypeAnnotation();
    }

    this.consume(TokenType.LBRACE, "Expected '{' before function body");
    const body = this.parseBlockStatementBody();

    return {
      kind: 'FunctionDeclaration',
      name,
      isAsync,
      params,
      returnTypeAnnotation,
      body,
      span: createSourceSpan(startToken.line, startToken.column, body.span?.end.line || startToken.line, body.span?.end.column || startToken.column),
    };
  }

  private parseFunctionDeclaration(): FunctionDeclarationNode {
    return this.parseFunctionNode(true, false);
  }

  private parseReturnStatement(): ReturnStatementNode {
    const startToken = this.advance(); // consume 'return'
    let value: ExpressionNode | undefined = undefined;

    if (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      value = this.parseExpression(Precedence.LOWEST);
    }

    this.match(TokenType.SEMICOLON);

    return {
      kind: 'ReturnStatement',
      value,
      span: createSourceSpan(
        startToken.line,
        startToken.column,
        value?.span?.end.line || startToken.line,
        value?.span?.end.column || startToken.column + 6
      ),
    };
  }

  private parseIfStatement(): IfStatementNode {
    const startToken = this.advance(); // consume 'if'
    const condition = this.parseExpression(Precedence.LOWEST);

    this.consume(TokenType.LBRACE, "Expected '{' after if condition");
    const consequent = this.parseBlockStatementBody();

    let alternate: BlockStatementNode | IfStatementNode | undefined = undefined;
    if (this.check(TokenType.KEYWORD_ONE) && (this.peekNext()?.type === TokenType.KEYWORD_ELSE || this.peekNext()?.value === 'else')) {
      this.advance(); // consume 'one'
      this.advance(); // consume 'else'
      if (this.check(TokenType.KEYWORD_ONE) && (this.peekNext()?.type === TokenType.KEYWORD_IF || this.peekNext()?.value === 'if')) {
        this.advance(); // consume 'one'
        alternate = this.parseOneIfStatement(this.previous());
      } else if (this.check(TokenType.KEYWORD_IF)) {
        alternate = this.parseIfStatement();
      } else {
        this.consume(TokenType.LBRACE, "Expected '{' after else");
        alternate = this.parseBlockStatementBody();
      }
    } else if (this.match(TokenType.KEYWORD_ELSE)) {
      if (this.check(TokenType.KEYWORD_ONE) && (this.peekNext()?.type === TokenType.KEYWORD_IF || this.peekNext()?.value === 'if')) {
        this.advance(); // consume 'one'
        alternate = this.parseOneIfStatement(this.previous());
      } else if (this.check(TokenType.KEYWORD_IF)) {
        alternate = this.parseIfStatement();
      } else {
        this.consume(TokenType.LBRACE, "Expected '{' after else");
        alternate = this.parseBlockStatementBody();
      }
    }

    return {
      kind: 'IfStatement',
      condition,
      consequent,
      alternate,
      span: createSourceSpan(
        startToken.line,
        startToken.column,
        alternate?.span?.end.line || consequent.span?.end.line || startToken.line,
        alternate?.span?.end.column || consequent.span?.end.column || startToken.column
      ),
    };
  }

  private parseWhileStatement(): WhileStatementNode {
    const startToken = this.advance(); // consume 'while'
    const condition = this.parseExpression(Precedence.LOWEST);

    this.consume(TokenType.LBRACE, "Expected '{' after while condition");
    this.loopDepth++;
    const body = this.parseBlockStatementBody();
    this.loopDepth--;

    return {
      kind: 'WhileStatement',
      condition,
      body,
      span: createSourceSpan(
        startToken.line,
        startToken.column,
        body.span?.end.line || startToken.line,
        body.span?.end.column || startToken.column
      ),
    };
  }

  private parseForStatement(): ForStatementNode {
    const startToken = this.advance(); // consume 'for'

    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1005: Syntax Error] Expected iterator variable after 'for' at line ${startToken.line}, column ${startToken.column}`);
    }
    const iterToken = this.advance();

    // Consume 'in' (either keyword or identifier 'in')
    if (this.peek().value !== 'in') {
      throw new Error(`[E1006: Syntax Error] Expected 'in' after iterator variable at line ${this.peek().line}, column ${this.peek().column}`);
    }
    this.advance();

    const iterable = this.parseExpression(Precedence.LOWEST);
    this.consume(TokenType.LBRACE, "Expected '{' after for expression");
    this.loopDepth++;
    const body = this.parseBlockStatementBody();
    this.loopDepth--;

    return {
      kind: 'ForStatement',
      iterator: iterToken.value,
      iterable,
      body,
      span: createSourceSpan(
        startToken.line,
        startToken.column,
        body.span?.end.line || startToken.line,
        body.span?.end.column || startToken.column
      ),
    };
  }

  private parsePrintStatement(): PrintStatementNode {
    const startToken = this.advance(); // consume 'print'
    const expression = this.parseExpression(Precedence.LOWEST);
    this.match(TokenType.SEMICOLON);

    return {
      kind: 'PrintStatement',
      expression,
      span: createSourceSpan(
        startToken.line,
        startToken.column,
        expression.span?.end.line || startToken.line,
        expression.span?.end.column || startToken.column + 5
      ),
    };
  }

  private parseModuleDeclaration(): ModuleDeclarationNode {
    const startToken = this.advance(); // consume 'module'
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1007: Syntax Error] Expected module identifier after 'module' at line ${startToken.line}, column ${startToken.column}`);
    }
    let modName = this.advance().value;
    while (this.match(TokenType.DOT)) {
      if (!this.check(TokenType.IDENTIFIER)) {
        throw new Error(`[E1007: Syntax Error] Expected identifier after '.' in module name at line ${this.peek().line}, column ${this.peek().column}`);
      }
      modName += '.' + this.advance().value;
    }
    const endToken = this.match(TokenType.SEMICOLON) ? this.previous() : this.previous();
    return {
      kind: 'ModuleDeclaration',
      name: modName,
      span: createSourceSpan(startToken.line, startToken.column, endToken.line, endToken.column + endToken.value.length),
    };
  }

  private parseExportStatement(): ExportStatementNode {
    const startToken = this.advance(); // consume 'export'

    // Case 1: export { a, b as c };
    if (this.match(TokenType.LBRACE)) {
      const specifiers: ExportSpecifier[] = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        if (!this.check(TokenType.IDENTIFIER)) {
          throw new Error(`[E1007: Syntax Error] Expected identifier in export list at line ${this.peek().line}, column ${this.peek().column}`);
        }
        const idToken = this.advance();
        let alias: string | undefined = undefined;
        if (this.peek().value === 'as') {
          this.advance(); // consume 'as'
          if (!this.check(TokenType.IDENTIFIER)) {
            throw new Error(`[E1007: Syntax Error] Expected alias after 'as' in export list at line ${this.peek().line}, column ${this.peek().column}`);
          }
          alias = this.advance().value;
        }
        specifiers.push({
          name: idToken.value,
          alias,
          span: createSourceSpan(idToken.line, idToken.column, this.previous().line, this.previous().column + this.previous().value.length),
        });
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }
      const endToken = this.consume(TokenType.RBRACE, "Expected '}' after export specifiers");
      this.match(TokenType.SEMICOLON);
      return {
        kind: 'ExportStatement',
        specifiers,
        span: createSourceSpan(startToken.line, startToken.column, endToken.line, endToken.column + 1),
      };
    }

    // Case 2: export <declaration>
    let decl: UnifiedStatementNode;
    if (this.check(TokenType.KEYWORD_FN) || this.check(TokenType.KEYWORD_FUNCTION) || this.check(TokenType.KEYWORD_ASYNC)) {
      decl = this.parseFunctionDeclaration();
      (decl as any).isExported = true;
    } else if (this.check(TokenType.KEYWORD_STRUCT)) {
      decl = this.parseStructDeclaration();
      (decl as any).isExported = true;
    } else if (this.check(TokenType.KEYWORD_ENUM)) {
      decl = this.parseEnumDeclaration();
      (decl as any).isExported = true;
    } else if (this.check(TokenType.KEYWORD_LET) || this.check(TokenType.KEYWORD_CONST)) {
      decl = this.parseVariableDeclaration();
      (decl as any).isExported = true;
    } else {
      throw new Error(`[E1007: Syntax Error] Expected declaration after 'export' at line ${this.peek().line}, column ${this.peek().column}`);
    }

    return {
      kind: 'ExportStatement',
      declaration: decl,
      span: createSourceSpan(startToken.line, startToken.column, decl.span?.end.line || startToken.line, decl.span?.end.column || startToken.column + 6),
    };
  }

  private parseImportStatement(): ImportStatementNode {
    const startToken = this.advance(); // consume 'import'

    // Case 1: Named import: import { a, b as c } from "./math";
    if (this.match(TokenType.LBRACE)) {
      const specifiers: ImportSpecifier[] = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        if (!this.check(TokenType.IDENTIFIER)) {
          throw new Error(`[E1007: Syntax Error] Expected identifier in import list at line ${this.peek().line}, column ${this.peek().column}`);
        }
        const idToken = this.advance();
        let alias: string | undefined = undefined;
        if (this.peek().value === 'as') {
          this.advance(); // consume 'as'
          if (!this.check(TokenType.IDENTIFIER)) {
            throw new Error(`[E1008: Syntax Error] Expected alias after 'as' in import list at line ${this.peek().line}, column ${this.peek().column}`);
          }
          alias = this.advance().value;
        }
        specifiers.push({
          name: idToken.value,
          alias,
          span: createSourceSpan(idToken.line, idToken.column, this.previous().line, this.previous().column + this.previous().value.length),
        });
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }
      this.consume(TokenType.RBRACE, "Expected '}' after import specifiers");

      if (this.peek().value !== 'from') {
        throw new Error(`[E1007: Syntax Error] Expected 'from' after import specifiers at line ${this.peek().line}, column ${this.peek().column}`);
      }
      this.advance(); // consume 'from'

      if (this.peek().type !== TokenType.STRING_LITERAL && this.peek().type !== TokenType.IDENTIFIER) {
        throw new Error(`[E1007: Syntax Error] Expected module path or identifier after 'from' at line ${this.peek().line}, column ${this.peek().column}`);
      }
      const moduleToken = this.advance();
      this.match(TokenType.SEMICOLON);

      return {
        kind: 'ImportStatement',
        moduleName: moduleToken.value,
        specifiers,
        span: createSourceSpan(
          startToken.line,
          startToken.column,
          moduleToken.line,
          moduleToken.column + moduleToken.value.length
        ),
      };
    }

    // Case 2: String literal path or identifier:
    // import "./math" as Math;
    // import "./math";
    // import math as m;
    // import math;
    if (this.peek().type !== TokenType.STRING_LITERAL && this.peek().type !== TokenType.IDENTIFIER) {
      throw new Error(`[E1007: Syntax Error] Expected module identifier or string path after 'import' at line ${startToken.line}, column ${startToken.column}`);
    }
    const moduleToken = this.advance();
    let alias: string | undefined = undefined;
    let isNamespace = false;

    if (this.peek().value === 'as') {
      this.advance(); // consume 'as'
      if (!this.check(TokenType.IDENTIFIER)) {
        throw new Error(`[E1008: Syntax Error] Expected alias identifier after 'as' at line ${this.peek().line}, column ${this.peek().column}`);
      }
      alias = this.advance().value;
      isNamespace = true;
    }

    this.match(TokenType.SEMICOLON);

    return {
      kind: 'ImportStatement',
      moduleName: moduleToken.value,
      alias,
      isNamespace,
      span: createSourceSpan(
        startToken.line,
        startToken.column,
        moduleToken.line,
        moduleToken.column + moduleToken.value.length
      ),
    };
  }

  private parseStructDeclaration(): StructDeclarationNode {
    const startToken = this.advance(); // consume 'struct'
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1001: Syntax Error] Expected struct name identifier after 'struct' at line ${startToken.line}, column ${startToken.column}`);
    }
    const nameToken = this.advance();
    const structName = nameToken.value;

    this.consume(TokenType.LBRACE, `Expected '{' after struct name '${structName}'`);

    const fields: StructFieldDeclaration[] = [];
    const seenFields = new Set<string>();

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (!this.check(TokenType.IDENTIFIER) && !this.peek().type.startsWith('KEYWORD_')) {
        throw new Error(`[E1001: Syntax Error] Expected field name in struct '${structName}' at line ${this.peek().line}, column ${this.peek().column}`);
      }
      const fieldToken = this.advance();
      const fieldName = fieldToken.value;

      if (seenFields.has(fieldName)) {
        throw new Error(`[E1002: Syntax Error] Duplicate field '${fieldName}' in struct '${structName}' at line ${fieldToken.line}, column ${fieldToken.column}`);
      }
      seenFields.add(fieldName);

      this.consume(TokenType.COLON, `Expected ':' after field name '${fieldName}'`);
      const typeAnnotation = this.parseTypeAnnotation();

      if (this.check(TokenType.SEMICOLON) || this.check(TokenType.COMMA)) {
        this.advance();
      }

      fields.push({
        name: fieldName,
        typeAnnotation,
        span: createSourceSpan(fieldToken.line, fieldToken.column, this.peek().line, this.peek().column),
      });
    }

    const endToken = this.consume(TokenType.RBRACE, `Expected '}' after struct '${structName}' fields`);
    this.match(TokenType.SEMICOLON);

    return {
      kind: 'StructDeclaration',
      name: structName,
      fields,
      span: createSourceSpan(startToken.line, startToken.column, endToken.line, endToken.column + 1),
    };
  }

  private parseEnumDeclaration(): EnumDeclarationNode {
    const startToken = this.advance(); // consume 'enum'
    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1001: Syntax Error] Expected enum name identifier after 'enum' at line ${startToken.line}, column ${startToken.column}`);
    }
    const nameToken = this.advance();
    const enumName = nameToken.value;

    this.consume(TokenType.LBRACE, `Expected '{' after enum name '${enumName}'`);

    const variants: EnumVariantDeclaration[] = [];
    const seenVariants = new Set<string>();
    let nextAutoValue = 0;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (!this.check(TokenType.IDENTIFIER)) {
        throw new Error(`[E1001: Syntax Error] Expected variant name in enum '${enumName}' at line ${this.peek().line}, column ${this.peek().column}`);
      }
      const variantToken = this.advance();
      const variantName = variantToken.value;

      if (seenVariants.has(variantName)) {
        throw new Error(`[E1002: Syntax Error] Duplicate variant '${variantName}' in enum '${enumName}' at line ${variantToken.line}, column ${variantToken.column}`);
      }
      seenVariants.add(variantName);

      let value: number | string = nextAutoValue;
      if (this.match(TokenType.ASSIGN)) {
        const valToken = this.peek();
        if (valToken.type === TokenType.NUMBER_LITERAL) {
          this.advance();
          value = Number(valToken.value);
          nextAutoValue = value + 1;
        } else if (valToken.type === TokenType.STRING_LITERAL) {
          this.advance();
          value = valToken.value;
        } else {
          throw new Error(`[E1001: Syntax Error] Expected number or string literal for enum variant value at line ${valToken.line}, column ${valToken.column}`);
        }
      } else {
        nextAutoValue++;
      }

      if (this.check(TokenType.COMMA) || this.check(TokenType.SEMICOLON)) {
        this.advance();
      }

      variants.push({
        name: variantName,
        value,
        span: createSourceSpan(variantToken.line, variantToken.column, this.peek().line, this.peek().column),
      });
    }

    const endToken = this.consume(TokenType.RBRACE, `Expected '}' after enum '${enumName}' variants`);
    this.match(TokenType.SEMICOLON);

    return {
      kind: 'EnumDeclaration',
      name: enumName,
      variants,
      span: createSourceSpan(startToken.line, startToken.column, endToken.line, endToken.column + 1),
    };
  }

  private parseBlockStatement(): BlockStatementNode {
    this.consume(TokenType.LBRACE, "Expected '{'");
    return this.parseBlockStatementBody();
  }

  private parseBlockStatementBody(): BlockStatementNode {
    const startToken = this.previous();
    const statements: UnifiedStatementNode[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.SEMICOLON)) {
        continue;
      }
      statements.push(this.parseStatement());
    }

    const endToken = this.consume(TokenType.RBRACE, "Expected '}' at end of block");

    return {
      kind: 'BlockStatement',
      statements,
      span: createSourceSpan(startToken.line, startToken.column, endToken.line, endToken.column + 1),
    };
  }

  private parseExpressionStatement(): ExpressionStatementNode {
    const expr = this.parseExpression(Precedence.LOWEST);
    this.match(TokenType.SEMICOLON);

    return {
      kind: 'ExpressionStatement',
      expression: expr,
      span: expr.span,
    };
  }

  private parseTypeAnnotation(): string {
    const token = this.peek();
    if (
      token.type === TokenType.TYPE_INT ||
      token.type === TokenType.TYPE_INT32 ||
      token.type === TokenType.TYPE_FLOAT32 ||
      token.type === TokenType.TYPE_BOOL ||
      token.type === TokenType.TYPE_VOID ||
      token.type === TokenType.IDENTIFIER
    ) {
      this.advance();
      let typeStr = token.value;
      // Support array type like Int32[] or Byte[64]
      if (this.match(TokenType.LBRACKET)) {
        if (this.check(TokenType.NUMBER_LITERAL)) {
          typeStr += `[${this.advance().value}]`;
        } else {
          typeStr += '[]';
        }
        this.consume(TokenType.RBRACKET, "Expected ']' after array type");
      }
      return typeStr;
    }
    throw new Error(`[E1009: Syntax Error] Expected type name at line ${token.line}, column ${token.column}`);
  }

  // ── Pratt Expression Parser ─────────────────────────────────────────────────

  public parseExpression(precedence: Precedence): ExpressionNode {
    const token = this.peek();
    let left = this.parsePrefix();

    while (!this.isAtEnd() && precedence < this.getInfixPrecedence(this.peek())) {
      left = this.parseInfix(left);
    }

    return left;
  }

  private parsePrefix(): ExpressionNode {
    const token = this.advance();

    switch (token.type) {
      case TokenType.NUMBER_LITERAL: {
        const val = token.value.endsWith('f') || token.value.endsWith('F')
          ? parseFloat(token.value.slice(0, -1))
          : parseFloat(token.value);
        return {
          kind: 'Literal',
          literalType: 'number',
          value: val,
          raw: token.value,
          span: createSourceSpan(token.line, token.column, token.line, token.column + token.value.length),
        };
      }

      case TokenType.STRING_LITERAL:
        return {
          kind: 'Literal',
          literalType: 'string',
          value: token.value,
          raw: `"${token.value}"`,
          span: createSourceSpan(token.line, token.column, token.line, token.column + token.value.length + 2),
        };

      case TokenType.KEYWORD_TRUE:
        return {
          kind: 'Literal',
          literalType: 'boolean',
          value: true,
          span: createSourceSpan(token.line, token.column, token.line, token.column + 4),
        };

      case TokenType.KEYWORD_FALSE:
        return {
          kind: 'Literal',
          literalType: 'boolean',
          value: false,
          span: createSourceSpan(token.line, token.column, token.line, token.column + 5),
        };

      case TokenType.KEYWORD_NULL:
        return {
          kind: 'Literal',
          literalType: 'null',
          value: null,
          span: createSourceSpan(token.line, token.column, token.line, token.column + 4),
        };

      case TokenType.IDENTIFIER: {
        const idSpan = createSourceSpan(token.line, token.column, token.line, token.column + token.value.length);
        if (this.check(TokenType.LBRACE)) {
          const savedPos = this.current;
          try {
            this.advance(); // consume '{'
            const properties: Array<{ key: string; value: ExpressionNode; span?: SourceSpan }> = [];
            if (!this.check(TokenType.RBRACE)) {
              do {
                const keyToken = this.advance();
                if (keyToken.type !== TokenType.IDENTIFIER && keyToken.type !== TokenType.STRING_LITERAL && !keyToken.type.startsWith('KEYWORD_')) {
                  throw new Error('Not struct literal');
                }
                this.consume(TokenType.COLON, "Expected ':' after field key");
                const val = this.parseExpression(Precedence.LOWEST);
                properties.push({
                  key: keyToken.value,
                  value: val,
                  span: createSourceSpan(keyToken.line, keyToken.column, val.span?.end.line || keyToken.line, val.span?.end.column || keyToken.column),
                });
              } while (this.match(TokenType.COMMA) || this.match(TokenType.SEMICOLON));
            }
            const endToken = this.consume(TokenType.RBRACE, "Expected '}' after struct fields");
            return {
              kind: 'ObjectLiteral',
              structName: token.value,
              properties,
              span: createSourceSpan(token.line, token.column, endToken.line, endToken.column + 1),
            };
          } catch {
            this.current = savedPos; // backtrack
          }
        }
        return {
          kind: 'Identifier',
          name: token.value,
          span: idSpan,
        };
      }

      case TokenType.LPAREN: {
        const expr = this.parseExpression(Precedence.LOWEST);
        this.consume(TokenType.RPAREN, "Expected ')' after grouped expression");
        return expr;
      }

      case TokenType.MINUS:
      case TokenType.OP_NOT:
      case TokenType.PLUS: {
        const operand = this.parseExpression(Precedence.PREFIX);
        return {
          kind: 'UnaryExpression',
          operator: token.value,
          operand,
          prefix: true,
          span: createSourceSpan(
            token.line,
            token.column,
            operand.span?.end.line || token.line,
            operand.span?.end.column || token.column + 1
          ),
        };
      }

      case TokenType.LBRACKET: { // Array Literal
        const elements: ExpressionNode[] = [];
        if (!this.check(TokenType.RBRACKET)) {
          do {
            elements.push(this.parseExpression(Precedence.LOWEST));
          } while (this.match(TokenType.COMMA));
        }
        const endToken = this.consume(TokenType.RBRACKET, "Expected ']' after array elements");
        return {
          kind: 'ArrayLiteral',
          elements,
          span: createSourceSpan(token.line, token.column, endToken.line, endToken.column + 1),
        };
      }

      case TokenType.LBRACE: { // Object Literal
        const properties: Array<{ key: string; value: ExpressionNode; span?: SourceSpan }> = [];
        if (!this.check(TokenType.RBRACE)) {
          do {
            const keyToken = this.advance();
            if (keyToken.type !== TokenType.IDENTIFIER && keyToken.type !== TokenType.STRING_LITERAL && !keyToken.type.startsWith('KEYWORD_')) {
              throw new Error(`[E1010: Syntax Error] Expected object key at line ${keyToken.line}, column ${keyToken.column}`);
            }
            this.consume(TokenType.COLON, "Expected ':' after object key");
            const val = this.parseExpression(Precedence.LOWEST);
            properties.push({
              key: keyToken.value,
              value: val,
              span: createSourceSpan(keyToken.line, keyToken.column, val.span?.end.line || keyToken.line, val.span?.end.column || keyToken.column),
            });
          } while (this.match(TokenType.COMMA));
        }
        const endToken = this.consume(TokenType.RBRACE, "Expected '}' after object properties");
        return {
          kind: 'ObjectLiteral',
          properties,
          span: createSourceSpan(token.line, token.column, endToken.line, endToken.column + 1),
        };
      }

      case TokenType.KEYWORD_FUNCTION:
      case TokenType.KEYWORD_FN: {
        this.current--; // Backtrack so parseFunctionNode advances startToken
        return this.parseFunctionNode(false);
      }

      case TokenType.KEYWORD_ASYNC: {
        if (this.check(TokenType.KEYWORD_FUNCTION) || this.check(TokenType.KEYWORD_FN)) {
          return this.parseFunctionNode(false, true /* isAsync */);
        }
        throw new Error(
          `[E1015: Syntax Error] 'async' keyword in expression must be followed by 'fn' or 'function' at line ${token.line}, column ${token.column}`
        );
      }

      case TokenType.KEYWORD_AWAIT: {
        const argument = this.parseExpression(Precedence.PREFIX);
        return {
          kind: 'AwaitExpression',
          argument,
          span: createSourceSpan(
            token.line,
            token.column,
            argument.span?.end.line || token.line,
            argument.span?.end.column || token.column
          ),
        };
      }

      default:
        throw new Error(`[E1011: Syntax Error] Unexpected token '${token.value}' (${token.type}) in expression at line ${token.line}, column ${token.column}`);
    }
  }

  private parseInfix(left: ExpressionNode): ExpressionNode {
    const token = this.advance();

    // Call Expression: `foo(...)`
    if (token.type === TokenType.LPAREN) {
      const args: ExpressionNode[] = [];
      if (!this.check(TokenType.RPAREN)) {
        do {
          args.push(this.parseExpression(Precedence.LOWEST));
        } while (this.match(TokenType.COMMA));
      }
      const endToken = this.consume(TokenType.RPAREN, "Expected ')' after arguments");
      return {
        kind: 'CallExpression',
        callee: left,
        args,
        span: createSourceSpan(
          left.span?.start.line || token.line,
          left.span?.start.column || token.column,
          endToken.line,
          endToken.column + 1
        ),
      };
    }

    // Member Access: `foo.bar`
    if (token.type === TokenType.DOT) {
      if (!this.check(TokenType.IDENTIFIER) && !this.peek().type.startsWith('KEYWORD_')) {
        throw new Error(`[E1012: Syntax Error] Expected property identifier after '.' at line ${this.peek().line}, column ${this.peek().column}`);
      }
      const propToken = this.advance();
      return {
        kind: 'MemberExpression',
        object: left,
        property: propToken.value,
        computed: false,
        span: createSourceSpan(
          left.span?.start.line || token.line,
          left.span?.start.column || token.column,
          propToken.line,
          propToken.column + propToken.value.length
        ),
      };
    }

    // Computed Member Access: `foo[bar]`
    if (token.type === TokenType.LBRACKET) {
      const indexExpr = this.parseExpression(Precedence.LOWEST);
      const endToken = this.consume(TokenType.RBRACKET, "Expected ']' after computed index");
      return {
        kind: 'MemberExpression',
        object: left,
        property: indexExpr,
        computed: true,
        span: createSourceSpan(
          left.span?.start.line || token.line,
          left.span?.start.column || token.column,
          endToken.line,
          endToken.column + 1
        ),
      };
    }

    // Equality via 'one is': `left one is right`
    if (token.type === TokenType.KEYWORD_ONE) {
      if (this.check(TokenType.KEYWORD_IS) || this.peek().value === 'is') {
        this.advance(); // consume 'is'
        const right = this.parseExpression(Precedence.EQUALITY);
        return {
          kind: 'BinaryExpression',
          operator: '==',
          left,
          right,
          span: createSourceSpan(
            left.span?.start.line || token.line,
            left.span?.start.column || token.column,
            right.span?.end.line || token.line,
            right.span?.end.column || token.column + 1
          ),
        };
      }
    }

    // Binary / Assignment Operators
    const precedence = this.getBinaryPrecedence(token.type);
    const right = this.parseExpression(precedence);

    return {
      kind: 'BinaryExpression',
      operator: token.value,
      left,
      right,
      span: createSourceSpan(
        left.span?.start.line || token.line,
        left.span?.start.column || token.column,
        right.span?.end.line || token.line,
        right.span?.end.column || token.column + 1
      ),
    };
  }

  private getInfixPrecedence(token: Token): Precedence {
    switch (token.type) {
      case TokenType.LPAREN:
        return Precedence.CALL;
      case TokenType.DOT:
      case TokenType.LBRACKET:
        return Precedence.MEMBER;
      case TokenType.KEYWORD_ONE: {
        const next = this.peekNext();
        if (next && (next.type === TokenType.KEYWORD_IS || next.value === 'is')) {
          return Precedence.EQUALITY;
        }
        return Precedence.LOWEST;
      }

      default:
        return this.getBinaryPrecedence(token.type);
    }
  }

  private getBinaryPrecedence(type: TokenType): Precedence {
    switch (type) {
      case TokenType.ASSIGN:
        return Precedence.ASSIGNMENT;
      case TokenType.OP_OR:
        return Precedence.LOGICAL_OR;
      case TokenType.OP_AND:
        return Precedence.LOGICAL_AND;
      case TokenType.EQ:
      case TokenType.OP_NEQ:
        return Precedence.EQUALITY;
      case TokenType.LT:
      case TokenType.GT:
      case TokenType.OP_LTE:
      case TokenType.OP_GTE:
        return Precedence.COMPARISON;
      case TokenType.PLUS:
      case TokenType.MINUS:
        return Precedence.SUM;
      case TokenType.STAR:
      case TokenType.SLASH:
      case TokenType.PERCENT:
        return Precedence.PRODUCT;

      default:
        return Precedence.LOWEST;
    }
  }

  // ── Helper Utilities ────────────────────────────────────────────────────────

  private peek(): Token {
    return this.tokens[this.current] || { type: TokenType.EOF, value: '', line: 0, column: 0 };
  }

  private peekNext(): Token | undefined {
    if (this.current + 1 < this.tokens.length) {
      return this.tokens[this.current + 1];
    }
    return undefined;
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === TokenType.EOF;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw new Error(`[E1013: Syntax Error] ${message} at line ${token.line}, column ${token.column} (got '${token.value}')`);
  }

  private synchronize(): void {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.SEMICOLON) return;
      switch (this.peek().type) {
        case TokenType.KEYWORD_LET:
        case TokenType.KEYWORD_CONST:
        case TokenType.KEYWORD_ONES:
        case TokenType.KEYWORD_ONE:
        case TokenType.KEYWORD_FUNCTION:
        case TokenType.KEYWORD_FN:
        case TokenType.KEYWORD_ASYNC:
        case TokenType.KEYWORD_IF:
        case TokenType.KEYWORD_WHILE:
        case TokenType.KEYWORD_FOR:
        case TokenType.KEYWORD_RETURN:
        case TokenType.KEYWORD_PRINT:
        case TokenType.KEYWORD_IMPORT:
          return;
      }
      this.advance();
    }
  }
}
