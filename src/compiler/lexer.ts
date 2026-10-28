/**
 * ONE Language & CubiO Spatial VM - Phase 2
 * Compiler Frontend: Lexer (lexer.ts)
 *
 * Phase 2 Tokenizer additions:
 * - branch_entropy
 * - threshold
 * - shell_alloc
 * - quantize
 * - bits
 * - spatial_barrier
 * - shellRadius
 */

export enum TokenType {
  // Phase 1 Keywords
  SPATIAL = 'SPATIAL',
  GRID = 'GRID',
  CUBE = 'CUBE',
  CELL = 'CELL',
  ENTROPY = 'ENTROPY',
  BIT_AGENT = 'BIT_AGENT',
  WRITE = 'WRITE',
  READ = 'READ',
  CLEAR = 'CLEAR',
  ANALYZE = 'ANALYZE',
  BROADCAST = 'BROADCAST',
  COMPACT = 'COMPACT',
  LET = 'LET',

  // Phase 2 Keywords
  BRANCH_ENTROPY = 'BRANCH_ENTROPY',
  THRESHOLD = 'THRESHOLD',
  SHELL_ALLOC = 'SHELL_ALLOC',
  QUANTIZE = 'QUANTIZE',
  BITS = 'BITS',
  SPATIAL_BARRIER = 'SPATIAL_BARRIER',
  SHELL_RADIUS = 'SHELL_RADIUS',

  // Phase 3 Keywords
  SNAPSHOT_SAVE = 'SNAPSHOT_SAVE',
  SNAPSHOT_LOAD = 'SNAPSHOT_LOAD',
  SNAPSHOT_VERIFY = 'SNAPSHOT_VERIFY',
  SPATIAL_QUERY = 'SPATIAL_QUERY',
  SNAPSHOT_DIFF = 'SNAPSHOT_DIFF',
  QUERY_AGGREGATE = 'QUERY_AGGREGATE',
  ENTROPY_CENTROID = 'ENTROPY_CENTROID',
  QUERY_TYPE = 'QUERY_TYPE',
  R_MIN = 'R_MIN',
  R_MAX = 'R_MAX',
  S_MIN = 'S_MIN',
  S_MAX = 'S_MAX',
  D_MIN = 'D_MIN',
  D_MAX = 'D_MAX',
  KNN_K = 'KNN_K',
  TAGS = 'TAGS',

  // Literals & Identifiers
  IDENTIFIER = 'IDENTIFIER',
  NUMBER = 'NUMBER',
  STRING = 'STRING',

  // Delimiters & Operators
  COLON = 'COLON',
  SEMICOLON = 'SEMICOLON',
  DOT = 'DOT',
  COMMA = 'COMMA',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  ASSIGN = 'ASSIGN',

  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;

  private static readonly KEYWORDS: Record<string, TokenType> = {
    spatial: TokenType.SPATIAL,
    grid: TokenType.GRID,
    Cube: TokenType.CUBE,
    cell: TokenType.CELL,
    entropy: TokenType.ENTROPY,
    bitAgent: TokenType.BIT_AGENT,
    write: TokenType.WRITE,
    read: TokenType.READ,
    clear: TokenType.CLEAR,
    analyze: TokenType.ANALYZE,
    broadcast: TokenType.BROADCAST,
    compact: TokenType.COMPACT,
    let: TokenType.LET,

    // Phase 2
    branch_entropy: TokenType.BRANCH_ENTROPY,
    threshold: TokenType.THRESHOLD,
    shell_alloc: TokenType.SHELL_ALLOC,
    quantize: TokenType.QUANTIZE,
    bits: TokenType.BITS,
    spatial_barrier: TokenType.SPATIAL_BARRIER,
    shellRadius: TokenType.SHELL_RADIUS,

    // Phase 3
    snapshot_save: TokenType.SNAPSHOT_SAVE,
    snapshot_load: TokenType.SNAPSHOT_LOAD,
    snapshot_verify: TokenType.SNAPSHOT_VERIFY,
    spatial_query: TokenType.SPATIAL_QUERY,
    snapshot_diff: TokenType.SNAPSHOT_DIFF,
    query_aggregate: TokenType.QUERY_AGGREGATE,
    entropy_centroid: TokenType.ENTROPY_CENTROID,
    queryType: TokenType.QUERY_TYPE,
    rMin: TokenType.R_MIN,
    rMax: TokenType.R_MAX,
    sMin: TokenType.S_MIN,
    sMax: TokenType.S_MAX,
    dMin: TokenType.D_MIN,
    dMax: TokenType.D_MAX,
    knnK: TokenType.KNN_K,
    tags: TokenType.TAGS,
  };

