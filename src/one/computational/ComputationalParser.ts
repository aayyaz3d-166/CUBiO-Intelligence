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
  ImportStatementNode,
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

    if (token.type === TokenType.KEYWORD_LET || token.type === TokenType.KEYWORD_CONST) {
      return this.parseVariableDeclaration();
    }

    if (token.type === TokenType.KEYWORD_FUNCTION || token.type === TokenType.KEYWORD_FN) {
      return this.parseFunctionDeclaration();
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

    if (token.type === TokenType.KEYWORD_IMPORT) {
      return this.parseImportStatement();
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

  private parseFunctionDeclaration(): FunctionDeclarationNode {
    const startToken = this.advance(); // consume 'function' or 'fn'

    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1003: Syntax Error] Expected function name after '${startToken.value}' at line ${startToken.line}, column ${startToken.column}`);
    }

    const nameToken = this.advance();
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
      name: nameToken.value,
      params,
      returnTypeAnnotation,
      body,
      span: createSourceSpan(startToken.line, startToken.column, body.span?.end.line || startToken.line, body.span?.end.column || startToken.column),
    };
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
    if (this.match(TokenType.KEYWORD_ELSE)) {
      if (this.check(TokenType.KEYWORD_IF)) {
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
    const body = this.parseBlockStatementBody();

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
    const body = this.parseBlockStatementBody();

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

  private parseImportStatement(): ImportStatementNode {
    const startToken = this.advance(); // consume 'import'

    if (!this.check(TokenType.IDENTIFIER)) {
      throw new Error(`[E1007: Syntax Error] Expected module identifier after 'import' at line ${startToken.line}, column ${startToken.column}`);
    }
    const moduleToken = this.advance();
    let alias: string | undefined = undefined;

    if (this.peek().value === 'as') {
      this.advance(); // consume 'as'
      if (!this.check(TokenType.IDENTIFIER)) {
        throw new Error(`[E1008: Syntax Error] Expected alias identifier after 'as' at line ${this.peek().line}, column ${this.peek().column}`);
      }
      alias = this.advance().value;
    }

    this.match(TokenType.SEMICOLON);

    return {
      kind: 'ImportStatement',
      moduleName: moduleToken.value,
      alias,
      span: createSourceSpan(
        startToken.line,
        startToken.column,
        moduleToken.line,
        moduleToken.column + moduleToken.value.length
      ),
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

      case TokenType.IDENTIFIER:
        return {
          kind: 'Identifier',
          name: token.value,
          span: createSourceSpan(token.line, token.column, token.line, token.column + token.value.length),
        };

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
            if (keyToken.type !== TokenType.IDENTIFIER && keyToken.type !== TokenType.STRING_LITERAL) {
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
      if (!this.check(TokenType.IDENTIFIER)) {
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
        case TokenType.KEYWORD_FUNCTION:
        case TokenType.KEYWORD_FN:
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
