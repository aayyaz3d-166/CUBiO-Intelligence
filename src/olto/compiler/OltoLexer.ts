/**
 * OLTO Frontend Subsystem — Lexical Analyzer
 * ==========================================
 * Transforms raw `.olto` source code into a clean stream of typed tokens
 * with exact line and column tracking for diagnostic errors.
 */

export enum OltoTokenType {
  // Keywords
  KEYWORD_COMPONENT = 'KEYWORD_COMPONENT',
  KEYWORD_PAGE = 'KEYWORD_PAGE',
  KEYWORD_VIEW = 'KEYWORD_VIEW',
  KEYWORD_LAYOUT = 'KEYWORD_LAYOUT',
  KEYWORD_SLOT = 'KEYWORD_SLOT',
  KEYWORD_STATE = 'KEYWORD_STATE',
  KEYWORD_COMPUTED = 'KEYWORD_COMPUTED',
  KEYWORD_WATCH = 'KEYWORD_WATCH',
  KEYWORD_ACTION = 'KEYWORD_ACTION',
  KEYWORD_ON_MOUNT = 'KEYWORD_ON_MOUNT',
  KEYWORD_ON_DESTROY = 'KEYWORD_ON_DESTROY',
  KEYWORD_IF = 'KEYWORD_IF',
  KEYWORD_ELSE = 'KEYWORD_ELSE',
  KEYWORD_EACH = 'KEYWORD_EACH',
  KEYWORD_IN = 'KEYWORD_IN',
  KEYWORD_MATCH = 'KEYWORD_MATCH',
  KEYWORD_IMPORT = 'KEYWORD_IMPORT',
  KEYWORD_EXPORT = 'KEYWORD_EXPORT',
  KEYWORD_FROM = 'KEYWORD_FROM',
  KEYWORD_AS = 'KEYWORD_AS',
  KEYWORD_RETURN = 'KEYWORD_RETURN',
  KEYWORD_LET = 'KEYWORD_LET',
  KEYWORD_CONST = 'KEYWORD_CONST',
  KEYWORD_AWAIT = 'KEYWORD_AWAIT',
  KEYWORD_ASYNC = 'KEYWORD_ASYNC',

  // Identifiers & Literals
  IDENTIFIER = 'IDENTIFIER',
  LITERAL_NUMBER = 'LITERAL_NUMBER',
  LITERAL_STRING = 'LITERAL_STRING',
  LITERAL_BOOLEAN = 'LITERAL_BOOLEAN',

  // Operators
  OP_ASSIGN = 'OP_ASSIGN',       // =
  OP_PLUS_ASSIGN = 'OP_PLUS_ASSIGN', // +=
  OP_MINUS_ASSIGN = 'OP_MINUS_ASSIGN', // -=
  OP_STAR_ASSIGN = 'OP_STAR_ASSIGN', // *=
  OP_SLASH_ASSIGN = 'OP_SLASH_ASSIGN', // /=
  OP_EQ = 'OP_EQ',               // ==
  OP_NEQ = 'OP_NEQ',             // !=
  OP_LT = 'OP_LT',               // <
  OP_GT = 'OP_GT',               // >
  OP_LTE = 'OP_LTE',             // <=
  OP_GTE = 'OP_GTE',             // >=
  OP_AND = 'OP_AND',             // &&
  OP_OR = 'OP_OR',               // ||
  OP_NOT = 'OP_NOT',             // !
  OP_PLUS = 'OP_PLUS',           // +
  OP_MINUS = 'OP_MINUS',         // -
  OP_STAR = 'OP_STAR',           // *
  OP_SLASH = 'OP_SLASH',         // /
  OP_QUESTION = 'OP_QUESTION',   // ?
  OP_COLON = 'OP_COLON',         // :
  OP_DOT = 'OP_DOT',             // .
  OP_ARROW = 'OP_ARROW',         // =>

  // Delimiters
  LPAREN = 'LPAREN',             // (
  RPAREN = 'RPAREN',             // )
  LBRACE = 'LBRACE',             // {
  RBRACE = 'RBRACE',             // }
  LBRACKET = 'LBRACKET',         // [
  RBRACKET = 'RBRACKET',         // ]
  COMMA = 'COMMA',               // ,
  SEMICOLON = 'SEMICOLON',       // ;

  EOF = 'EOF',
}

