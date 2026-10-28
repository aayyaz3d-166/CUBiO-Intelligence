import { Token, TokenType } from './oneLexer';

// ─── Base AST ──────────────────────────────────────────────────────────
export interface ASTNode {
  type: string;
}

// ─── Program ────────────────────────────────────────────────────────────
export interface ProgramNode extends ASTNode {
  type: 'Program';
  rssMaxLimitMB: number;
  statements: StatementNode[];
  nodes: NodeDeclarationNode[];
  funnels: FunnelDeclarationNode[];
}

// ─── Type Annotations ──────────────────────────────────────────────────
export type DataType = 'number' | 'string' | 'bool' | 'array' | 'object' | 'auto';

// ─── Spatial ───────────────────────────────────────────────────────────
export interface SpatialCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface NodeDeclarationNode extends ASTNode {
  type: 'NodeDeclaration';
  id: string;
  coordinate: SpatialCoordinate;
  alignments: SpatialCoordinate[];
  checkpoints: string[];
}

export interface FunnelDeclarationNode extends ASTNode {
  type: 'FunnelDeclaration';
  id: string;
  sourceNode: string;
  targetNode: string;
  bufferMb: number;
}

// ─── Function Declaration ─────────────────────────────────────────────
export interface FunctionDeclarationNode extends ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  parameters: Array<{ name: string; type: DataType }>;
  returnType: DataType;
  body: StatementNode[];
  line: number;
  column: number;
}

// ─── Return Statement ─────────────────────────────────────────────────
export interface ReturnStatementNode extends ASTNode {
  type: 'Return';
  expression: ExpressionNode | null;
  line: number;
  column: number;
}

// ─── Function Call ────────────────────────────────────────────────────
export interface FunctionCallNode {
  type: 'FunctionCall';
  name: string;
  arguments: ExpressionNode[];
  line: number;
  column: number;
}

// ─── Variable Declaration ──────────────────────────────────────────────
export interface VariableDeclarationNode extends ASTNode {
  type: 'VariableDeclaration';
  id: string;
  dataType: DataType;
  initializer: ExpressionNode | null;
}

// ─── Expression HIR ────────────────────────────────────────────────────
export type ExpressionNode = LiteralExpressionNode | IdentifierExpressionNode
                          | BinaryExpressionNode | UnaryExpressionNode
                          | ArrayLiteralNode | ObjectLiteralNode
                          | FunctionCallNode;

export interface LiteralExpressionNode {
  type: 'Literal';
  value: number | string | boolean | null;
  raw: string;
  line: number;
  column: number;
}

export interface IdentifierExpressionNode {
  type: 'Identifier';
  name: string;
  line: number;
  column: number;
}

export interface BinaryExpressionNode {
  type: 'Binary';
  left: ExpressionNode;
  operator: TokenType;
  right: ExpressionNode;
  line: number;
  column: number;
}

export interface UnaryExpressionNode {
  type: 'Unary';
  operator: TokenType;
  operand: ExpressionNode;
  line: number;
  column: number;
}

export interface ArrayLiteralNode {
  type: 'ArrayLiteral';
  elements: ExpressionNode[];
  line: number;
  column: number;
}

export interface ObjectLiteralNode {
  type: 'ObjectLiteral';
  properties: Array<{ key: string; value: ExpressionNode }>;
  line: number;
  column: number;
}

// ─── Statement AST ─────────────────────────────────────────────────────
export type StatementNode =
  | VariableDeclarationNode           // let x = expr;
  | BlockStatementNode                // { stmt1; stmt2; ... }
  | IfStatementNode                   // if (cond) { then } else { else }
  | WhileStatementNode                // while (cond) { body }
  | ForOfStatementNode                // for (let x of expr) { body }
  | BreakStatementNode                // break;
  | ContinueStatementNode             // continue;
  | ExpressionStatementNode          // expr;  (for side effects)
  | FunctionDeclarationNode          // function foo() { ... }
  | ReturnStatementNode;              // return expr;

export interface BlockStatementNode {
  type: 'Block';
  statements: StatementNode[];
  line: number;
  column: number;
}

export interface IfStatementNode {
  type: 'If';
  condition: ExpressionNode;
  thenBranch: StatementNode[];
  elseBranch: StatementNode[] | null;
  line: number;
  column: number;
}

