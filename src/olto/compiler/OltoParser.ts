/**
 * OLTO Frontend Subsystem — Recursive-Descent Parser
 * ==================================================
 * Parses OLTO token streams into strongly-typed AST nodes with
 * comprehensive error reporting and source location tracking.
 */

import { OltoToken, OltoTokenType } from './OltoLexer';
import {
  OltoProgram,
  OltoImport,
  OltoComponent,
  OltoPage,
  OltoParameter,
  OltoStateDeclaration,
  OltoComputedDeclaration,
  OltoWatchDeclaration,
  OltoLifecycleHook,
  OltoActionDeclaration,
  OltoViewBlock,
  OltoUINode,
  OltoElementNode,
  OltoConditionalNode,
  OltoIterationNode,
  OltoSlotNode,
  OltoAttribute,
  OltoHandler,
  OltoStatement,
  OltoVariableStatement,
  OltoAssignmentStatement,
  OltoIfStatement,
  OltoReturnStatement,
  OltoExpressionStatement,
  OltoExpression,
  OltoStringLiteral,
  OltoNumberLiteral,
  OltoBooleanLiteral,
  OltoIdentifier,
  OltoBinaryExpression,
  OltoUnaryExpression,
  OltoCallExpression,
  OltoMemberExpression,
  OltoArrayLiteral,
  OltoTernaryExpression,
  OltoAwaitExpression,
  OltoNamedArgument,
  SourceLocation,
} from './OltoAST';

export class OltoParser {
  private tokens: OltoToken[];
  private current: number = 0;

  constructor(tokens: OltoToken[]) {
    this.tokens = tokens;
  }

  public parse(): OltoProgram {
    const loc = this.currentLocation();
    const imports: OltoImport[] = [];
    const declarations: (OltoComponent | OltoPage)[] = [];

    while (!this.isAtEnd()) {
      if (this.match(OltoTokenType.KEYWORD_IMPORT)) {
        imports.push(this.parseImport());
      } else if (this.match(OltoTokenType.KEYWORD_COMPONENT)) {
        declarations.push(this.parseComponent());
      } else if (this.match(OltoTokenType.KEYWORD_PAGE)) {
        declarations.push(this.parsePage());
      } else {
        const token = this.peek();
        throw new Error(`[OltoParser Error] Unexpected token '${token.value}' at line ${token.line}, column ${token.column}. Expected 'component', 'page', or 'import'.`);
      }
    }

    return {
      kind: 'Program',
      imports,
      declarations,
      loc,
    };
  }

  // ──────────────── Imports ────────────────
  private parseImport(): OltoImport {
    const loc = this.previousLocation();
    this.consume(OltoTokenType.LBRACE, "Expected '{' after 'import'");

    const specifiers: string[] = [];
    while (!this.check(OltoTokenType.RBRACE) && !this.isAtEnd()) {
      const idToken = this.consume(OltoTokenType.IDENTIFIER, "Expected identifier in import list");
      specifiers.push(idToken.value);

      if (!this.check(OltoTokenType.RBRACE)) {
        this.consume(OltoTokenType.COMMA, "Expected ',' between import specifiers");
      }
    }
    this.consume(OltoTokenType.RBRACE, "Expected '}' after import specifiers");
    this.consume(OltoTokenType.KEYWORD_FROM, "Expected 'from' after import specifiers");

    const sourceToken = this.consume(OltoTokenType.LITERAL_STRING, "Expected string module path after 'from'");

    return {
      kind: 'Import',
      specifiers,
      source: sourceToken.value,
      loc,
    };
  }

  // ──────────────── Components & Pages ────────────────
  private parseComponent(): OltoComponent {
    const loc = this.previousLocation();
    const nameToken = this.consume(OltoTokenType.IDENTIFIER, "Expected component name after 'component'");

    let parameters: OltoParameter[] = [];
    if (this.match(OltoTokenType.LPAREN)) {
      parameters = this.parseParameterList();
      this.consume(OltoTokenType.RPAREN, "Expected ')' after parameter list");
    }

    this.consume(OltoTokenType.LBRACE, "Expected '{' before component body");
    const body = this.parseComponentBody();
    this.consume(OltoTokenType.RBRACE, "Expected '}' after component body");

    return {
      kind: 'Component',
      name: nameToken.value,
      parameters,
      state: body.state,
      computed: body.computed,
      watchers: body.watchers,
      hooks: body.hooks,
      actions: body.actions,
      view: body.view,
      loc,
    };
  }

