import { Token, TokenType } from './oneLexer';

export interface ASTNode {
  type: string;
}

export interface SpatialCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface Grid777Coordinate {
  i: number; // 0..6
  j: number; // 0..6
  k: number; // 0..6
  cellIndex: number; // i + 7j + 49k (0..342)
}

export interface SpatialRange {
  min: number;
  max: number;
}

export interface SpatialSliceNode extends ASTNode {
  type: 'SpatialSlice';
  id?: string;
  xRange: SpatialRange;
  yRange: SpatialRange;
  zRange: SpatialRange;
}

export interface NodeDeclarationNode extends ASTNode {
  type: 'NodeDeclaration';
  id: string;
  coordinate: SpatialCoordinate;
  grid777?: Grid777Coordinate;
  alignments: SpatialCoordinate[];
  checkpoints: string[];
  seals: string[];
  memViewBytes?: number;
}

export interface FunnelDeclarationNode extends ASTNode {
  type: 'FunnelDeclaration';
  id: string;
  sourceNode: string;
  targetNode: string;
  bufferMb: number;
  isGossip?: boolean;
  priority?: number;
}

export interface ChannelDeclarationNode extends ASTNode {
  type: 'ChannelDeclaration';
  id: string;
  sourceNode: string;
  targetNode: string;
  bufferMb: number;
  isGossip: boolean;
  priority: number;
}

export interface SealDeclarationNode extends ASTNode {
  type: 'SealDeclaration';
  targetPath: string;
  scope: string; // 'GLOBAL' or node ID
}

export interface ProgramNode extends ASTNode {
  type: 'Program';
  rssMaxLimitMB: number;
  assertRssLimitMB?: number;
  actuationLock?: boolean;
  nodes: NodeDeclarationNode[];
  funnels: FunnelDeclarationNode[];
  channels: ChannelDeclarationNode[];
  seals: SealDeclarationNode[];
  slices: SpatialSliceNode[];
}

export class OneParser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parse(): ProgramNode {
    let rssMaxLimitMB = 512; // Physical default boundary limit
    let assertRssLimitMB: number | undefined = undefined;
    let actuationLock: boolean | undefined = undefined;

    const nodes: NodeDeclarationNode[] = [];
    const funnels: FunnelDeclarationNode[] = [];
    const channels: ChannelDeclarationNode[] = [];
    const seals: SealDeclarationNode[] = [];
    const slices: SpatialSliceNode[] = [];

    while (!this.isAtEnd()) {
      if (this.match(TokenType.KEYWORD_RSS_MAX)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after rss_max");
        const token = this.consume(TokenType.NUMBER_LITERAL, 'Expected number for rss_max limit');
        rssMaxLimitMB = parseFloat(token.value);
        this.consume(TokenType.SEMICOLON, "Expected ';' after rss_max definition");
      } else if (this.match(TokenType.KEYWORD_ASSERT_RSS)) {
        this.consume(TokenType.LPAREN, "Expected '(' after @assert_rss");
        const token = this.consume(TokenType.NUMBER_LITERAL, 'Expected number for @assert_rss limit in MB');
        assertRssLimitMB = parseFloat(token.value);
        this.consume(TokenType.RPAREN, "Expected ')' after @assert_rss limit");
        this.consume(TokenType.SEMICOLON, "Expected ';' after @assert_rss statement");
      } else if (this.match(TokenType.KEYWORD_ACTUATION_LOCK)) {
        this.consume(TokenType.LPAREN, "Expected '(' after @actuation_lock");
        if (this.match(TokenType.KEYWORD_TRUE)) {
          actuationLock = true;
        } else if (this.match(TokenType.KEYWORD_FALSE)) {
          actuationLock = false;
        } else {
          throw new Error(`[Parser Error] Expected boolean literal true/false inside @actuation_lock`);
        }
        this.consume(TokenType.RPAREN, "Expected ')' after @actuation_lock value");
        this.consume(TokenType.SEMICOLON, "Expected ';' after @actuation_lock statement");
      } else if (this.match(TokenType.KEYWORD_SEAL)) {
        const pathToken = this.consume(TokenType.STRING_LITERAL, 'Expected file path string for seal');
        this.consume(TokenType.SEMICOLON, "Expected ';' after seal statement");
        seals.push({
          type: 'SealDeclaration',
          targetPath: pathToken.value,
          scope: 'GLOBAL',
        });
      } else if (this.match(TokenType.KEYWORD_SLICE)) {
        slices.push(this.parseSpatialSlice());
      } else if (this.check(TokenType.KEYWORD_NODE)) {
        nodes.push(this.parseNodeDeclaration());
      } else if (this.check(TokenType.KEYWORD_FUNNEL)) {
        funnels.push(this.parseFunnelDeclaration());
      } else if (this.check(TokenType.KEYWORD_CHANNEL)) {
        channels.push(this.parseChannelDeclaration());
      } else {
        throw new Error(`[Parser Error] Unexpected token '${this.peek().value}' at line ${this.peek().line}`);
      }
    }