  constructor(input: string) {
    this.input = input;
  }

  private peek(): string {
    return this.pos < this.input.length ? this.input[this.pos] : '';
  }

  private advance(): string {
    const ch = this.peek();
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.input.length) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else if (ch === '/' && this.input[this.pos + 1] === '/') {
        while (this.pos < this.input.length && this.peek() !== '\n') {
          this.advance();
        }
      } else if (ch === '/' && this.input[this.pos + 1] === '*') {
        this.advance();
        this.advance();
        while (this.pos < this.input.length) {
          if (this.peek() === '*' && this.input[this.pos + 1] === '/') {
            this.advance();
            this.advance();
            break;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.input.length) break;

      const startLine = this.line;
      const startCol = this.col;
      const ch = this.peek();

      // Punctuation
      if (ch === ':') {
        this.advance();
        tokens.push({ type: TokenType.COLON, value: ':', line: startLine, column: startCol });
      } else if (ch === ';') {
        this.advance();
        tokens.push({ type: TokenType.SEMICOLON, value: ';', line: startLine, column: startCol });
      } else if (ch === '.') {
        this.advance();
        tokens.push({ type: TokenType.DOT, value: '.', line: startLine, column: startCol });
      } else if (ch === ',') {
        this.advance();
        tokens.push({ type: TokenType.COMMA, value: ',', line: startLine, column: startCol });
      } else if (ch === '(') {
        this.advance();
        tokens.push({ type: TokenType.LPAREN, value: '(', line: startLine, column: startCol });
      } else if (ch === ')') {
        this.advance();
        tokens.push({ type: TokenType.RPAREN, value: ')', line: startLine, column: startCol });
      } else if (ch === '[') {
        this.advance();
        tokens.push({ type: TokenType.LBRACKET, value: '[', line: startLine, column: startCol });
      } else if (ch === ']') {
        this.advance();
        tokens.push({ type: TokenType.RBRACKET, value: ']', line: startLine, column: startCol });
      } else if (ch === '=') {
        this.advance();
        tokens.push({ type: TokenType.ASSIGN, value: '=', line: startLine, column: startCol });
      } else if (ch === '"' || ch === "'") {
        const quote = this.advance();
        let strVal = '';
        while (this.pos < this.input.length && this.peek() !== quote) {
          if (this.peek() === '\\') {
            this.advance();
            const esc = this.advance();
            if (esc === 'n') strVal += '\n';
            else if (esc === 't') strVal += '\t';
            else if (esc === 'r') strVal += '\r';
            else strVal += esc;
          } else {
            strVal += this.advance();
          }
        }
        if (this.peek() === quote) {
          this.advance();
        }
        tokens.push({ type: TokenType.STRING, value: strVal, line: startLine, column: startCol });
      } else if (/[0-9]/.test(ch)) {
        let numStr = '';
        while (this.pos < this.input.length && /[0-9.]/.test(this.peek())) {
          numStr += this.advance();
        }
        tokens.push({ type: TokenType.NUMBER, value: numStr, line: startLine, column: startCol });
      } else if (/[a-zA-Z_]/.test(ch)) {
        let ident = '';
        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.peek())) {
          ident += this.advance();
        }
        const kwType = Lexer.KEYWORDS[ident];
        tokens.push({
          type: kwType ?? TokenType.IDENTIFIER,
          value: ident,
          line: startLine,
          column: startCol,
        });
      } else {
        throw new Error(`Unexpected character '${ch}' at line ${startLine}, col ${startCol}`);
      }
    }

    tokens.push({ type: TokenType.EOF, value: '', line: this.line, column: this.col });
    return tokens;
  }
}