  private parsePage(): OltoPage {
    const loc = this.previousLocation();
    const nameToken = this.consume(OltoTokenType.IDENTIFIER, "Expected page name after 'page'");

    let parameters: OltoParameter[] = [];
    if (this.match(OltoTokenType.LPAREN)) {
      parameters = this.parseParameterList();
      this.consume(OltoTokenType.RPAREN, "Expected ')' after parameter list");
    }

    let route: string | undefined;
    if (this.check(OltoTokenType.IDENTIFIER) && this.peek().value === 'route') {
      this.advance();
      const routeToken = this.consume(OltoTokenType.LITERAL_STRING, "Expected string route path after 'route'");
      route = routeToken.value;
    }

    this.consume(OltoTokenType.LBRACE, "Expected '{' before page body");
    const body = this.parseComponentBody();
    this.consume(OltoTokenType.RBRACE, "Expected '}' after page body");

    return {
      kind: 'Page',
      name: nameToken.value,
      route,
      parameters,
      state: body.state,
      computed: body.computed,
      watchers: body.watchers,
      hooks: body.hooks,
      actions: body.actions,
      view: body.view,
      loc,
    };
  }

  private parseParameterList(): OltoParameter[] {
    const params: OltoParameter[] = [];
    if (this.check(OltoTokenType.RPAREN)) return params;

    do {
      const loc = this.currentLocation();
      const idToken = this.consume(OltoTokenType.IDENTIFIER, "Expected parameter name");
      this.consume(OltoTokenType.OP_COLON, "Expected ':' after parameter name");
      const typeStr = this.parseTypeName();

      let defaultValue: OltoExpression | undefined;
      if (this.match(OltoTokenType.OP_ASSIGN)) {
        defaultValue = this.parseExpression();
      }

      params.push({
        kind: 'Parameter',
        name: idToken.value,
        type: typeStr,
        defaultValue,
        loc,
      });
    } while (this.match(OltoTokenType.COMMA));

    return params;
  }

  private parseTypeName(): string {
    const baseToken = this.consume(OltoTokenType.IDENTIFIER, "Expected type name");
    let fullType = baseToken.value;

    if (this.match(OltoTokenType.OP_LT)) {
      fullType += '<' + this.parseTypeName() + '>';
      this.consume(OltoTokenType.OP_GT, "Expected '>' closing generic type parameter");
    }

    return fullType;
  }

  private parseComponentBody(): {
    state: OltoStateDeclaration[];
    computed: OltoComputedDeclaration[];
    watchers: OltoWatchDeclaration[];
    hooks: OltoLifecycleHook[];
    actions: OltoActionDeclaration[];
    view: OltoViewBlock;
  } {
    const state: OltoStateDeclaration[] = [];
    const computed: OltoComputedDeclaration[] = [];
    const watchers: OltoWatchDeclaration[] = [];
    const hooks: OltoLifecycleHook[] = [];
    const actions: OltoActionDeclaration[] = [];
    let viewBlock: OltoViewBlock | null = null;

    while (!this.check(OltoTokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(OltoTokenType.SEMICOLON)) {
        continue;
      }
      if (this.match(OltoTokenType.KEYWORD_STATE)) {
        state.push(this.parseStateDeclaration());
      } else if (this.match(OltoTokenType.KEYWORD_COMPUTED)) {
        computed.push(this.parseComputedDeclaration());
      } else if (this.match(OltoTokenType.KEYWORD_WATCH)) {
        watchers.push(this.parseWatchDeclaration());
      } else if (this.match(OltoTokenType.KEYWORD_ON_MOUNT)) {
        hooks.push(this.parseLifecycleHook('onMount'));
      } else if (this.match(OltoTokenType.KEYWORD_ON_DESTROY)) {
        hooks.push(this.parseLifecycleHook('onDestroy'));
      } else if (this.match(OltoTokenType.KEYWORD_ACTION)) {
        actions.push(this.parseActionDeclaration(false));
      } else if (this.check(OltoTokenType.KEYWORD_ASYNC) && this.peekAhead(1).type === OltoTokenType.KEYWORD_ACTION) {
        this.advance(); // consume async
        this.advance(); // consume action
        actions.push(this.parseActionDeclaration(true));
      } else if (this.match(OltoTokenType.KEYWORD_VIEW)) {
        if (viewBlock !== null) {
          throw new Error(`[OltoParser Error] Component cannot declare multiple 'view' blocks.`);
        }
        viewBlock = this.parseViewBlock();
      } else {
        const token = this.peek();
        throw new Error(`[OltoParser Error] Unexpected statement '${token.value}' in component body at line ${token.line}, column ${token.column}.`);
      }
    }

    if (!viewBlock) {
      throw new Error(`[OltoParser Error] Component must contain a 'view' declaration.`);
    }

    return { state, computed, watchers, hooks, actions, view: viewBlock };
  }

