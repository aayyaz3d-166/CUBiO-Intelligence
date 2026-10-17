export enum TokenType {
  // Keywords
  KEYWORD_NODE = 'KEYWORD_NODE',
  KEYWORD_SPACE = 'KEYWORD_SPACE',
  KEYWORD_GRID777 = 'KEYWORD_GRID777',
  KEYWORD_SLICE = 'KEYWORD_SLICE',
  KEYWORD_MEMVIEW = 'KEYWORD_MEMVIEW',
  KEYWORD_STREAM = 'KEYWORD_STREAM',
  KEYWORD_ALIGN = 'KEYWORD_ALIGN',
  KEYWORD_CHECKPOINT = 'KEYWORD_CHECKPOINT',
  KEYWORD_SEAL = 'KEYWORD_SEAL',
  KEYWORD_FUNNEL = 'KEYWORD_FUNNEL',
  KEYWORD_CHANNEL = 'KEYWORD_CHANNEL',
  KEYWORD_GOSSIP = 'KEYWORD_GOSSIP',
  KEYWORD_RSS_MAX = 'KEYWORD_RSS_MAX',
  KEYWORD_ASSERT_RSS = 'KEYWORD_ASSERT_RSS',
  KEYWORD_ACTUATION_LOCK = 'KEYWORD_ACTUATION_LOCK',
  KEYWORD_TRUE = 'KEYWORD_TRUE',
  KEYWORD_FALSE = 'KEYWORD_FALSE',

  // Gate CNL-P26.3-COMPILER Keywords & Types
  KEYWORD_MODULE = 'KEYWORD_MODULE',
  KEYWORD_STRUCT = 'KEYWORD_STRUCT',
  KEYWORD_CONST = 'KEYWORD_CONST',
  KEYWORD_NATIVE = 'KEYWORD_NATIVE',
  KEYWORD_CLASS = 'KEYWORD_CLASS',
  KEYWORD_CONSTRUCTOR = 'KEYWORD_CONSTRUCTOR',
  KEYWORD_METHOD = 'KEYWORD_METHOD',
  KEYWORD_LET = 'KEYWORD_LET',
  KEYWORD_FOR = 'KEYWORD_FOR',
  KEYWORD_IF = 'KEYWORD_IF',
  KEYWORD_ELSE = 'KEYWORD_ELSE',
  KEYWORD_PRIVATE = 'KEYWORD_PRIVATE',
  KEYWORD_PUBLIC = 'KEYWORD_PUBLIC',
  KEYWORD_CAST = 'KEYWORD_CAST',
  KEYWORD_SQRT = 'KEYWORD_SQRT',
  KEYWORD_CLAMP = 'KEYWORD_CLAMP',
  TYPE_INT = 'TYPE_INT',
  TYPE_INT32 = 'TYPE_INT32',
  TYPE_FLOAT32 = 'TYPE_FLOAT32',
  TYPE_BOOL = 'TYPE_BOOL',
  TYPE_VOID = 'TYPE_VOID',

  // Computational Language Keywords
  KEYWORD_FUNCTION = 'KEYWORD_FUNCTION',
  KEYWORD_FN = 'KEYWORD_FN',
  KEYWORD_RETURN = 'KEYWORD_RETURN',
  KEYWORD_WHILE = 'KEYWORD_WHILE',
  KEYWORD_PRINT = 'KEYWORD_PRINT',
  KEYWORD_IMPORT = 'KEYWORD_IMPORT',
  KEYWORD_NULL = 'KEYWORD_NULL',

  // Operators & Symbols
  OP_FUNNEL = 'OP_FUNNEL', // ->
  OP_ALIGN = 'OP_ALIGN',   // =>
  OP_PIPE = 'OP_PIPE',     // |
  OP_DOTDOT = 'OP_DOTDOT', // ..
  EQ = 'EQ',               // ==
  OP_NEQ = 'OP_NEQ',       // !=
  OP_LTE = 'OP_LTE',       // <=
  OP_GTE = 'OP_GTE',       // >=
  OP_AND = 'OP_AND',       // &&
  OP_OR = 'OP_OR',         // ||
  OP_NOT = 'OP_NOT',       // !
  PERCENT = 'PERCENT',     // %
  ASSIGN = 'ASSIGN',       // =
  COLON = 'COLON',         // :
  SEMICOLON = 'SEMICOLON', // ;
  COMMA = 'COMMA',         // ,
  DOT = 'DOT',             // .
  LT = 'LT',               // <
  GT = 'GT',               // >
  PLUS = 'PLUS',           // +
  MINUS = 'MINUS',         // -
  STAR = 'STAR',           // *
  SLASH = 'SLASH',         // /
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]

  // Literals & Identifiers
  IDENTIFIER = 'IDENTIFIER',
  NUMBER_LITERAL = 'NUMBER_LITERAL',
  STRING_LITERAL = 'STRING_LITERAL',

  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class OneLexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  private static KEYWORDS: Record<string, TokenType> = {
    node: TokenType.KEYWORD_NODE,
    '@Space': TokenType.KEYWORD_SPACE,
    '@Grid777': TokenType.KEYWORD_GRID777,
    '@Slice': TokenType.KEYWORD_SLICE,
    '@memview': TokenType.KEYWORD_MEMVIEW,
    stream: TokenType.KEYWORD_STREAM,
    align: TokenType.KEYWORD_ALIGN,
    checkpoint: TokenType.KEYWORD_CHECKPOINT,
    seal: TokenType.KEYWORD_SEAL,
    '@seal': TokenType.KEYWORD_SEAL,
    funnel: TokenType.KEYWORD_FUNNEL,
    channel: TokenType.KEYWORD_CHANNEL,
    '@gossip': TokenType.KEYWORD_GOSSIP,
    rss_max: TokenType.KEYWORD_RSS_MAX,
    '@assert_rss': TokenType.KEYWORD_ASSERT_RSS,
    '@actuation_lock': TokenType.KEYWORD_ACTUATION_LOCK,
    true: TokenType.KEYWORD_TRUE,
    false: TokenType.KEYWORD_FALSE,
    module: TokenType.KEYWORD_MODULE,
    struct: TokenType.KEYWORD_STRUCT,
    const: TokenType.KEYWORD_CONST,
    native: TokenType.KEYWORD_NATIVE,
    class: TokenType.KEYWORD_CLASS,
    constructor: TokenType.KEYWORD_CONSTRUCTOR,
    method: TokenType.KEYWORD_METHOD,
    let: TokenType.KEYWORD_LET,
    for: TokenType.KEYWORD_FOR,
    if: TokenType.KEYWORD_IF,
    else: TokenType.KEYWORD_ELSE,
    private: TokenType.KEYWORD_PRIVATE,
    public: TokenType.KEYWORD_PUBLIC,
    Cast: TokenType.KEYWORD_CAST,
    Sqrt: TokenType.KEYWORD_SQRT,
    Clamp: TokenType.KEYWORD_CLAMP,
    Int: TokenType.TYPE_INT,
    Int32: TokenType.TYPE_INT32,
    Float32: TokenType.TYPE_FLOAT32,
    Bool: TokenType.TYPE_BOOL,
    Void: TokenType.TYPE_VOID,
    function: TokenType.KEYWORD_FUNCTION,
    fn: TokenType.KEYWORD_FN,
    return: TokenType.KEYWORD_RETURN,
    while: TokenType.KEYWORD_WHILE,
    print: TokenType.KEYWORD_PRINT,
    import: TokenType.KEYWORD_IMPORT,
    null: TokenType.KEYWORD_NULL,
  };

  constructor(source: string) {
    this.source = source;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.position < this.source.length) {
      const char = this.source[this.position];

      // Skip whitespace
      if (/\s/.test(char)) {
        if (char === '\n') {
          this.line++;
          this.column = 1;
        } else {
          this.column++;
        }
        this.position++;
        continue;
      }

      // Skip comments
      if (char === '/' && this.source[this.position + 1] === '/') {
        while (this.position < this.source.length && this.source[this.position] !== '\n') {
          this.position++;
        }
        continue;
      }

      // String literals ("...")
      if (char === '"' || char === "'") {
        const quote = char;
        let strVal = '';
        const startCol = this.column;
        this.advance(1); // skip open quote
        while (this.position < this.source.length && this.source[this.position] !== quote) {
          strVal += this.source[this.position];
          this.advance(1);
        }
        if (this.position < this.source.length) {
          this.advance(1); // skip close quote
        }
        tokens.push({
          type: TokenType.STRING_LITERAL,
          value: strVal,
          line: this.line,
          column: startCol,
        });
        continue;
      }

      // Two-character operators
      if (char === '-' && this.source[this.position + 1] === '>') {
        tokens.push(this.createToken(TokenType.OP_FUNNEL, '->'));
        this.advance(2);
        continue;
      }

      if (char === '=' && this.source[this.position + 1] === '>') {
        tokens.push(this.createToken(TokenType.OP_ALIGN, '=>'));
        this.advance(2);
        continue;
      }

      if (char === '.' && this.source[this.position + 1] === '.') {
        tokens.push(this.createToken(TokenType.OP_DOTDOT, '..'));
        this.advance(2);
        continue;
      }

      if (char === '=' && this.source[this.position + 1] === '=') {
        tokens.push(this.createToken(TokenType.EQ, '=='));
        this.advance(2);
        continue;
      }

      if (char === '!' && this.source[this.position + 1] === '=') {
        tokens.push(this.createToken(TokenType.OP_NEQ, '!='));
        this.advance(2);
        continue;
      }

      if (char === '<' && this.source[this.position + 1] === '=') {
        tokens.push(this.createToken(TokenType.OP_LTE, '<='));
        this.advance(2);
        continue;
      }

      if (char === '>' && this.source[this.position + 1] === '=') {
        tokens.push(this.createToken(TokenType.OP_GTE, '>='));
        this.advance(2);
        continue;
      }

      if (char === '&' && this.source[this.position + 1] === '&') {
        tokens.push(this.createToken(TokenType.OP_AND, '&&'));
        this.advance(2);
        continue;
      }

      if (char === '|' && this.source[this.position + 1] === '|') {
        tokens.push(this.createToken(TokenType.OP_OR, '||'));
        this.advance(2);
        continue;
      }

      // Single-character tokens
      switch (char) {
        case '!':
          tokens.push(this.createToken(TokenType.OP_NOT, '!'));
          this.advance(1);
          continue;
        case '%':
          tokens.push(this.createToken(TokenType.PERCENT, '%'));
          this.advance(1);
          continue;
        case '|':
          tokens.push(this.createToken(TokenType.OP_PIPE, '|'));
          this.advance(1);
          continue;
        case '=':
          tokens.push(this.createToken(TokenType.ASSIGN, '='));
          this.advance(1);
          continue;
        case ':':
          tokens.push(this.createToken(TokenType.COLON, ':'));
          this.advance(1);
          continue;
        case ';':
          tokens.push(this.createToken(TokenType.SEMICOLON, ';'));
          this.advance(1);
          continue;
        case ',':
          tokens.push(this.createToken(TokenType.COMMA, ','));
          this.advance(1);
          continue;
        case '.':
          tokens.push(this.createToken(TokenType.DOT, '.'));
          this.advance(1);
          continue;
        case '<':
          tokens.push(this.createToken(TokenType.LT, '<'));
          this.advance(1);
          continue;
        case '>':
          tokens.push(this.createToken(TokenType.GT, '>'));
          this.advance(1);
          continue;
        case '+':
          tokens.push(this.createToken(TokenType.PLUS, '+'));
          this.advance(1);
          continue;
        case '-':
          tokens.push(this.createToken(TokenType.MINUS, '-'));
          this.advance(1);
          continue;
        case '*':
          tokens.push(this.createToken(TokenType.STAR, '*'));
          this.advance(1);
          continue;
        case '/':
          tokens.push(this.createToken(TokenType.SLASH, '/'));
          this.advance(1);
          continue;
        case '(':
          tokens.push(this.createToken(TokenType.LPAREN, '('));
          this.advance(1);
          continue;
        case ')':
          tokens.push(this.createToken(TokenType.RPAREN, ')'));
          this.advance(1);
          continue;
        case '{':
          tokens.push(this.createToken(TokenType.LBRACE, '{'));
          this.advance(1);
          continue;
        case '}':
          tokens.push(this.createToken(TokenType.RBRACE, '}'));
          this.advance(1);
          continue;
        case '[':
          tokens.push(this.createToken(TokenType.LBRACKET, '['));
          this.advance(1);
          continue;
        case ']':
          tokens.push(this.createToken(TokenType.RBRACKET, ']'));
          this.advance(1);
          continue;
      }

      // Number literals
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(this.source[this.position + 1] || ''))) {
        let numStr = '';
        const startCol = this.column;
        while (
          this.position < this.source.length &&
          (/[0-9.]/.test(this.source[this.position])) &&
          !(this.source[this.position] === '.' && this.source[this.position + 1] === '.')
        ) {
          numStr += this.source[this.position];
          this.advance(1);
        }
        if (this.position < this.source.length && /[fF]/.test(this.source[this.position])) {
          numStr += this.source[this.position];
          this.advance(1);
        }
        tokens.push({
          type: TokenType.NUMBER_LITERAL,
          value: numStr,
          line: this.line,
          column: startCol,
        });
        continue;
      }

      // Identifiers & Keywords (including @Space, @Grid777, etc.)
      if (/[a-zA-Z_@]/.test(char)) {
        let identStr = '';
        const startCol = this.column;
        while (
          this.position < this.source.length &&
          /[a-zA-Z0-9_@]/.test(this.source[this.position])
        ) {
          identStr += this.source[this.position];
          this.advance(1);
        }

        const keywordType = OneLexer.KEYWORDS[identStr];
        tokens.push({
          type: keywordType || TokenType.IDENTIFIER,
          value: identStr,
          line: this.line,
          column: startCol,
        });
        continue;
      }

      throw new Error(`[Lexer Error] Unexpected character '${char}' at line ${this.line}, column ${this.column}`);
    }

    tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column,
    });

    return tokens;
  }

  private createToken(type: TokenType, value: string): Token {
    return {
      type,
      value,
      line: this.line,
      column: this.column,
    };
  }

  private advance(count: number): void {
    this.position += count;
    this.column += count;
  }
}
