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
export var TokenType;
(function (TokenType) {
    // Phase 1 Keywords
    TokenType["SPATIAL"] = "SPATIAL";
    TokenType["GRID"] = "GRID";
    TokenType["CUBE"] = "CUBE";
    TokenType["CELL"] = "CELL";
    TokenType["ENTROPY"] = "ENTROPY";
    TokenType["BIT_AGENT"] = "BIT_AGENT";
    TokenType["WRITE"] = "WRITE";
    TokenType["READ"] = "READ";
    TokenType["CLEAR"] = "CLEAR";
    TokenType["ANALYZE"] = "ANALYZE";
    TokenType["BROADCAST"] = "BROADCAST";
    TokenType["COMPACT"] = "COMPACT";
    TokenType["LET"] = "LET";
    // Phase 2 Keywords
    TokenType["BRANCH_ENTROPY"] = "BRANCH_ENTROPY";
    TokenType["THRESHOLD"] = "THRESHOLD";
    TokenType["SHELL_ALLOC"] = "SHELL_ALLOC";
    TokenType["QUANTIZE"] = "QUANTIZE";
    TokenType["BITS"] = "BITS";
    TokenType["SPATIAL_BARRIER"] = "SPATIAL_BARRIER";
    TokenType["SHELL_RADIUS"] = "SHELL_RADIUS";
    // Phase 3 Keywords
    TokenType["SNAPSHOT_SAVE"] = "SNAPSHOT_SAVE";
    TokenType["SNAPSHOT_LOAD"] = "SNAPSHOT_LOAD";
    TokenType["SNAPSHOT_VERIFY"] = "SNAPSHOT_VERIFY";
    TokenType["SPATIAL_QUERY"] = "SPATIAL_QUERY";
    TokenType["SNAPSHOT_DIFF"] = "SNAPSHOT_DIFF";
    TokenType["QUERY_AGGREGATE"] = "QUERY_AGGREGATE";
    TokenType["ENTROPY_CENTROID"] = "ENTROPY_CENTROID";
    TokenType["QUERY_TYPE"] = "QUERY_TYPE";
    TokenType["R_MIN"] = "R_MIN";
    TokenType["R_MAX"] = "R_MAX";
    TokenType["S_MIN"] = "S_MIN";
    TokenType["S_MAX"] = "S_MAX";
    TokenType["D_MIN"] = "D_MIN";
    TokenType["D_MAX"] = "D_MAX";
    TokenType["KNN_K"] = "KNN_K";
    TokenType["TAGS"] = "TAGS";
    // Literals & Identifiers
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    TokenType["NUMBER"] = "NUMBER";
    TokenType["STRING"] = "STRING";
    // Delimiters & Operators
    TokenType["COLON"] = "COLON";
    TokenType["SEMICOLON"] = "SEMICOLON";
    TokenType["DOT"] = "DOT";
    TokenType["COMMA"] = "COMMA";
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["LBRACKET"] = "LBRACKET";
    TokenType["RBRACKET"] = "RBRACKET";
    TokenType["ASSIGN"] = "ASSIGN";
    TokenType["EOF"] = "EOF";
})(TokenType || (TokenType = {}));
export class Lexer {
    input;
    pos = 0;
    line = 1;
    col = 1;
    static KEYWORDS = {
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
    constructor(input) {
        this.input = input;
    }
    peek() {
        return this.pos < this.input.length ? this.input[this.pos] : '';
    }
    advance() {
        const ch = this.peek();
        this.pos++;
        if (ch === '\n') {
            this.line++;
            this.col = 1;
        }
        else {
            this.col++;
        }
        return ch;
    }
    skipWhitespaceAndComments() {
        while (this.pos < this.input.length) {
            const ch = this.peek();
            if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
                this.advance();
            }
            else if (ch === '/' && this.input[this.pos + 1] === '/') {
                while (this.pos < this.input.length && this.peek() !== '\n') {
                    this.advance();
                }
            }
            else if (ch === '/' && this.input[this.pos + 1] === '*') {
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
            }
            else {
                break;
            }
        }
    }
    tokenize() {
        const tokens = [];
        while (this.pos < this.input.length) {
            this.skipWhitespaceAndComments();
            if (this.pos >= this.input.length)
                break;
            const startLine = this.line;
            const startCol = this.col;
            const ch = this.peek();
            // Punctuation
            if (ch === ':') {
                this.advance();
                tokens.push({ type: TokenType.COLON, value: ':', line: startLine, column: startCol });
            }
            else if (ch === ';') {
                this.advance();
                tokens.push({ type: TokenType.SEMICOLON, value: ';', line: startLine, column: startCol });
            }
            else if (ch === '.') {
                this.advance();
                tokens.push({ type: TokenType.DOT, value: '.', line: startLine, column: startCol });
            }
            else if (ch === ',') {
                this.advance();
                tokens.push({ type: TokenType.COMMA, value: ',', line: startLine, column: startCol });
            }
            else if (ch === '(') {
                this.advance();
                tokens.push({ type: TokenType.LPAREN, value: '(', line: startLine, column: startCol });
            }
            else if (ch === ')') {
                this.advance();
                tokens.push({ type: TokenType.RPAREN, value: ')', line: startLine, column: startCol });
            }
            else if (ch === '[') {
                this.advance();
                tokens.push({ type: TokenType.LBRACKET, value: '[', line: startLine, column: startCol });
            }
            else if (ch === ']') {
                this.advance();
                tokens.push({ type: TokenType.RBRACKET, value: ']', line: startLine, column: startCol });
            }
            else if (ch === '=') {
                this.advance();
                tokens.push({ type: TokenType.ASSIGN, value: '=', line: startLine, column: startCol });
            }
            else if (ch === '"' || ch === "'") {
                const quote = this.advance();
                let strVal = '';
                while (this.pos < this.input.length && this.peek() !== quote) {
                    if (this.peek() === '\\') {
                        this.advance();
                        const esc = this.advance();
                        if (esc === 'n')
                            strVal += '\n';
                        else if (esc === 't')
                            strVal += '\t';
                        else if (esc === 'r')
                            strVal += '\r';
                        else
                            strVal += esc;
                    }
                    else {
                        strVal += this.advance();
                    }
                }
                if (this.peek() === quote) {
                    this.advance();
                }
                tokens.push({ type: TokenType.STRING, value: strVal, line: startLine, column: startCol });
            }
            else if (/[0-9]/.test(ch)) {
                let numStr = '';
                while (this.pos < this.input.length && /[0-9.]/.test(this.peek())) {
                    numStr += this.advance();
                }
                tokens.push({ type: TokenType.NUMBER, value: numStr, line: startLine, column: startCol });
            }
            else if (/[a-zA-Z_]/.test(ch)) {
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
            }
            else {
                throw new Error(`Unexpected character '${ch}' at line ${startLine}, col ${startCol}`);
            }
        }
        tokens.push({ type: TokenType.EOF, value: '', line: this.line, column: this.col });
        return tokens;
    }
}