  // ──────────────── State & Reactivity ────────────────
  private parseStateDeclaration(): OltoStateDeclaration {
    const loc = this.previousLocation();
    const nameToken = this.consume(OltoTokenType.IDENTIFIER, "Expected state variable name");
    this.consume(OltoTokenType.OP_COLON, "Expected ':' after state name");
    const typeStr = this.parseTypeName();
    this.consume(OltoTokenType.OP_ASSIGN, "Expected '=' before initial state value");
    const initialValue = this.parseExpression();
    this.match(OltoTokenType.SEMICOLON);

    return {
      kind: 'StateDeclaration',
      name: nameToken.value,
      type: typeStr,
      initialValue,
      loc,
    };
  }

  private parseComputedDeclaration(): OltoComputedDeclaration {
    const loc = this.previousLocation();
    const nameToken = this.consume(OltoTokenType.IDENTIFIER, "Expected computed property name");
    this.consume(OltoTokenType.OP_COLON, "Expected ':' after computed name");
    const typeStr = this.parseTypeName();
    this.match(OltoTokenType.OP_ASSIGN);
    this.consume(OltoTokenType.LBRACE, "Expected '{' before computed body");
    const body = this.parseBlockStatements();
    this.consume(OltoTokenType.RBRACE, "Expected '}' after computed body");
    this.match(OltoTokenType.SEMICOLON);

    return {
      kind: 'ComputedDeclaration',
      name: nameToken.value,
      type: typeStr,
      body,
      loc,
    };
  }

  private parseWatchDeclaration(): OltoWatchDeclaration {
    const loc = this.previousLocation();
    const targetToken = this.consume(OltoTokenType.IDENTIFIER, "Expected state variable name after 'watch'");
    this.consume(OltoTokenType.LBRACE, "Expected '{' before watch body");
    const body = this.parseBlockStatements();
    this.consume(OltoTokenType.RBRACE, "Expected '}' after watch body");

    return {
      kind: 'WatchDeclaration',
      target: targetToken.value,
      body,
      loc,
    };
  }

  private parseLifecycleHook(hookType: 'onMount' | 'onDestroy'): OltoLifecycleHook {
    const loc = this.previousLocation();
    this.consume(OltoTokenType.LBRACE, `Expected '{' before ${hookType} body`);
    const body = this.parseBlockStatements();
    this.consume(OltoTokenType.RBRACE, `Expected '}' after ${hookType} body`);

    return {
      kind: 'LifecycleHook',
      hookType,
      body,
      loc,
    };
  }

  private parseActionDeclaration(isAsync: boolean): OltoActionDeclaration {
    const loc = this.previousLocation();
    const nameToken = this.consume(OltoTokenType.IDENTIFIER, "Expected action name");

    let parameters: OltoParameter[] = [];
    if (this.match(OltoTokenType.LPAREN)) {
      parameters = this.parseParameterList();
      this.consume(OltoTokenType.RPAREN, "Expected ')' after action parameter list");
    }

    this.consume(OltoTokenType.LBRACE, "Expected '{' before action body");
    const body = this.parseBlockStatements();
    this.consume(OltoTokenType.RBRACE, "Expected '}' after action body");
    this.match(OltoTokenType.SEMICOLON);

    return {
      kind: 'ActionDeclaration',
      name: nameToken.value,
      isAsync,
      parameters,
      body,
      loc,
    };
  }

  // ──────────────── View Block & UI Nodes ────────────────
  private parseViewBlock(): OltoViewBlock {
    const loc = this.previousLocation();
    this.consume(OltoTokenType.LBRACE, "Expected '{' before view block");
    const rootNode = this.parseUINode();
    this.consume(OltoTokenType.RBRACE, "Expected '}' after view block");

    return {
      kind: 'ViewBlock',
      rootNode,
      loc,
    };
  }

