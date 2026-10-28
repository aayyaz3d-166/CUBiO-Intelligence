export var TokenType;
(function (TokenType) {
    // Keywords
    TokenType["KEYWORD_NODE"] = "KEYWORD_NODE";
    TokenType["KEYWORD_SPACE"] = "KEYWORD_SPACE";
    TokenType["KEYWORD_GRID777"] = "KEYWORD_GRID777";
    TokenType["KEYWORD_SLICE"] = "KEYWORD_SLICE";
    TokenType["KEYWORD_MEMVIEW"] = "KEYWORD_MEMVIEW";
    TokenType["KEYWORD_STREAM"] = "KEYWORD_STREAM";
    TokenType["KEYWORD_ALIGN"] = "KEYWORD_ALIGN";
    TokenType["KEYWORD_CHECKPOINT"] = "KEYWORD_CHECKPOINT";
    TokenType["KEYWORD_SEAL"] = "KEYWORD_SEAL";
    TokenType["KEYWORD_FUNNEL"] = "KEYWORD_FUNNEL";
    TokenType["KEYWORD_CHANNEL"] = "KEYWORD_CHANNEL";
    TokenType["KEYWORD_GOSSIP"] = "KEYWORD_GOSSIP";
    TokenType["KEYWORD_RSS_MAX"] = "KEYWORD_RSS_MAX";
    TokenType["KEYWORD_ASSERT_RSS"] = "KEYWORD_ASSERT_RSS";
    TokenType["KEYWORD_ACTUATION_LOCK"] = "KEYWORD_ACTUATION_LOCK";
    TokenType["KEYWORD_TRUE"] = "KEYWORD_TRUE";
    TokenType["KEYWORD_FALSE"] = "KEYWORD_FALSE";
    // Gate CNL-P26.3-COMPILER Keywords & Types
    TokenType["KEYWORD_MODULE"] = "KEYWORD_MODULE";
    TokenType["KEYWORD_STRUCT"] = "KEYWORD_STRUCT";
    TokenType["KEYWORD_ENUM"] = "KEYWORD_ENUM";
    TokenType["KEYWORD_CONST"] = "KEYWORD_CONST";
    TokenType["KEYWORD_NATIVE"] = "KEYWORD_NATIVE";
    TokenType["KEYWORD_CLASS"] = "KEYWORD_CLASS";
    TokenType["KEYWORD_CONSTRUCTOR"] = "KEYWORD_CONSTRUCTOR";
    TokenType["KEYWORD_METHOD"] = "KEYWORD_METHOD";
    TokenType["KEYWORD_LET"] = "KEYWORD_LET";
    TokenType["KEYWORD_FOR"] = "KEYWORD_FOR";
    TokenType["KEYWORD_IF"] = "KEYWORD_IF";
    TokenType["KEYWORD_ELSE"] = "KEYWORD_ELSE";
    TokenType["KEYWORD_PRIVATE"] = "KEYWORD_PRIVATE";
    TokenType["KEYWORD_PUBLIC"] = "KEYWORD_PUBLIC";
    TokenType["KEYWORD_CAST"] = "KEYWORD_CAST";
    TokenType["KEYWORD_SQRT"] = "KEYWORD_SQRT";
    TokenType["KEYWORD_CLAMP"] = "KEYWORD_CLAMP";
    TokenType["TYPE_INT"] = "TYPE_INT";
    TokenType["TYPE_INT32"] = "TYPE_INT32";
    TokenType["TYPE_FLOAT32"] = "TYPE_FLOAT32";
    TokenType["TYPE_BOOL"] = "TYPE_BOOL";
    TokenType["TYPE_VOID"] = "TYPE_VOID";
    // Computational Language Keywords
    TokenType["KEYWORD_FUNCTION"] = "KEYWORD_FUNCTION";
    TokenType["KEYWORD_FN"] = "KEYWORD_FN";
    TokenType["KEYWORD_RETURN"] = "KEYWORD_RETURN";
    TokenType["KEYWORD_WHILE"] = "KEYWORD_WHILE";
    TokenType["KEYWORD_PRINT"] = "KEYWORD_PRINT";
    TokenType["KEYWORD_IMPORT"] = "KEYWORD_IMPORT";
    TokenType["KEYWORD_EXPORT"] = "KEYWORD_EXPORT";
    TokenType["KEYWORD_FROM"] = "KEYWORD_FROM";
    TokenType["KEYWORD_AS"] = "KEYWORD_AS";
    TokenType["KEYWORD_NULL"] = "KEYWORD_NULL";
    TokenType["KEYWORD_ASYNC"] = "KEYWORD_ASYNC";
    TokenType["KEYWORD_AWAIT"] = "KEYWORD_AWAIT";
    // v1.0.1 Simple Command Syntax Keywords
    TokenType["KEYWORD_ONE"] = "KEYWORD_ONE";
    TokenType["KEYWORD_ONES"] = "KEYWORD_ONES";
    TokenType["KEYWORD_OUT"] = "KEYWORD_OUT";
    TokenType["KEYWORD_IN"] = "KEYWORD_IN";
    TokenType["KEYWORD_UP"] = "KEYWORD_UP";
    TokenType["KEYWORD_DOWN"] = "KEYWORD_DOWN";
    TokenType["KEYWORD_REPEAT"] = "KEYWORD_REPEAT";
    TokenType["KEYWORD_STOP"] = "KEYWORD_STOP";
    TokenType["KEYWORD_MAKE"] = "KEYWORD_MAKE";
    TokenType["KEYWORD_WAY"] = "KEYWORD_WAY";
    TokenType["KEYWORD_DONE"] = "KEYWORD_DONE";
    TokenType["KEYWORD_SET"] = "KEYWORD_SET";
    TokenType["KEYWORD_IS"] = "KEYWORD_IS";
    TokenType["KEYWORD_BY"] = "KEYWORD_BY";
    // Operators & Symbols
    TokenType["OP_FUNNEL"] = "OP_FUNNEL";
    TokenType["OP_ALIGN"] = "OP_ALIGN";
    TokenType["OP_PIPE"] = "OP_PIPE";
    TokenType["OP_DOTDOT"] = "OP_DOTDOT";
    TokenType["EQ"] = "EQ";
    TokenType["OP_NEQ"] = "OP_NEQ";
    TokenType["OP_LTE"] = "OP_LTE";
    TokenType["OP_GTE"] = "OP_GTE";
    TokenType["OP_AND"] = "OP_AND";
    TokenType["OP_OR"] = "OP_OR";
    TokenType["OP_NOT"] = "OP_NOT";
    TokenType["PERCENT"] = "PERCENT";
    TokenType["ASSIGN"] = "ASSIGN";
    TokenType["COLON"] = "COLON";
    TokenType["SEMICOLON"] = "SEMICOLON";
    TokenType["COMMA"] = "COMMA";
    TokenType["DOT"] = "DOT";
    TokenType["LT"] = "LT";
    TokenType["GT"] = "GT";
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["STAR"] = "STAR";
    TokenType["SLASH"] = "SLASH";
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["LBRACE"] = "LBRACE";
    TokenType["RBRACE"] = "RBRACE";
    TokenType["LBRACKET"] = "LBRACKET";
    TokenType["RBRACKET"] = "RBRACKET";
    // Literals & Identifiers
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    TokenType["NUMBER_LITERAL"] = "NUMBER_LITERAL";
    TokenType["STRING_LITERAL"] = "STRING_LITERAL";
    // Special
    TokenType["EOF"] = "EOF";
})(TokenType || (TokenType = {}));
export class OneLexer {
    source;
    position = 0;
    line = 1;
    column = 1;
    static KEYWORDS = {
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
        enum: TokenType.KEYWORD_ENUM,
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
        export: TokenType.KEYWORD_EXPORT,
        from: TokenType.KEYWORD_FROM,
        as: TokenType.KEYWORD_AS,
        null: TokenType.KEYWORD_NULL,
        async: TokenType.KEYWORD_ASYNC,
        await: TokenType.KEYWORD_AWAIT,
        // v1.0.1 Simple Command Syntax Keywords
        one: TokenType.KEYWORD_ONE,
        "one's": TokenType.KEYWORD_ONES,
        out: TokenType.KEYWORD_OUT,
        in: TokenType.KEYWORD_IN,
        up: TokenType.KEYWORD_UP,
        down: TokenType.KEYWORD_DOWN,
        repeat: TokenType.KEYWORD_REPEAT,
        stop: TokenType.KEYWORD_STOP,
        make: TokenType.KEYWORD_MAKE,
        way: TokenType.KEYWORD_WAY,
        done: TokenType.KEYWORD_DONE,
        set: TokenType.KEYWORD_SET,
        is: TokenType.KEYWORD_IS,
        by: TokenType.KEYWORD_BY,
    };
    constructor(source) {
        this.source = source;
    }
    tokenize() {
        const tokens = [];
        while (this.position < this.source.length) {
            const char = this.source[this.position];
            // Skip whitespace
            if (/\s/.test(char)) {
                if (char === '\n') {
                    this.line++;
                    this.column = 1;
                }
                else {
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
                    if (this.source[this.position] === '\\' && this.position + 1 < this.source.length) {
                        this.advance(1); // skip backslash
                        strVal += this.source[this.position];
                        this.advance(1);
                        continue;
                    }
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
                while (this.position < this.source.length &&
                    (/[0-9.]/.test(this.source[this.position])) &&
                    !(this.source[this.position] === '.' && this.source[this.position + 1] === '.')) {
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
                while (this.position < this.source.length &&
                    /[a-zA-Z0-9_@]/.test(this.source[this.position])) {
                    identStr += this.source[this.position];
                    this.advance(1);
                }
                // Special check for one's without breaking single-quoted strings
                if (identStr === 'one' &&
                    this.source[this.position] === "'" &&
                    this.source[this.position + 1] === 's' &&
                    (this.position + 2 >= this.source.length || !/[a-zA-Z0-9_]/.test(this.source[this.position + 2]))) {
                    identStr += "'s";
                    this.advance(2);
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
    createToken(type, value) {
        return {
            type,
            value,
            line: this.line,
            column: this.column,
        };
    }
    advance(count) {
        this.position += count;
        this.column += count;
    }
}