    return {
      type: 'Program',
      rssMaxLimitMB,
      assertRssLimitMB,
      actuationLock,
      nodes,
      funnels,
      channels,
      seals,
      slices,
    };
  }

  private parseNodeDeclaration(): NodeDeclarationNode {
    this.consume(TokenType.KEYWORD_NODE, "Expected 'node'");
    const idToken = this.consume(TokenType.IDENTIFIER, 'Expected node identifier');

    this.consume(TokenType.LBRACE, "Expected '{' to open node body");

    let coordinate: SpatialCoordinate = { x: 0, y: 0, z: 0 };
    let grid777: Grid777Coordinate | undefined = undefined;
    const alignments: SpatialCoordinate[] = [];
    const checkpoints: string[] = [];
    const seals: string[] = [];
    let memViewBytes: number | undefined = undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.KEYWORD_SPACE)) {
        coordinate = this.parseSpatialCoordinate();
        this.consume(TokenType.SEMICOLON, "Expected ';' after @Space statement");
      } else if (this.match(TokenType.KEYWORD_GRID777)) {
        grid777 = this.parseGrid777Coordinate();
        // Convert Grid 7x7x7 discrete indices [0..6] to continuous normalized space [0..1]
        coordinate = {
          x: Math.round((grid777.i / 6.0) * 1e6) / 1e6,
          y: Math.round((grid777.j / 6.0) * 1e6) / 1e6,
          z: Math.round((grid777.k / 6.0) * 1e6) / 1e6,
        };
        this.consume(TokenType.SEMICOLON, "Expected ';' after @Grid777 statement");
      } else if (this.match(TokenType.KEYWORD_MEMVIEW)) {
        this.consume(TokenType.LPAREN, "Expected '(' for @memview");
        const sizeToken = this.consume(TokenType.NUMBER_LITERAL, 'Expected buffer size for @memview in MB');
        memViewBytes = parseFloat(sizeToken.value) * 1024 * 1024;
        this.consume(TokenType.RPAREN, "Expected ')' for @memview");
        this.consume(TokenType.SEMICOLON, "Expected ';' after @memview statement");
      } else if (this.match(TokenType.KEYWORD_ALIGN)) {
        this.consume(TokenType.OP_ALIGN, "Expected '=>' for alignment");
        alignments.push(this.parseSpatialCoordinate());
        this.consume(TokenType.SEMICOLON, "Expected ';' after align statement");
      } else if (this.match(TokenType.KEYWORD_CHECKPOINT)) {
        const cpName = this.consume(TokenType.IDENTIFIER, 'Expected checkpoint identifier').value;
        checkpoints.push(cpName);
        this.consume(TokenType.SEMICOLON, "Expected ';' after checkpoint");
      } else if (this.match(TokenType.KEYWORD_SEAL)) {
        const sealPath = this.consume(TokenType.STRING_LITERAL, 'Expected seal file path string').value;
        seals.push(sealPath);
        this.consume(TokenType.SEMICOLON, "Expected ';' after seal statement");
      } else {
        throw new Error(`[Parser Error] Unknown property '${this.peek().value}' inside node declaration`);
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}' to close node body");

    return {
      type: 'NodeDeclaration',
      id: idToken.value,
      coordinate,
      grid777,
      alignments,
      checkpoints,
      seals,
      memViewBytes,
    };
  }

  private parseFunnelDeclaration(): FunnelDeclarationNode {
    this.consume(TokenType.KEYWORD_FUNNEL, "Expected 'funnel'");
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

    let isGossip = false;
    let priority = 369;

    if (this.match(TokenType.KEYWORD_GOSSIP)) {
      isGossip = true;
      if (this.match(TokenType.LPAREN)) {
        const prioToken = this.consume(TokenType.NUMBER_LITERAL, 'Expected gossip priority number');
        priority = parseInt(prioToken.value, 10);
        this.consume(TokenType.RPAREN, "Expected ')' after gossip priority");
      }
      this.consume(TokenType.SEMICOLON, "Expected ';' after @gossip statement");
    }

    this.consume(TokenType.RBRACE, "Expected '}' to close funnel body");

    return {
      type: 'FunnelDeclaration',
      id: idToken.value,
      sourceNode: src,
      targetNode: tgt,
      bufferMb,
      isGossip,
      priority,
    };
  }

  private parseChannelDeclaration(): ChannelDeclarationNode {
    this.consume(TokenType.KEYWORD_CHANNEL, "Expected 'channel'");
    const idToken = this.consume(TokenType.IDENTIFIER, 'Expected channel identifier');
    this.consume(TokenType.LBRACE, "Expected '{' to open channel body");

    this.consume(TokenType.KEYWORD_STREAM, "Expected 'stream' in channel");
    const src = this.consume(TokenType.IDENTIFIER, 'Expected source node identifier').value;
    this.consume(TokenType.OP_FUNNEL, "Expected '->' operator");
    const tgt = this.consume(TokenType.IDENTIFIER, 'Expected target node identifier').value;

    let bufferMb = 64;
    if (this.match(TokenType.COLON)) {
      const bufToken = this.consume(TokenType.NUMBER_LITERAL, 'Expected buffer size in MB');
      bufferMb = parseFloat(bufToken.value);
    }
    this.consume(TokenType.SEMICOLON, "Expected ';' after stream definition");

    let isGossip = true;
    let priority = 369;

    if (this.match(TokenType.KEYWORD_GOSSIP)) {
      if (this.match(TokenType.LPAREN)) {
        const prioToken = this.consume(TokenType.NUMBER_LITERAL, 'Expected gossip priority number');
        priority = parseInt(prioToken.value, 10);
        this.consume(TokenType.RPAREN, "Expected ')' after gossip priority");
      }
      this.consume(TokenType.SEMICOLON, "Expected ';' after @gossip statement");
    }

    this.consume(TokenType.RBRACE, "Expected '}' to close channel body");

    return {
      type: 'ChannelDeclaration',
      id: idToken.value,
      sourceNode: src,
      targetNode: tgt,
      bufferMb,
      isGossip,
      priority,
    };
  }

  private parseSpatialSlice(): SpatialSliceNode {
    this.consume(TokenType.LPAREN, "Expected '(' after @Slice");
    this.consume(TokenType.LBRACKET, "Expected '[' for slice range definition");

    const xRange = this.parseRange();
    this.consume(TokenType.COMMA, "Expected ',' between X and Y ranges");
    const yRange = this.parseRange();
    this.consume(TokenType.COMMA, "Expected ',' between Y and Z ranges");
    const zRange = this.parseRange();

    this.consume(TokenType.RBRACKET, "Expected ']' closing slice ranges");
    this.consume(TokenType.RPAREN, "Expected ')' after @Slice");
    this.consume(TokenType.SEMICOLON, "Expected ';' after @Slice statement");

    return {
      type: 'SpatialSlice',
      xRange,
      yRange,
      zRange,
    };
  }

  private parseRange(): SpatialRange {
    const minVal = parseFloat(this.consume(TokenType.NUMBER_LITERAL, 'Expected range min number').value);
    this.consume(TokenType.OP_DOTDOT, "Expected '..' range operator");
    const maxVal = parseFloat(this.consume(TokenType.NUMBER_LITERAL, 'Expected range max number').value);
    return { min: minVal, max: maxVal };
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

  private parseGrid777Coordinate(): Grid777Coordinate {
    this.consume(TokenType.LPAREN, "Expected '(' for @Grid777");
    const i = parseInt(this.consume(TokenType.NUMBER_LITERAL, 'Expected I index (0..6)').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    const j = parseInt(this.consume(TokenType.NUMBER_LITERAL, 'Expected J index (0..6)').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    const k = parseInt(this.consume(TokenType.NUMBER_LITERAL, 'Expected K index (0..6)').value, 10);
    this.consume(TokenType.RPAREN, "Expected ')' for @Grid777");

    if (i < 0 || i > 6 || j < 0 || j > 6 || k < 0 || k > 6) {
      throw new Error(`[Parser Error] @Grid777 indices must be within 0..6 discrete lattice. Got (${i}, ${j}, ${k})`);
    }

    const cellIndex = i + 7 * j + 49 * k;
    return { i, j, k, cellIndex };
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
}