  private parseUINode(): OltoUINode {
    if (this.match(OltoTokenType.KEYWORD_IF)) {
      return this.parseConditionalNode();
    }
    if (this.match(OltoTokenType.KEYWORD_EACH)) {
      return this.parseIterationNode();
    }
    if (this.match(OltoTokenType.KEYWORD_SLOT)) {
      return this.parseSlotNode();
    }
    return this.parseElementNode();
  }

  private parseElementNode(): OltoElementNode {
    const loc = this.currentLocation();
    const nameToken = this.consume(OltoTokenType.IDENTIFIER, "Expected element or component name");

    const attributes: OltoAttribute[] = [];
    if (this.match(OltoTokenType.LPAREN)) {
      if (!this.check(OltoTokenType.RPAREN)) {
        do {
          attributes.push(this.parseAttribute());
        } while (this.match(OltoTokenType.COMMA));
      }
      this.consume(OltoTokenType.RPAREN, "Expected ')' after component attributes");
    }

    const children: OltoUINode[] = [];
    if (this.match(OltoTokenType.LBRACE)) {
      while (!this.check(OltoTokenType.RBRACE) && !this.isAtEnd()) {
        children.push(this.parseUINode());
      }
      this.consume(OltoTokenType.RBRACE, "Expected '}' closing element children block");
    }

    return {
      kind: 'ElementNode',
      componentName: nameToken.value,
      attributes,
      children,
      loc,
    };
  }

  private parseAttribute(): OltoAttribute {
    const loc = this.currentLocation();
    let attrName = '';

    // If first token is positional string (e.g. Text("Hello"))
    if (this.check(OltoTokenType.LITERAL_STRING) || this.check(OltoTokenType.LITERAL_NUMBER) || this.check(OltoTokenType.IDENTIFIER)) {
      if (this.peekAhead(1).type === OltoTokenType.OP_COLON) {
        const idToken = this.consume(OltoTokenType.IDENTIFIER, "Expected attribute name");
        attrName = idToken.value;
        this.consume(OltoTokenType.OP_COLON, "Expected ':' after attribute name");
      } else {
        attrName = '_default';
      }
    }

    if (this.match(OltoTokenType.LBRACE)) {
      const handlerLoc = this.previousLocation();
      let parameterName: string | undefined;

      // Check for parameter format: { val in ... }
      if (this.check(OltoTokenType.IDENTIFIER) && this.peekAhead(1).type === OltoTokenType.KEYWORD_IN) {
        parameterName = this.advance().value;
        this.advance(); // consume 'in'
      }

      const body = this.parseBlockStatements();
      this.consume(OltoTokenType.RBRACE, "Expected '}' closing handler block");

      return {
        kind: 'Attribute',
        name: attrName,
        value: {
          kind: 'Handler',
          parameterName,
          body,
          loc: handlerLoc,
        },
        loc,
      };
    }

    const valueExpr = this.parseExpression();
    return {
      kind: 'Attribute',
      name: attrName,
      value: valueExpr,
      loc,
    };
  }

  private parseConditionalNode(): OltoConditionalNode {
    const loc = this.previousLocation();
    const condition = this.parseExpression();

    this.consume(OltoTokenType.LBRACE, "Expected '{' before conditional branch");
    const thenBranch: OltoUINode[] = [];
    while (!this.check(OltoTokenType.RBRACE) && !this.isAtEnd()) {
      thenBranch.push(this.parseUINode());
    }
    this.consume(OltoTokenType.RBRACE, "Expected '}' closing conditional branch");

    let elseBranch: OltoUINode[] | undefined;
    if (this.match(OltoTokenType.KEYWORD_ELSE)) {
      this.consume(OltoTokenType.LBRACE, "Expected '{' before else branch");
      elseBranch = [];
      while (!this.check(OltoTokenType.RBRACE) && !this.isAtEnd()) {
        elseBranch.push(this.parseUINode());
      }
      this.consume(OltoTokenType.RBRACE, "Expected '}' closing else branch");
    }

    return {
      kind: 'ConditionalNode',
      condition,
      thenBranch,
      elseBranch,
      loc,
    };
  }