export interface WhileStatementNode {
  type: 'While';
  condition: ExpressionNode;
  body: StatementNode[];
  line: number;
  column: number;
}

export interface ForOfStatementNode {
  type: 'ForOf';
  variable: string;
  arrayExpr: ExpressionNode;
  body: StatementNode[];
  line: number;
  column: number;
}

export interface BreakStatementNode {
  type: 'Break';
  line: number;
  column: number;
}

export interface ContinueStatementNode {
  type: 'Continue';
  line: number;
  column: number;
}

export interface ExpressionStatementNode {
  type: 'ExpressionStatement';
  expression: ExpressionNode;
  line: number;
  column: number;
}

// ─── Helper ────────────────────────────────────────────────────────────
function makeLiteral(value: number | string | boolean | null, raw: string, line: number, column: number): LiteralExpressionNode {
  return { type: 'Literal', value, raw, line, column };
}

export class OneParser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): ProgramNode {
    let rssMaxLimitMB = 512;
    const statements: StatementNode[] = [];
    const nodes: NodeDeclarationNode[] = [];
    const funnels: FunnelDeclarationNode[] = [];

    while (!this.isAtEnd()) {
      if (this.match(TokenType.KEYWORD_RSS_MAX)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after rss_max");
        const token = this.consume(TokenType.NUMBER_LITERAL, 'Expected number for rss_max limit');
        rssMaxLimitMB = parseFloat(token.value);
        this.consume(TokenType.SEMICOLON, "Expected ';' after rss_max definition");
      } else if (this.match(TokenType.KEYWORD_LET) || this.match(TokenType.KEYWORD_CONST)) {
        statements.push(this.parseVariableDeclaration());
      } else if (this.match(TokenType.KEYWORD_NODE)) {
        nodes.push(this.parseNodeDeclaration());
      } else if (this.match(TokenType.KEYWORD_FUNNEL)) {
        funnels.push(this.parseFunnelDeclaration());
      } else if (this.match(TokenType.KEYWORD_FUNCTION)) {
        statements.push(this.parseFunctionDeclaration());
      } else if (this.match(TokenType.KEYWORD_RETURN)) {
        statements.push(this.parseReturnStatement());
      } else if (this.match(TokenType.KEYWORD_IF)) {
        statements.push(this.parseIfStatement());
      } else if (this.match(TokenType.KEYWORD_WHILE)) {
        statements.push(this.parseWhileStatement());
      } else if (this.match(TokenType.KEYWORD_FOR)) {
        statements.push(this.parseForOfStatement());
      } else if (this.match(TokenType.KEYWORD_BREAK)) {
        statements.push(this.parseBreakStatement());
      } else if (this.match(TokenType.KEYWORD_CONTINUE)) {
        statements.push(this.parseContinueStatement());
      } else if (this.match(TokenType.LBRACE)) {
        statements.push(this.parseBlockStatement());
      } else {
        // Expression statement (identifier, literal, etc.)
        statements.push(this.parseExpressionStatement());
      }
    }

