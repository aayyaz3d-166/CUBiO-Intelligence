export enum TokenType {
  // Keywords
  KEYWORD_NODE = 'KEYWORD_NODE',
  KEYWORD_SPACE = 'KEYWORD_SPACE',
  KEYWORD_STREAM = 'KEYWORD_STREAM',
  KEYWORD_ALIGN = 'KEYWORD_ALIGN',
  KEYWORD_CHECKPOINT = 'KEYWORD_CHECKPOINT',
  KEYWORD_FUNNEL = 'KEYWORD_FUNNEL',
  KEYWORD_RSS_MAX = 'KEYWORD_RSS_MAX',
  KEYWORD_LET = 'KEYWORD_LET',
  KEYWORD_CONST = 'KEYWORD_CONST',
  KEYWORD_IF = 'KEYWORD_IF',
  KEYWORD_ELSE = 'KEYWORD_ELSE',
  KEYWORD_WHILE = 'KEYWORD_WHILE',
  KEYWORD_FOR = 'KEYWORD_FOR',
  KEYWORD_BREAK = 'KEYWORD_BREAK',
  KEYWORD_CONTINUE = 'KEYWORD_CONTINUE',
  KEYWORD_OF = 'KEYWORD_OF',
  KEYWORD_NUMBER = 'KEYWORD_NUMBER',   // type annotation
  KEYWORD_STRING = 'KEYWORD_STRING',   // type annotation
  KEYWORD_BOOL = 'KEYWORD_BOOL',       // type annotation
  KEYWORD_ARRAY = 'KEYWORD_ARRAY',     // type annotation
  KEYWORD_OBJECT = 'KEYWORD_OBJECT',   // type annotation
  KEYWORD_TRUE = 'KEYWORD_TRUE',
  KEYWORD_FALSE = 'KEYWORD_FALSE',
  KEYWORD_NULL = 'KEYWORD_NULL',
  KEYWORD_FUNCTION = 'KEYWORD_FUNCTION',
  KEYWORD_RETURN = 'KEYWORD_RETURN',

  // Operators & Symbols
  OP_FUNNEL = 'OP_FUNNEL', // ->
  OP_ALIGN = 'OP_ALIGN',   // =>
  OP_PIPE = 'OP_PIPE',     // |
  OP_ADD = 'OP_ADD',       // +
  OP_SUB = 'OP_SUB',       // -
  OP_MUL = 'OP_MUL',       // *
  OP_DIV = 'OP_DIV',       // /
  OP_MOD = 'OP_MOD',       // %
  OP_EQ = 'OP_EQ',         // ==
  OP_NEQ = 'OP_NEQ',       // !=
  OP_LT = 'OP_LT',         // <
  OP_GT = 'OP_GT',         // >
  OP_LTE = 'OP_LTE',       // <=
  OP_GTE = 'OP_GTE',       // >=
  OP_AND = 'OP_AND',       // &&
  OP_OR = 'OP_OR',         // ||
  OP_NOT = 'OP_NOT',       // !
  ASSIGN = 'ASSIGN',       // =
  COLON = 'COLON',         // :
  SEMICOLON = 'SEMICOLON', // ;
  COMMA = 'COMMA',         // ,
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  LBRACKET = 'LBRACKET',  // [
  RBRACKET = 'RBRACKET',  // ]

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
    stream: TokenType.KEYWORD_STREAM,
    align: TokenType.KEYWORD_ALIGN,
    checkpoint: TokenType.KEYWORD_CHECKPOINT,
    funnel: TokenType.KEYWORD_FUNNEL,
    rss_max: TokenType.KEYWORD_RSS_MAX,
    let: TokenType.KEYWORD_LET,
    const: TokenType.KEYWORD_CONST,
    if: TokenType.KEYWORD_IF,
    else: TokenType.KEYWORD_ELSE,
    while: TokenType.KEYWORD_WHILE,
    for: TokenType.KEYWORD_FOR,
    break: TokenType.KEYWORD_BREAK,
    continue: TokenType.KEYWORD_CONTINUE,
    of: TokenType.KEYWORD_OF,
    function: TokenType.KEYWORD_FUNCTION,
    return: TokenType.KEYWORD_RETURN,
    number: TokenType.KEYWORD_NUMBER,
    string: TokenType.KEYWORD_STRING,
    bool: TokenType.KEYWORD_BOOL,
    array: TokenType.KEYWORD_ARRAY,
    object: TokenType.KEYWORD_OBJECT,
    true: TokenType.KEYWORD_TRUE,
    false: TokenType.KEYWORD_FALSE,
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

      // Two-character operators (check BEFORE single-char)
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

      if (char === '=' && this.source[this.position + 1] === '=') {
        tokens.push(this.createToken(TokenType.OP_EQ, '=='));
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
        case '+':
          tokens.push(this.createToken(TokenType.OP_ADD, '+'));
          this.advance(1);
          continue;
        case '-':
          tokens.push(this.createToken(TokenType.OP_SUB, '-'));
          this.advance(1);
          continue;
        case '*':
          tokens.push(this.createToken(TokenType.OP_MUL, '*'));
          this.advance(1);
          continue;
        case '/':
          tokens.push(this.createToken(TokenType.OP_DIV, '/'));
          this.advance(1);
          continue;
        case '%':
          tokens.push(this.createToken(TokenType.OP_MOD, '%'));
          this.advance(1);
          continue;
        case '=':
          tokens.push(this.createToken(TokenType.ASSIGN, '='));
          this.advance(1);
          continue;
        case '!':
          tokens.push(this.createToken(TokenType.OP_NOT, '!'));
          this.advance(1);
          continue;
        case '<':
          tokens.push(this.createToken(TokenType.OP_LT, '<'));
          this.advance(1);
          continue;
        case '>':
          tokens.push(this.createToken(TokenType.OP_GT, '>'));
          this.advance(1);
          continue;
        case '&':
        case '|':
          // Single & or | — not valid standalone; fall through to error
          break;
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

      // String literals
      if (char === '"') {
        const startCol = this.column;
        let str = '"';
        this.advance(1);
        while (this.position < this.source.length && this.source[this.position] !== '"') {
          const c = this.source[this.position];
          if (c === '\n') {
            throw new Error(`[Lexer Error] Unterminated string literal at line ${this.line}`);
          }
          str += c;
          this.advance(1);
        }
        if (this.position >= this.source.length) {
          throw new Error(`[Lexer Error] Unterminated string literal at line ${this.line}`);
        }
        str += '"';
        this.advance(1); // closing quote
        tokens.push({
          type: TokenType.STRING_LITERAL,
          value: str,
          line: this.line,
          column: startCol,
        });
        continue;
      }

      // Number literals
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(this.source[this.position + 1]))) {
        let numStr = '';
        const startCol = this.column;
        while (
          this.position < this.source.length &&
          (/[0-9.]/.test(this.source[this.position]))
        ) {
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

      // Identifiers & Keywords (including @Space)
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