  private parseIterationNode(): OltoIterationNode {
    const loc = this.previousLocation();
    const itemToken = this.consume(OltoTokenType.IDENTIFIER, "Expected iterator variable name after 'each'");

    let indexName: string | undefined;
    if (this.match(OltoTokenType.COMMA)) {
      const indexToken = this.consume(OltoTokenType.IDENTIFIER, "Expected index variable name after ','");
      indexName = indexToken.value;
    }

    this.consume(OltoTokenType.KEYWORD_IN, "Expected 'in' after iterator variable");
    const iterable = this.parseExpression();

    this.consume(OltoTokenType.LBRACE, "Expected '{' before iteration body");
    const children: OltoUINode[] = [];
    while (!this.check(OltoTokenType.RBRACE) && !this.isAtEnd()) {
      children.push(this.parseUINode());
    }
    this.consume(OltoTokenType.RBRACE, "Expected '}' closing iteration body");

    return {
      kind: 'IterationNode',
      itemName: itemToken.value,
      indexName,
      iterable,
      children,
      loc,
    };
  }

  private parseSlotNode(): OltoSlotNode {
    const loc = this.previousLocation();
    let slotName: string | undefined;
    if (this.check(OltoTokenType.LITERAL_STRING)) {
      slotName = this.advance().value;
    }
    return {
      kind: 'SlotNode',
      name: slotName,
      loc,
    };
  }

  // ──────────────── Statements ────────────────
  private parseBlockStatements(): OltoStatement[] {
    const statements: OltoStatement[] = [];
    while (!this.check(OltoTokenType.RBRACE) && !this.isAtEnd()) {
      statements.push(this.parseStatement());
    }
    return statements;
  }

  private parseStatement(): OltoStatement {
    if (this.match(OltoTokenType.KEYWORD_LET) || this.match(OltoTokenType.KEYWORD_CONST)) {
      return this.parseVariableStatement(this.previous().type === OltoTokenType.KEYWORD_CONST);
    }
    if (this.match(OltoTokenType.KEYWORD_IF)) {
      return this.parseIfStatement();
    }
    if (this.match(OltoTokenType.KEYWORD_RETURN)) {
      return this.parseReturnStatement();
    }

    // Check assignment: identifier = expr | += | -= | *= | /=
    if (this.check(OltoTokenType.IDENTIFIER) && this.isAssignmentOp(this.peekAhead(1).type)) {
      return this.parseAssignmentStatement();
    }

    // Expression statement
    const loc = this.currentLocation();
    const expr = this.parseExpression();
    this.match(OltoTokenType.SEMICOLON); // optional semicolon
    return {
      kind: 'ExpressionStatement',
      expression: expr,
      loc,
    };
  }

  private parseVariableStatement(isConst: boolean): OltoVariableStatement {
    const loc = this.previousLocation();
    const idToken = this.consume(OltoTokenType.IDENTIFIER, "Expected variable name");

    let typeStr: string | undefined;
    if (this.match(OltoTokenType.OP_COLON)) {
      typeStr = this.parseTypeName();
    }

    this.consume(OltoTokenType.OP_ASSIGN, "Expected '=' before variable initializer");
    const initializer = this.parseExpression();
    this.match(OltoTokenType.SEMICOLON);

    return {
      kind: 'VariableStatement',
      isConst,
      name: idToken.value,
      type: typeStr,
      initializer,
      loc,
    };
  }

  private parseAssignmentStatement(): OltoAssignmentStatement {
    const loc = this.currentLocation();
    const targetToken = this.consume(OltoTokenType.IDENTIFIER, "Expected assignment target");
    const opToken = this.advance();
    const valExpr = this.parseExpression();
    this.match(OltoTokenType.SEMICOLON);

    return {
      kind: 'AssignmentStatement',
      target: targetToken.value,
      operator: opToken.value as any,
      value: valExpr,
      loc,
    };
  }

  private parseIfStatement(): OltoIfStatement {
    const loc = this.previousLocation();
    const condition = this.parseExpression();
    this.consume(OltoTokenType.LBRACE, "Expected '{' before then block");
    const thenBlock = this.parseBlockStatements();
    this.consume(OltoTokenType.RBRACE, "Expected '}' closing then block");

    let elseBlock: OltoStatement[] | undefined;
    if (this.match(OltoTokenType.KEYWORD_ELSE)) {
      this.consume(OltoTokenType.LBRACE, "Expected '{' before else block");
      elseBlock = this.parseBlockStatements();
      this.consume(OltoTokenType.RBRACE, "Expected '}' closing else block");
    }

    return {
      kind: 'IfStatement',
      condition,
      thenBlock,
      elseBlock,
      loc,
    };
  }