export interface OltoToken {
  type: OltoTokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS: Record<string, OltoTokenType> = {
  component: OltoTokenType.KEYWORD_COMPONENT,
  page: OltoTokenType.KEYWORD_PAGE,
  view: OltoTokenType.KEYWORD_VIEW,
  layout: OltoTokenType.KEYWORD_LAYOUT,
  slot: OltoTokenType.KEYWORD_SLOT,
  state: OltoTokenType.KEYWORD_STATE,
  computed: OltoTokenType.KEYWORD_COMPUTED,
  watch: OltoTokenType.KEYWORD_WATCH,
  action: OltoTokenType.KEYWORD_ACTION,
  onMount: OltoTokenType.KEYWORD_ON_MOUNT,
  onDestroy: OltoTokenType.KEYWORD_ON_DESTROY,
  if: OltoTokenType.KEYWORD_IF,
  else: OltoTokenType.KEYWORD_ELSE,
  each: OltoTokenType.KEYWORD_EACH,
  in: OltoTokenType.KEYWORD_IN,
  match: OltoTokenType.KEYWORD_MATCH,
  import: OltoTokenType.KEYWORD_IMPORT,
  export: OltoTokenType.KEYWORD_EXPORT,
  from: OltoTokenType.KEYWORD_FROM,
  as: OltoTokenType.KEYWORD_AS,
  return: OltoTokenType.KEYWORD_RETURN,
  let: OltoTokenType.KEYWORD_LET,
  const: OltoTokenType.KEYWORD_CONST,
  await: OltoTokenType.KEYWORD_AWAIT,
  async: OltoTokenType.KEYWORD_ASYNC,
  true: OltoTokenType.LITERAL_BOOLEAN,
  false: OltoTokenType.LITERAL_BOOLEAN,
};

export class OltoLexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  public tokenize(): OltoToken[] {
    const tokens: OltoToken[] = [];

    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();

      if (this.pos >= this.source.length) break;

      const startLine = this.line;
      const startCol = this.column;
      const ch = this.peek();

      // Numbers
      if (this.isDigit(ch)) {
        tokens.push(this.readNumber(startLine, startCol));
        continue;
      }

      // Identifiers & Keywords
      if (this.isAlpha(ch)) {
        tokens.push(this.readIdentifier(startLine, startCol));
        continue;
      }

      // Strings
      if (ch === '"' || ch === "'") {
        tokens.push(this.readString(startLine, startCol, ch));
        continue;
      }