    return {
      type: 'Program',
      rssMaxLimitMB,
      statements,
      nodes,
      funnels,
    };
  }

  // ── Variable Declaration ─────────────────────────────────────────────
  private parseVariableDeclaration(): VariableDeclarationNode {
    const isConst = this.previous().type === TokenType.KEYWORD_CONST;
    const idToken = this.consume(TokenType.IDENTIFIER, 'Expected variable identifier');

    let dataType: DataType = 'auto';

    // optional type annotation: : type
    if (this.match(TokenType.COLON)) {
      const t = this.peek().type;
      if (t === TokenType.KEYWORD_NUMBER) { dataType = 'number'; this.advance(); }
      else if (t === TokenType.KEYWORD_STRING) { dataType = 'string'; this.advance(); }
      else if (t === TokenType.KEYWORD_BOOL) { dataType = 'bool'; this.advance(); }
      else if (t === TokenType.KEYWORD_ARRAY) { dataType = 'array'; this.advance(); }
      else if (t === TokenType.KEYWORD_OBJECT) { dataType = 'object'; this.advance(); }
      else {
        throw new Error(`[Parser Error] Unknown type annotation '${this.peek().value}' at line ${this.peek().line}`);
      }
    }

    // optional initializer: = expression
    let initializer: ExpressionNode | null = null;
    if (this.match(TokenType.ASSIGN)) {
      initializer = this.parseExpression();
    }

    this.consume(TokenType.SEMICOLON, "Expected ';' after variable declaration");

    // Infer type from initializer if not annotated
    if (dataType === 'auto' && initializer !== null) {
      dataType = this.inferType(initializer);
    }

    return {
      type: 'VariableDeclaration',
      id: idToken.value,
      dataType,
      initializer,
    };
  }

  // ── Block Statement ────────────────────────────────────────────────────
  private parseBlockStatement(): BlockStatementNode {
    const start = this.previous();
    this.consume(TokenType.LBRACE, "Expected '{' for block statement");
    const statements: StatementNode[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }
    this.consume(TokenType.RBRACE, "Expected '}' to close block statement");
    return { type: 'Block', statements, line: start.line, column: start.column };
  }

  // ── If Statement ──────────────────────────────────────────────────────
  private parseIfStatement(): IfStatementNode {
    const start = this.previous();
    this.consume(TokenType.LPAREN, "Expected '(' after 'if'");
    const condition = this.parseExpression();
    this.consume(TokenType.RPAREN, "Expected ')' after condition");
    const thenBranch = this.parseBlockStatement().statements;
    let elseBranch: StatementNode[] | null = null;
    if (this.match(TokenType.KEYWORD_ELSE)) {
      elseBranch = this.parseBlockStatement().statements;
    }
    return { type: 'If', condition, thenBranch, elseBranch, line: start.line, column: start.column };
  }

  // ── While Statement ────────────────────────────────────────────────────
  private parseWhileStatement(): WhileStatementNode {
    const start = this.previous();
    this.consume(TokenType.LPAREN, "Expected '(' after 'while'");
    const condition = this.parseExpression();
    this.consume(TokenType.RPAREN, "Expected ')' after condition");
    const body = this.parseBlockStatement().statements;
    return { type: 'While', condition, body, line: start.line, column: start.column };
  }

  // ── For-Of Statement ───────────────────────────────────────────────────
  private parseForOfStatement(): ForOfStatementNode {
    const start = this.previous();
    this.consume(TokenType.LPAREN, "Expected '(' after 'for'");
    this.consume(TokenType.KEYWORD_LET, "Expected 'let' in for-of");
    const variable = this.consume(TokenType.IDENTIFIER, 'Expected variable name in for-of').value;
    this.consume(TokenType.KEYWORD_OF, "Expected 'of' in for-of");
    const arrayExpr = this.parseExpression();
    this.consume(TokenType.RPAREN, "Expected ')' after for-of header");
    const body = this.parseBlockStatement().statements;
    return { type: 'ForOf', variable, arrayExpr, body, line: start.line, column: start.column };
  }

  // ── Break Statement ────────────────────────────────────────────────────
  private parseBreakStatement(): BreakStatementNode {
    const start = this.previous();
    this.consume(TokenType.SEMICOLON, "Expected ';' after 'break'");
    return { type: 'Break', line: start.line, column: start.column };
  }

  // ── Continue Statement ─────────────────────────────────────────────────
  private parseContinueStatement(): ContinueStatementNode {
    const start = this.previous();
    this.consume(TokenType.SEMICOLON, "Expected ';' after 'continue'");
    return { type: 'Continue', line: start.line, column: start.column };
  }

  // ── Expression Statement ──────────────────────────────────────────────
  private parseExpressionStatement(): ExpressionStatementNode {
    const start = this.peek();
    const expr = this.parseExpression();
    this.consume(TokenType.SEMICOLON, "Expected ';' after expression statement");
    return { type: 'ExpressionStatement', expression: expr, line: start.line, column: start.column };
  }

  // ── Generic statement dispatcher ──────────────────────────────────────
  private parseStatement(): StatementNode {
    if (this.match(TokenType.LBRACE)) return this.parseBlockStatement();
    if (this.match(TokenType.KEYWORD_IF)) return this.parseIfStatement();
    if (this.match(TokenType.KEYWORD_WHILE)) return this.parseWhileStatement();
    if (this.match(TokenType.KEYWORD_FOR)) return this.parseForOfStatement();
    if (this.match(TokenType.KEYWORD_BREAK)) return this.parseBreakStatement();
    if (this.match(TokenType.KEYWORD_CONTINUE)) return this.parseContinueStatement();
    if (this.match(TokenType.KEYWORD_LET) || this.match(TokenType.KEYWORD_CONST)) return this.parseVariableDeclaration();
    if (this.match(TokenType.KEYWORD_FUNCTION)) return this.parseFunctionDeclaration();
    if (this.match(TokenType.KEYWORD_RETURN)) return this.parseReturnStatement();
    return this.parseExpressionStatement();
  }

  // ── Expression Parsing (Precedence Climbing) ────────────────────────
  private parseExpression(): ExpressionNode {
    return this.parsePrecedence(1);
  }

  private parsePrecedence(minPrec: number): ExpressionNode {
    let left: ExpressionNode;

    // Prefix unary: !
    if (this.match(TokenType.OP_NOT)) {
      const opTok = this.previous();
      const operand = this.parsePrecedence(7);
      left = { type: 'Unary', operator: opTok.type, operand, line: opTok.line, column: opTok.column };
    }
    // Grouped: ( expr )
    else if (this.match(TokenType.LPAREN)) {
      const startLine = this.previous().line;
      const startCol = this.previous().column;
      left = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expected ')' after expression");
      (left as any).line = startLine;
      (left as any).column = startCol;
    }
    // Array literal: [ expr, ... ]
    else if (this.match(TokenType.LBRACKET)) {
      left = this.parseArrayLiteral();
    }
    // Object literal: { k: v, ... }
    else if (this.match(TokenType.LBRACE)) {
      left = this.parseObjectLiteral();
    }
    // Primary: literal or identifier
    else {
      left = this.parsePrimary();
    }

    // Infix loop
    while (!this.isAtEnd()) {
      const token = this.peek();
      const prec = this.binaryPrecedence(token.type);
      if (prec < minPrec || prec === 0) break;
      this.advance();
      const right = this.parsePrecedence(prec + 1);
      left = {
        type: 'Binary',
        left,
        operator: token.type,
        right,
        line: token.line,
        column: token.column,
      };
    }

    return left;
  }

  private binaryPrecedence(type: TokenType): number {
    switch (type) {
      case TokenType.OP_OR:   return 1;
      case TokenType.OP_AND:  return 2;
      case TokenType.OP_EQ:
      case TokenType.OP_NEQ:  return 3;
      case TokenType.OP_LT:
      case TokenType.OP_GT:
      case TokenType.OP_LTE:
      case TokenType.OP_GTE:  return 4;
      case TokenType.OP_ADD:
      case TokenType.OP_SUB:  return 5;
      case TokenType.OP_MUL:
      case TokenType.OP_DIV:
      case TokenType.OP_MOD:  return 6;
      default: return 0;
    }
  }

  private parsePrimary(): ExpressionNode {
    const token = this.peek();

    if (token.type === TokenType.NUMBER_LITERAL) {
      this.advance();
      return makeLiteral(parseFloat(token.value), token.value, token.line, token.column);
    }

    if (token.type === TokenType.STRING_LITERAL) {
      this.advance();
      const str = token.value.startsWith('"') ? token.value.slice(1, -1) : token.value.slice(1, -1);
      return makeLiteral(str, token.value, token.line, token.column);
    }

    if (token.type === TokenType.KEYWORD_TRUE) {
      this.advance();
      return makeLiteral(true, 'true', token.line, token.column);
    }

    if (token.type === TokenType.KEYWORD_FALSE) {
      this.advance();
      return makeLiteral(false, 'false', token.line, token.column);
    }

    if (token.type === TokenType.KEYWORD_NULL) {
      this.advance();
      return makeLiteral(null, 'null', token.line, token.column);
    }

    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      const name = token.value;
      let expr: ExpressionNode = { type: 'Identifier', name, line: token.line, column: token.column };

      // Check for function call: identifier(args)
      if (this.match(TokenType.LPAREN)) {
        const args: ExpressionNode[] = [];
        if (!this.check(TokenType.RPAREN)) {
          args.push(this.parseExpression());
          while (this.match(TokenType.COMMA)) {
            args.push(this.parseExpression());
          }
        }
        this.consume(TokenType.RPAREN, "Expected ')' after arguments");
        expr = {
          type: 'FunctionCall',
          name,
          arguments: args,
          line: token.line,
          column: token.column,
        };
      }

      return expr;
    }

    throw new Error(`[Parser Error] Unexpected token '${token.value}' at line ${token.line}, column ${token.column}`);
  }

  private parseArrayLiteral(): ArrayLiteralNode {
    const start = this.previous();
    const elements: ExpressionNode[] = [];
    if (!this.check(TokenType.RBRACKET)) {
      elements.push(this.parseExpression());
      while (this.match(TokenType.COMMA)) {
        elements.push(this.parseExpression());
      }
    }
    this.consume(TokenType.RBRACKET, "Expected ']' after array literal");
    return { type: 'ArrayLiteral', elements, line: start.line, column: start.column };
  }

  private parseObjectLiteral(): ObjectLiteralNode {
    const start = this.previous();
    const properties: Array<{ key: string; value: ExpressionNode }> = [];
    if (!this.check(TokenType.RBRACE)) {
      const keyTok = this.consume(TokenType.IDENTIFIER, 'Expected property key in object literal');
      this.consume(TokenType.COLON, "Expected ':' after property key");
      properties.push({ key: keyTok.value, value: this.parseExpression() });
      while (this.match(TokenType.COMMA)) {
        const k = this.consume(TokenType.IDENTIFIER, 'Expected property key').value;
        this.consume(TokenType.COLON, "Expected ':' after property key");
        properties.push({ key: k, value: this.parseExpression() });
      }
    }
    this.consume(TokenType.RBRACE, "Expected '}' after object literal");
    return { type: 'ObjectLiteral', properties, line: start.line, column: start.column };
  }

  // ── Type Inference ────────────────────────────────────────────────────
  private inferType(expr: ExpressionNode): DataType {
    switch (expr.type) {
      case 'Literal':
        if (typeof expr.value === 'number') return 'number';
        if (typeof expr.value === 'string') return 'string';
        if (typeof expr.value === 'boolean') return 'bool';
        return 'object';
      case 'ArrayLiteral':  return 'array';
      case 'ObjectLiteral': return 'object';
      case 'Identifier':    return 'number';   // conservative default for identifiers
      case 'Unary':
        // !expr → bool; other unary ops TBD → number
        if (expr.operator === TokenType.OP_NOT) return 'bool';
        return 'number';
      case 'Binary': {
        // Comparison operators always produce bool
        switch (expr.operator) {
          case TokenType.OP_EQ:
          case TokenType.OP_NEQ:
          case TokenType.OP_LT:
          case TokenType.OP_GT:
          case TokenType.OP_LTE:
          case TokenType.OP_GTE:
          case TokenType.OP_AND:
          case TokenType.OP_OR:
            return 'bool';
          default:
            return 'number';
        }
      }
      default: return 'number';
    }
  }

  private parseNodeDeclaration(): NodeDeclarationNode {
    const idToken = this.consume(TokenType.IDENTIFIER, 'Expected node identifier');

    this.consume(TokenType.LBRACE, "Expected '{' to open node body");

    let coordinate: SpatialCoordinate = { x: 0, y: 0, z: 0 };
    const alignments: SpatialCoordinate[] = [];
    const checkpoints: string[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.KEYWORD_SPACE)) {
        coordinate = this.parseSpatialCoordinate();
        this.consume(TokenType.SEMICOLON, "Expected ';' after @Space statement");
      } else if (this.match(TokenType.KEYWORD_ALIGN)) {
        this.consume(TokenType.OP_ALIGN, "Expected '=>' for alignment");
        alignments.push(this.parseSpatialCoordinate());
        this.consume(TokenType.SEMICOLON, "Expected ';' after align statement");
      } else if (this.match(TokenType.KEYWORD_CHECKPOINT)) {
        const cpName = this.consume(TokenType.IDENTIFIER, 'Expected checkpoint identifier').value;
        checkpoints.push(cpName);
        this.consume(TokenType.SEMICOLON, "Expected ';' after checkpoint");
      } else {
        throw new Error(`[Parser Error] Unknown property '${this.peek().value}' inside node declaration`);
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}' to close node body");

    return {
      type: 'NodeDeclaration',
      id: idToken.value,
      coordinate,
      alignments,
      checkpoints,
    };
  }

  private parseFunnelDeclaration(): FunnelDeclarationNode {
    const idToken = this.consume(TokenType.IDENTIFIER, 'Expected funnel identifier');
    this.consume(TokenType.LBRACE, "Expected '{' to open funnel body");

    this.consume(TokenType.KEYWORD_STREAM, "Expected 'stream' in funnel");
    const src = this.consume(TokenType.IDENTIFIER, 'Expected source node identifier').value;
    this.consume(TokenType.OP_FUNNEL, "Expected '->' operator");
    const tgt = this.consume(TokenType.IDENTIFIER, 'Expected target node identifier').value;

    let bufferMb = 64; // Default buffer cap
    if (this.match(TokenType.COLON)) {
      const bufToken = this.consume(TokenType.NUMBER_LITERAL, 'Expected buffer size in MB');
      bufferMb = parseFloat(bufToken.value);
    }
    this.consume(TokenType.SEMICOLON, "Expected ';' after stream definition");

    this.consume(TokenType.RBRACE, "Expected '}' to close funnel body");

    return {
      type: 'FunnelDeclaration',
      id: idToken.value,
      sourceNode: src,
      targetNode: tgt,
      bufferMb,
    };
  }

  private parseSpatialCoordinate(): SpatialCoordinate {
    this.consume(TokenType.LPAREN, "Expected '(' for spatial coordinates");
    const x = parseFloat(this.consume(TokenType.NUMBER_LITERAL, 'Expected X coordinate').value);
    this.consume(TokenType.COMMA, "Expected ','");
    const y = parseFloat(this.consume(TokenType.NUMBER_LITERAL, 'Expected Y coordinate').value);
    this.consume(TokenType.COMMA, "Expected ','");
    const z = parseFloat(this.consume(TokenType.NUMBER_LITERAL, 'Expected Z coordinate').value);
    this.consume(TokenType.RPAREN, "Expected ')' for spatial coordinates");

    return { x, y, z };
  }

  // ── Function Declaration ──────────────────────────────────────────────
  private parseFunctionDeclaration(): FunctionDeclarationNode {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name').value;

    // parameters: ( param1: type, param2: type, ... )
    this.consume(TokenType.LPAREN, "Expected '(' after function name");
    const parameters: Array<{ name: string; type: DataType }> = [];
    if (!this.check(TokenType.RPAREN)) {
      const paramName = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
      this.consume(TokenType.COLON, "Expected ':' after parameter name");
      const paramType = this.consumeTypeAnnotation().value as DataType;
      parameters.push({ name: paramName, type: paramType });
      while (this.match(TokenType.COMMA)) {
        const pName = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
        this.consume(TokenType.COLON, "Expected ':' after parameter name");
        const pType = this.consumeTypeAnnotation().value as DataType;
        parameters.push({ name: pName, type: pType });
      }
    }
    this.consume(TokenType.RPAREN, "Expected ')' after parameters");

    // optional return type: : type
    let returnType: DataType = 'auto';
    if (this.match(TokenType.COLON)) {
      const t = this.peek().type;
      if (t === TokenType.KEYWORD_NUMBER) { returnType = 'number'; this.advance(); }
      else if (t === TokenType.KEYWORD_STRING) { returnType = 'string'; this.advance(); }
      else if (t === TokenType.KEYWORD_BOOL) { returnType = 'bool'; this.advance(); }
      else if (t === TokenType.KEYWORD_ARRAY) { returnType = 'array'; this.advance(); }
      else if (t === TokenType.KEYWORD_OBJECT) { returnType = 'object'; this.advance(); }
    }

    // body: { statements }
    const body = this.parseBlockStatement().statements;

    return {
      type: 'FunctionDeclaration',
      name,
      parameters,
      returnType,
      body,
      line: start.line,
      column: start.column,
    };
  }

  // ── Return Statement ──────────────────────────────────────────────────
  private parseReturnStatement(): ReturnStatementNode {
    const start = this.previous();
    let expression: ExpressionNode | null = null;
    if (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE)) {
      expression = this.parseExpression();
    }
    this.consume(TokenType.SEMICOLON, "Expected ';' after return statement");
    return { type: 'Return', expression, line: start.line, column: start.column };
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`[Parser Error] ${message} at line ${this.peek().line}, column ${this.peek().column}`);
  }

  private consumeTypeAnnotation(): Token {
    const t = this.peek().type;
    if (t === TokenType.KEYWORD_NUMBER || t === TokenType.KEYWORD_STRING ||
        t === TokenType.KEYWORD_BOOL || t === TokenType.KEYWORD_ARRAY ||
        t === TokenType.KEYWORD_OBJECT) {
      return this.advance();
    }
    throw new Error(`[Parser Error] Expected type annotation at line ${this.peek().line}, column ${this.peek().column}`);
  }
}