  private parseReturnStatement(): OltoReturnStatement {
    const loc = this.previousLocation();
    let value: OltoExpression | undefined;
    if (!this.check(OltoTokenType.SEMICOLON) && !this.check(OltoTokenType.RBRACE)) {
      value = this.parseExpression();
    }
    this.match(OltoTokenType.SEMICOLON);

    return {
      kind: 'ReturnStatement',
      value,
      loc,
    };
  }

  private isAssignmentOp(type: OltoTokenType): boolean {
    return (
      type === OltoTokenType.OP_ASSIGN ||
      type === OltoTokenType.OP_PLUS_ASSIGN ||
      type === OltoTokenType.OP_MINUS_ASSIGN ||
      type === OltoTokenType.OP_STAR_ASSIGN ||
      type === OltoTokenType.OP_SLASH_ASSIGN
    );
  }

  // ──────────────── Expressions ────────────────
  private parseExpression(): OltoExpression {
    return this.parseTernary();
  }

  private parseTernary(): OltoExpression {
    const expr = this.parseLogicalOr();

    if (this.match(OltoTokenType.OP_QUESTION)) {
      const loc = this.previousLocation();
      const consequent = this.parseExpression();
      this.consume(OltoTokenType.OP_COLON, "Expected ':' in ternary expression");
      const alternate = this.parseExpression();

      return {
        kind: 'TernaryExpression',
        condition: expr,
        consequent,
        alternate,
        loc,
      };
    }

    return expr;
  }

  private parseLogicalOr(): OltoExpression {
    let expr = this.parseLogicalAnd();

    while (this.match(OltoTokenType.OP_OR)) {
      const loc = this.previousLocation();
      const right = this.parseLogicalAnd();
      expr = {
        kind: 'BinaryExpression',
        operator: '||',
        left: expr,
        right,
        loc,
      };
    }

    return expr;
  }

  private parseLogicalAnd(): OltoExpression {
    let expr = this.parseEquality();

    while (this.match(OltoTokenType.OP_AND)) {
      const loc = this.previousLocation();
      const right = this.parseEquality();
      expr = {
        kind: 'BinaryExpression',
        operator: '&&',
        left: expr,
        right,
        loc,
      };
    }

    return expr;
  }

  private parseEquality(): OltoExpression {
    let expr = this.parseComparison();

    while (this.match(OltoTokenType.OP_EQ) || this.match(OltoTokenType.OP_NEQ)) {
      const loc = this.previousLocation();
      const op = this.previous().value;
      const right = this.parseComparison();
      expr = {
        kind: 'BinaryExpression',
        operator: op,
        left: expr,
        right,
        loc,
      };
    }

    return expr;
  }

  private parseComparison(): OltoExpression {
    let expr = this.parseAddition();

    while (
      this.match(OltoTokenType.OP_LT) ||
      this.match(OltoTokenType.OP_GT) ||
      this.match(OltoTokenType.OP_LTE) ||
      this.match(OltoTokenType.OP_GTE)
    ) {
      const loc = this.previousLocation();
      const op = this.previous().value;
      const right = this.parseAddition();
      expr = {
        kind: 'BinaryExpression',
        operator: op,
        left: expr,
        right,
        loc,
      };
    }

    return expr;
  }

  private parseAddition(): OltoExpression {
    let expr = this.parseMultiplication();

    while (this.match(OltoTokenType.OP_PLUS) || this.match(OltoTokenType.OP_MINUS)) {
      const loc = this.previousLocation();
      const op = this.previous().value;
      const right = this.parseMultiplication();
      expr = {
        kind: 'BinaryExpression',
        operator: op,
        left: expr,
        right,
        loc,
      };
    }

    return expr;
  }

  private parseMultiplication(): OltoExpression {
    let expr = this.parseUnary();

    while (this.match(OltoTokenType.OP_STAR) || this.match(OltoTokenType.OP_SLASH)) {
      const loc = this.previousLocation();
      const op = this.previous().value;
      const right = this.parseUnary();
      expr = {
        kind: 'BinaryExpression',
        operator: op,
        left: expr,
        right,
        loc,
      };
    }

    return expr;
  }