      // Multi-character Operators
      if (ch === '=' && this.peekAhead(1) === '>') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_ARROW, value: '=>', line: startLine, column: startCol });
        continue;
      }
      if (ch === '=' && this.peekAhead(1) === '=') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_EQ, value: '==', line: startLine, column: startCol });
        continue;
      }
      if (ch === '!' && this.peekAhead(1) === '=') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_NEQ, value: '!=', line: startLine, column: startCol });
        continue;
      }
      if (ch === '<' && this.peekAhead(1) === '=') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_LTE, value: '<=', line: startLine, column: startCol });
        continue;
      }
      if (ch === '>' && this.peekAhead(1) === '=') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_GTE, value: '>=', line: startLine, column: startCol });
        continue;
      }
      if (ch === '+' && this.peekAhead(1) === '=') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_PLUS_ASSIGN, value: '+=', line: startLine, column: startCol });
        continue;
      }
      if (ch === '-' && this.peekAhead(1) === '=') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_MINUS_ASSIGN, value: '-=', line: startLine, column: startCol });
        continue;
      }
      if (ch === '*' && this.peekAhead(1) === '=') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_STAR_ASSIGN, value: '*=', line: startLine, column: startCol });
        continue;
      }
      if (ch === '/' && this.peekAhead(1) === '=') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_SLASH_ASSIGN, value: '/=', line: startLine, column: startCol });
        continue;
      }
      if (ch === '&' && this.peekAhead(1) === '&') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_AND, value: '&&', line: startLine, column: startCol });
        continue;
      }
      if (ch === '|' && this.peekAhead(1) === '|') {
        this.advance(2);
        tokens.push({ type: OltoTokenType.OP_OR, value: '||', line: startLine, column: startCol });
        continue;
      }

      // Single character operators & delimiters
      this.advance(1);
      switch (ch) {
        case '=': tokens.push({ type: OltoTokenType.OP_ASSIGN, value: '=', line: startLine, column: startCol }); break;
        case '<': tokens.push({ type: OltoTokenType.OP_LT, value: '<', line: startLine, column: startCol }); break;
        case '>': tokens.push({ type: OltoTokenType.OP_GT, value: '>', line: startLine, column: startCol }); break;
        case '!': tokens.push({ type: OltoTokenType.OP_NOT, value: '!', line: startLine, column: startCol }); break;
        case '+': tokens.push({ type: OltoTokenType.OP_PLUS, value: '+', line: startLine, column: startCol }); break;
        case '-': tokens.push({ type: OltoTokenType.OP_MINUS, value: '-', line: startLine, column: startCol }); break;
        case '*': tokens.push({ type: OltoTokenType.OP_STAR, value: '*', line: startLine, column: startCol }); break;
        case '/': tokens.push({ type: OltoTokenType.OP_SLASH, value: '/', line: startLine, column: startCol }); break;
        case '?': tokens.push({ type: OltoTokenType.OP_QUESTION, value: '?', line: startLine, column: startCol }); break;
        case ':': tokens.push({ type: OltoTokenType.OP_COLON, value: ':', line: startLine, column: startCol }); break;
        case '.': tokens.push({ type: OltoTokenType.OP_DOT, value: '.', line: startLine, column: startCol }); break;
        case '(': tokens.push({ type: OltoTokenType.LPAREN, value: '(', line: startLine, column: startCol }); break;
        case ')': tokens.push({ type: OltoTokenType.RPAREN, value: ')', line: startLine, column: startCol }); break;
        case '{': tokens.push({ type: OltoTokenType.LBRACE, value: '{', line: startLine, column: startCol }); break;
        case '}': tokens.push({ type: OltoTokenType.RBRACE, value: '}', line: startLine, column: startCol }); break;
        case '[': tokens.push({ type: OltoTokenType.LBRACKET, value: '[', line: startLine, column: startCol }); break;
        case ']': tokens.push({ type: OltoTokenType.RBRACKET, value: ']', line: startLine, column: startCol }); break;
        case ',': tokens.push({ type: OltoTokenType.COMMA, value: ',', line: startLine, column: startCol }); break;
        case ';': tokens.push({ type: OltoTokenType.SEMICOLON, value: ';', line: startLine, column: startCol }); break;
        default:
          throw new Error(`[OltoLexer Error] Unexpected character '${ch}' at line ${startLine}, column ${startCol}`);
      }
    }

    tokens.push({ type: OltoTokenType.EOF, value: '', line: this.line, column: this.column });
    return tokens;
  }

  private peek(): string {
    return this.source[this.pos] || '';
  }

  private peekAhead(n: number): string {
    return this.source[this.pos + n] || '';
  }

  private advance(n: number = 1): void {
    for (let i = 0; i < n; i++) {
      if (this.source[this.pos] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.pos++;
    }
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const ch = this.peek();

      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance(1);
        continue;
      }

      // Single line comments
      if (ch === '/' && this.peekAhead(1) === '/') {
        while (this.pos < this.source.length && this.peek() !== '\n') {
          this.advance(1);
        }
        continue;
      }

      // Block comments
      if (ch === '/' && this.peekAhead(1) === '*') {
        this.advance(2);
        while (this.pos < this.source.length && !(this.peek() === '*' && this.peekAhead(1) === '/')) {
          this.advance(1);
        }
        if (this.pos < this.source.length) {
          this.advance(2); // skip */
        }
        continue;
      }

      break;
    }
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  private readNumber(startLine: number, startCol: number): OltoToken {
    let numStr = '';
    while (this.pos < this.source.length && this.isDigit(this.peek())) {
      numStr += this.peek();
      this.advance(1);
    }

    if (this.peek() === '.' && this.isDigit(this.peekAhead(1))) {
      numStr += '.';
      this.advance(1);
      while (this.pos < this.source.length && this.isDigit(this.peek())) {
        numStr += this.peek();
        this.advance(1);
      }
    }

    return { type: OltoTokenType.LITERAL_NUMBER, value: numStr, line: startLine, column: startCol };
  }

  private readIdentifier(startLine: number, startCol: number): OltoToken {
    let idStr = '';
    while (this.pos < this.source.length && this.isAlphaNumeric(this.peek())) {
      idStr += this.peek();
      this.advance(1);
    }

    const keywordType = KEYWORDS[idStr];
    if (keywordType) {
      return { type: keywordType, value: idStr, line: startLine, column: startCol };
    }

    return { type: OltoTokenType.IDENTIFIER, value: idStr, line: startLine, column: startCol };
  }

  private readString(startLine: number, startCol: number, quote: string): OltoToken {
    this.advance(1); // skip opening quote
    let strVal = '';

    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === '\\' && this.peekAhead(1) === quote) {
        strVal += quote;
        this.advance(2);
      } else if (this.peek() === '\\' && this.peekAhead(1) === 'n') {
        strVal += '\n';
        this.advance(2);
      } else {
        strVal += this.peek();
        this.advance(1);
      }
    }

    if (this.pos < this.source.length && this.peek() === quote) {
      this.advance(1); // skip closing quote
    } else {
      throw new Error(`[OltoLexer Error] Unterminated string literal at line ${startLine}, column ${startCol}`);
    }

    return { type: OltoTokenType.LITERAL_STRING, value: strVal, line: startLine, column: startCol };
  }
}