  private parseUnary(): OltoExpression {
    if (this.match(OltoTokenType.OP_NOT) || this.match(OltoTokenType.OP_MINUS) || this.match(OltoTokenType.OP_PLUS)) {
      const loc = this.previousLocation();
      const op = this.previous().value as '!' | '-' | '+';
      const operand = this.parseUnary();
      return {
        kind: 'UnaryExpression',
        operator: op,
        operand,
        loc,
      };
    }

    if (this.match(OltoTokenType.KEYWORD_AWAIT)) {
      const loc = this.previousLocation();
      const argument = this.parseUnary();
      return {
        kind: 'AwaitExpression',
        argument,
        loc,
      };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): OltoExpression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(OltoTokenType.LPAREN)) {
        const loc = this.previousLocation();
        const args: (OltoExpression | OltoNamedArgument)[] = [];
        if (!this.check(OltoTokenType.RPAREN)) {
          do {
            if (this.check(OltoTokenType.IDENTIFIER) && this.peekAhead(1).type === OltoTokenType.OP_COLON) {
              const argLoc = this.currentLocation();
              const nameToken = this.advance();
              this.advance(); // consume ':'
              const valExpr = this.parseExpression();
              args.push({
                kind: 'NamedArgument',
                name: nameToken.value,
                value: valExpr,
                loc: argLoc,
              });
            } else {
              args.push(this.parseExpression());
            }
          } while (this.match(OltoTokenType.COMMA));
        }
        this.consume(OltoTokenType.RPAREN, "Expected ')' after argument list");
        expr = {
          kind: 'CallExpression',
          callee: expr,
          arguments: args,
          loc,
        };
      } else if (this.match(OltoTokenType.OP_DOT)) {
        const loc = this.previousLocation();
        const propToken = this.consume(OltoTokenType.IDENTIFIER, "Expected property identifier after '.'");
        expr = {
          kind: 'MemberExpression',
          object: expr,
          property: propToken.value,
          loc,
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): OltoExpression {
    const loc = this.currentLocation();

    if (this.match(OltoTokenType.LITERAL_NUMBER)) {
      return {
        kind: 'NumberLiteral',
        value: parseFloat(this.previous().value),
        loc,
      };
    }

    if (this.match(OltoTokenType.LITERAL_BOOLEAN)) {
      return {
        kind: 'BooleanLiteral',
        value: this.previous().value === 'true',
        loc,
      };
    }

    if (this.match(OltoTokenType.LITERAL_STRING)) {
      const raw = this.previous().value;
      const hasInterp = raw.includes('\\(');
      return {
        kind: 'StringLiteral',
        value: raw,
        hasInterpolation: hasInterp,
        loc,
      };
    }

    if (this.match(OltoTokenType.IDENTIFIER)) {
      return {
        kind: 'Identifier',
        name: this.previous().value,
        loc,
      };
    }

    if (this.match(OltoTokenType.LBRACKET)) {
      const elements: OltoExpression[] = [];
      if (!this.check(OltoTokenType.RBRACKET)) {
        do {
          elements.push(this.parseExpression());
        } while (this.match(OltoTokenType.COMMA));
      }
      this.consume(OltoTokenType.RBRACKET, "Expected ']' after array elements");
      return {
        kind: 'ArrayLiteral',
        elements,
        loc,
      };
    }

    if (this.match(OltoTokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(OltoTokenType.RPAREN, "Expected ')' after expression");
      return expr;
    }

    const token = this.peek();
    throw new Error(`[OltoParser Error] Expected expression but found '${token.value}' at line ${token.line}, column ${token.column}.`);
  }

  // ──────────────── Helpers ────────────────
  private match(type: OltoTokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: OltoTokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): OltoToken {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === OltoTokenType.EOF;
  }

  private peek(): OltoToken {
    return this.tokens[this.current];
  }

  private peekAhead(n: number): OltoToken {
    return this.tokens[this.current + n] || this.tokens[this.tokens.length - 1];
  }

  private previous(): OltoToken {
    return this.tokens[this.current - 1];
  }

  private consume(type: OltoTokenType, message: string): OltoToken {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw new Error(`[OltoParser Error] ${message} (got '${token.value}' at line ${token.line}, column ${token.column})`);
  }

  private currentLocation(): SourceLocation {
    const t = this.peek();
    return { line: t.line, column: t.column };
  }

  private previousLocation(): SourceLocation {
    const t = this.previous();
    return { line: t.line, column: t.column };
  }
}
