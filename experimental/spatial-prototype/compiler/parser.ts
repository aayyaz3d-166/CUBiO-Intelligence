/**
 * ONE Language & CubiO Spatial VM - Phase 2
 * Compiler Frontend: Parser & AST (parser.ts)
 *
 * Phase 2 Syntax Constructs:
 * - branch_entropy(stream, threshold = 1.0, lowLabel, highLabel);
 * - shell_alloc(stream, targetReg);
 * - quantize(stream, bits = 4);
 * - spatial_barrier(shellRadius = 3);
 */

import { Token, TokenType } from './lexer';

export type ASTNode =
  | ProgramNode
  | SpatialGridDeclNode
  | CellWriteNode
  | CellReadNode
  | CellClearNode
  | EntropyAnalyzeNode
  | BitAnalyzeNode
  | BroadcastNode
  | CompactNode
  | VariableDeclNode
  // Phase 2 Nodes
  | BranchEntropyNode
  | ShellAllocNode
  | QuantizeNode
  | SpatialBarrierNode
  // Phase 3 Nodes
  | SnapshotSaveNode
  | SnapshotLoadNode
  | SnapshotVerifyNode
  | SpatialQueryNode
  | SnapshotDiffNode
  | QueryAggregateNode
  | EntropyCentroidNode;

export interface ProgramNode {
  type: 'Program';
  body: ASTNode[];
}

export interface SpatialGridDeclNode {
  type: 'SpatialGridDecl';
  dimX: number;
  dimY: number;
  dimZ: number;
}

export interface CellWriteNode {
  type: 'CellWrite';
  x: number;
  y: number;
  z: number;
  data: string | number;
}

export interface CellReadNode {
  type: 'CellRead';
  x: number;
  y: number;
  z: number;
  targetVar?: string;
}

export interface CellClearNode {
  type: 'CellClear';
  x: number;
  y: number;
  z: number;
}

export interface EntropyAnalyzeNode {
  type: 'EntropyAnalyze';
  stream: string;
}

export interface BitAnalyzeNode {
  type: 'BitAnalyze';
  stream: string;
}

export interface BroadcastNode {
  type: 'Broadcast';
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
  data: string | number;
}

export interface CompactNode {
  type: 'Compact';
}

export interface VariableDeclNode {
  type: 'VariableDecl';
  name: string;
  value: string | number;
}

// Phase 2 AST Nodes
export interface BranchEntropyNode {
  type: 'BranchEntropy';
  stream: string;
  threshold: number;
  lowLabel?: string;
  highLabel?: string;
}

export interface ShellAllocNode {
  type: 'ShellAlloc';
  stream: string;
  targetReg?: string;
  shellRadius?: number;
}

export interface QuantizeNode {
  type: 'Quantize';
  stream: string;
  bits: 2 | 4 | 8;
  targetReg?: string;
}

export interface SpatialBarrierNode {
  type: 'SpatialBarrier';
  shellRadius?: number;
}

// Phase 3 AST Nodes
export interface SnapshotSaveNode {
  type: 'SnapshotSave';
  destReg?: string;
}

export interface SnapshotLoadNode {
  type: 'SnapshotLoad';
  sourceReg?: string;
}

export interface SnapshotVerifyNode {
  type: 'SnapshotVerify';
  sourceReg?: string;
}

export interface SpatialQueryNode {
  type: 'SpatialQuery';
  queryType: 'shell' | 'entropy' | 'density' | 'tag' | 'knn';
  rMin?: number;
  rMax?: number;
  sMin?: number;
  sMax?: number;
  dMin?: number;
  dMax?: number;
  tags?: string[];
  knnK?: number;
  destReg?: string;
}

export interface SnapshotDiffNode {
  type: 'SnapshotDiff';
  sourceReg?: string;
  destReg?: string;
}

export interface QueryAggregateNode {
  type: 'QueryAggregate';
  destReg?: string;
}

export interface EntropyCentroidNode {
  type: 'EntropyCentroid';
  destReg?: string;
}

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private match(...types: TokenType[]): boolean {
    for (const t of types) {
      if (this.check(t)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, errMsg: string): Token {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw new Error(`${errMsg} at line ${token.line}, col ${token.column}. Found '${token.value}'`);
  }

  public parse(): ProgramNode {
    const statements: ASTNode[] = [];
    while (!this.isAtEnd()) {
      statements.push(this.statement());
    }
    return {
      type: 'Program',
      body: statements,
    };
  }

  private statement(): ASTNode {
    if (this.match(TokenType.SPATIAL)) {
      return this.spatialGridDecl();
    }
    if (this.match(TokenType.CELL)) {
      return this.cellStatement();
    }
    if (this.match(TokenType.ENTROPY)) {
      return this.entropyStatement();
    }
    if (this.match(TokenType.BIT_AGENT)) {
      return this.bitAgentStatement();
    }
    if (this.match(TokenType.BROADCAST)) {
      return this.broadcastStatement();
    }
    if (this.match(TokenType.COMPACT)) {
      this.consume(TokenType.LPAREN, "Expected '(' after compact");
      this.consume(TokenType.RPAREN, "Expected ')' after compact(");
      this.consume(TokenType.SEMICOLON, "Expected ';' after compact()");
      return { type: 'Compact' };
    }
    if (this.match(TokenType.LET)) {
      return this.variableDecl();
    }

    // Phase 2 Statements
    if (this.match(TokenType.BRANCH_ENTROPY)) {
      return this.branchEntropyStatement();
    }
    if (this.match(TokenType.SHELL_ALLOC)) {
      return this.shellAllocStatement();
    }
    if (this.match(TokenType.QUANTIZE)) {
      return this.quantizeStatement();
    }
    if (this.match(TokenType.SPATIAL_BARRIER)) {
      return this.spatialBarrierStatement();
    }

    // Phase 3 Statements
    if (this.match(TokenType.SNAPSHOT_SAVE)) {
      return this.snapshotSaveStatement();
    }
    if (this.match(TokenType.SNAPSHOT_LOAD)) {
      return this.snapshotLoadStatement();
    }
    if (this.match(TokenType.SNAPSHOT_VERIFY)) {
      return this.snapshotVerifyStatement();
    }
    if (this.match(TokenType.SPATIAL_QUERY)) {
      return this.spatialQueryStatement();
    }
    if (this.match(TokenType.SNAPSHOT_DIFF)) {
      return this.snapshotDiffStatement();
    }
    if (this.match(TokenType.QUERY_AGGREGATE)) {
      return this.queryAggregateStatement();
    }
    if (this.match(TokenType.ENTROPY_CENTROID)) {
      return this.entropyCentroidStatement();
    }

    const t = this.peek();
    throw new Error(`Unexpected token '${t.value}' in statement at line ${t.line}, col ${t.column}`);
  }

  // branch_entropy(stream, threshold = 1.0, lowLabel, highLabel);
  private branchEntropyStatement(): BranchEntropyNode {
    this.consume(TokenType.LPAREN, "Expected '(' after branch_entropy");
    let stream = this.consumeIdentifierOrString('Expected stream argument');

    let threshold = 1.0;
    let lowLabel: string | undefined;
    let highLabel: string | undefined;

    if (this.match(TokenType.COMMA)) {
      // Optional: threshold = 1.0 OR just 1.0
      if (this.match(TokenType.THRESHOLD)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after threshold");
      }
      threshold = parseFloat(this.consume(TokenType.NUMBER, 'Expected threshold number').value);

      if (this.match(TokenType.COMMA)) {
        lowLabel = this.consume(TokenType.IDENTIFIER, 'Expected lowLabel').value;
        if (this.match(TokenType.COMMA)) {
          highLabel = this.consume(TokenType.IDENTIFIER, 'Expected highLabel').value;
        }
      }
    }

    this.consume(TokenType.RPAREN, "Expected ')' after branch_entropy args");
    this.consume(TokenType.SEMICOLON, "Expected ';' after branch_entropy statement");

    return {
      type: 'BranchEntropy',
      stream,
      threshold,
      lowLabel,
      highLabel,
    };
  }

  // shell_alloc(stream, targetReg);
  private shellAllocStatement(): ShellAllocNode {
    this.consume(TokenType.LPAREN, "Expected '(' after shell_alloc");
    let stream = this.consumeIdentifierOrString('Expected stream argument');
    let targetReg: string | undefined;

    if (this.match(TokenType.COMMA)) {
      targetReg = this.consume(TokenType.IDENTIFIER, 'Expected target register identifier').value;
    }

    this.consume(TokenType.RPAREN, "Expected ')' after shell_alloc args");
    this.consume(TokenType.SEMICOLON, "Expected ';' after shell_alloc statement");

    return {
      type: 'ShellAlloc',
      stream,
      targetReg,
    };
  }

  // quantize(stream, bits = 4);
  private quantizeStatement(): QuantizeNode {
    this.consume(TokenType.LPAREN, "Expected '(' after quantize");
    let stream = this.consumeIdentifierOrString('Expected stream argument');
    let bits: 2 | 4 | 8 = 4;
    let targetReg: string | undefined;

    if (this.match(TokenType.COMMA)) {
      if (this.match(TokenType.BITS)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after bits");
      }
      const numBits = parseInt(this.consume(TokenType.NUMBER, 'Expected bits number (2, 4, 8)').value, 10);
      if (numBits !== 2 && numBits !== 4 && numBits !== 8) {
        throw new Error(`Invalid quantization bits: ${numBits}. Supported: 2, 4, 8`);
      }
      bits = numBits;

      if (this.match(TokenType.COMMA)) {
        targetReg = this.consume(TokenType.IDENTIFIER, 'Expected targetReg').value;
      }
    }

    this.consume(TokenType.RPAREN, "Expected ')' after quantize args");
    this.consume(TokenType.SEMICOLON, "Expected ';' after quantize statement");

    return {
      type: 'Quantize',
      stream,
      bits,
      targetReg,
    };
  }

  // spatial_barrier(shellRadius = 3);
  private spatialBarrierStatement(): SpatialBarrierNode {
    this.consume(TokenType.LPAREN, "Expected '(' after spatial_barrier");
    let shellRadius: number | undefined;

    if (this.match(TokenType.SHELL_RADIUS)) {
      this.consume(TokenType.ASSIGN, "Expected '=' after shellRadius");
      shellRadius = parseInt(this.consume(TokenType.NUMBER, 'Expected shellRadius number').value, 10);
    } else if (this.match(TokenType.NUMBER)) {
      shellRadius = parseInt(this.previous().value, 10);
    }

    this.consume(TokenType.RPAREN, "Expected ')' after spatial_barrier args");
    this.consume(TokenType.SEMICOLON, "Expected ';' after spatial_barrier statement");

    return {
      type: 'SpatialBarrier',
      shellRadius,
    };
  }

  private consumeIdentifierOrString(errMsg: string): string {
    if (this.match(TokenType.STRING, TokenType.IDENTIFIER)) {
      return this.previous().value;
    }
    throw new Error(`${errMsg} at line ${this.peek().line}`);
  }

  // spatial grid: Cube(7, 7, 7);
  private spatialGridDecl(): SpatialGridDeclNode {
    this.consume(TokenType.GRID, "Expected 'grid' after 'spatial'");
    this.consume(TokenType.COLON, "Expected ':' after 'spatial grid'");
    this.consume(TokenType.CUBE, "Expected 'Cube' declaration");
    this.consume(TokenType.LPAREN, "Expected '(' after Cube");
    const dimX = parseInt(this.consume(TokenType.NUMBER, 'Expected dimension X').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    const dimY = parseInt(this.consume(TokenType.NUMBER, 'Expected dimension Y').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    const dimZ = parseInt(this.consume(TokenType.NUMBER, 'Expected dimension Z').value, 10);
    this.consume(TokenType.RPAREN, "Expected ')' after dimensions");
    this.consume(TokenType.SEMICOLON, "Expected ';' after spatial grid declaration");

    return {
      type: 'SpatialGridDecl',
      dimX,
      dimY,
      dimZ,
    };
  }

  // cell[x, y, z].write(data); OR cell[x, y, z].read(); OR cell[x, y, z].clear();
  private cellStatement(): CellWriteNode | CellReadNode | CellClearNode {
    this.consume(TokenType.LBRACKET, "Expected '[' after 'cell'");
    const x = parseInt(this.consume(TokenType.NUMBER, 'Expected coordinate X').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    const y = parseInt(this.consume(TokenType.NUMBER, 'Expected coordinate Y').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    const z = parseInt(this.consume(TokenType.NUMBER, 'Expected coordinate Z').value, 10);
    this.consume(TokenType.RBRACKET, "Expected ']' after coordinates");
    this.consume(TokenType.DOT, "Expected '.' after cell[...]");

    if (this.match(TokenType.WRITE)) {
      this.consume(TokenType.LPAREN, "Expected '(' after 'write'");
      let data: string | number;
      if (this.match(TokenType.STRING)) {
        data = this.previous().value;
      } else if (this.match(TokenType.NUMBER)) {
        data = parseFloat(this.previous().value);
      } else if (this.match(TokenType.IDENTIFIER)) {
        data = this.previous().value;
      } else {
        throw new Error(`Expected argument for write() at line ${this.peek().line}`);
      }
      this.consume(TokenType.RPAREN, "Expected ')' after write argument");
      this.consume(TokenType.SEMICOLON, "Expected ';' after cell write statement");
      return { type: 'CellWrite', x, y, z, data };
    }

    if (this.match(TokenType.READ)) {
      this.consume(TokenType.LPAREN, "Expected '(' after 'read'");
      this.consume(TokenType.RPAREN, "Expected ')' after read()");
      this.consume(TokenType.SEMICOLON, "Expected ';' after cell read statement");
      return { type: 'CellRead', x, y, z };
    }

    if (this.match(TokenType.CLEAR)) {
      this.consume(TokenType.LPAREN, "Expected '(' after 'clear'");
      this.consume(TokenType.RPAREN, "Expected ')' after clear()");
      this.consume(TokenType.SEMICOLON, "Expected ';' after cell clear statement");
      return { type: 'CellClear', x, y, z };
    }

    throw new Error(`Unknown cell operation '${this.peek().value}' at line ${this.peek().line}`);
  }

  // entropy.analyze(stream);
  private entropyStatement(): EntropyAnalyzeNode {
    this.consume(TokenType.DOT, "Expected '.' after 'entropy'");
    this.consume(TokenType.ANALYZE, "Expected 'analyze' after 'entropy.'");
    this.consume(TokenType.LPAREN, "Expected '(' after 'analyze'");
    let stream = this.consumeIdentifierOrString('Expected stream string or identifier');
    this.consume(TokenType.RPAREN, "Expected ')' after argument");
    this.consume(TokenType.SEMICOLON, "Expected ';' after entropy.analyze(...)");
    return { type: 'EntropyAnalyze', stream };
  }

  // bitAgent.analyze(stream);
  private bitAgentStatement(): BitAnalyzeNode {
    this.consume(TokenType.DOT, "Expected '.' after 'bitAgent'");
    this.consume(TokenType.ANALYZE, "Expected 'analyze' after 'bitAgent.'");
    this.consume(TokenType.LPAREN, "Expected '(' after 'analyze'");
    let stream = this.consumeIdentifierOrString('Expected stream string or identifier');
    this.consume(TokenType.RPAREN, "Expected ')' after argument");
    this.consume(TokenType.SEMICOLON, "Expected ';' after bitAgent.analyze(...)");
    return { type: 'BitAnalyze', stream };
  }

  // broadcast(x, y, z, radius, data);
  private broadcastStatement(): BroadcastNode {
    this.consume(TokenType.LPAREN, "Expected '(' after broadcast");
    const centerX = parseInt(this.consume(TokenType.NUMBER, 'Expected centerX').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    const centerY = parseInt(this.consume(TokenType.NUMBER, 'Expected centerY').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    const centerZ = parseInt(this.consume(TokenType.NUMBER, 'Expected centerZ').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    const radius = parseInt(this.consume(TokenType.NUMBER, 'Expected radius').value, 10);
    this.consume(TokenType.COMMA, "Expected ','");
    let data: string | number;
    if (this.match(TokenType.STRING)) {
      data = this.previous().value;
    } else if (this.match(TokenType.NUMBER)) {
      data = parseFloat(this.previous().value);
    } else {
      data = this.consume(TokenType.IDENTIFIER, 'Expected data expression').value;
    }
    this.consume(TokenType.RPAREN, "Expected ')' after broadcast args");
    this.consume(TokenType.SEMICOLON, "Expected ';' after broadcast(...)");
    return { type: 'Broadcast', centerX, centerY, centerZ, radius, data };
  }

  // let name = value;
  private variableDecl(): VariableDeclNode {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected variable name').value;
    this.consume(TokenType.ASSIGN, "Expected '='");
    let val: string | number;
    if (this.match(TokenType.STRING)) {
      val = this.previous().value;
    } else if (this.match(TokenType.NUMBER)) {
      val = parseFloat(this.previous().value);
    } else {
      val = this.consume(TokenType.IDENTIFIER, 'Expected value').value;
    }
    this.consume(TokenType.SEMICOLON, "Expected ';' after let statement");
    return { type: 'VariableDecl', name, value: val };
  }

  // Phase 3 statement parsers

  // snapshot_save(destReg);
  private snapshotSaveStatement(): SnapshotSaveNode {
    this.consume(TokenType.LPAREN, "Expected '(' after snapshot_save");
    let destReg: string | undefined;
    if (this.match(TokenType.IDENTIFIER, TokenType.STRING)) {
      destReg = this.previous().value;
    }
    this.consume(TokenType.RPAREN, "Expected ')' after snapshot_save arguments");
    this.consume(TokenType.SEMICOLON, "Expected ';' after snapshot_save");
    return { type: 'SnapshotSave', destReg };
  }

  // snapshot_load(sourceReg);
  private snapshotLoadStatement(): SnapshotLoadNode {
    this.consume(TokenType.LPAREN, "Expected '(' after snapshot_load");
    let sourceReg: string | undefined;
    if (this.match(TokenType.IDENTIFIER, TokenType.STRING)) {
      sourceReg = this.previous().value;
    }
    this.consume(TokenType.RPAREN, "Expected ')' after snapshot_load arguments");
    this.consume(TokenType.SEMICOLON, "Expected ';' after snapshot_load");
    return { type: 'SnapshotLoad', sourceReg };
  }

  // snapshot_verify(sourceReg);
  private snapshotVerifyStatement(): SnapshotVerifyNode {
    this.consume(TokenType.LPAREN, "Expected '(' after snapshot_verify");
    let sourceReg: string | undefined;
    if (this.match(TokenType.IDENTIFIER, TokenType.STRING)) {
      sourceReg = this.previous().value;
    }
    this.consume(TokenType.RPAREN, "Expected ')' after snapshot_verify arguments");
    this.consume(TokenType.SEMICOLON, "Expected ';' after snapshot_verify");
    return { type: 'SnapshotVerify', sourceReg };
  }

  // spatial_query(queryType = "entropy", sMin = 0.6, sMax = 1.4, destReg);
  private spatialQueryStatement(): SpatialQueryNode {
    this.consume(TokenType.LPAREN, "Expected '(' after spatial_query");
    let queryType: 'shell' | 'entropy' | 'density' | 'tag' | 'knn' = 'shell';
    let rMin: number | undefined;
    let rMax: number | undefined;
    let sMin: number | undefined;
    let sMax: number | undefined;
    let dMin: number | undefined;
    let dMax: number | undefined;
    let tags: string[] | undefined;
    let knnK: number | undefined;
    let destReg: string | undefined;

    if (this.match(TokenType.QUERY_TYPE)) {
      this.consume(TokenType.ASSIGN, "Expected '=' after queryType");
    }
    if (this.match(TokenType.STRING, TokenType.IDENTIFIER)) {
      queryType = this.previous().value as any;
    }

    while (this.match(TokenType.COMMA)) {
      if (this.match(TokenType.R_MIN)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after rMin");
        rMin = parseInt(this.consume(TokenType.NUMBER, 'Expected rMin number').value, 10);
      } else if (this.match(TokenType.R_MAX)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after rMax");
        rMax = parseInt(this.consume(TokenType.NUMBER, 'Expected rMax number').value, 10);
      } else if (this.match(TokenType.S_MIN)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after sMin");
        sMin = parseFloat(this.consume(TokenType.NUMBER, 'Expected sMin number').value);
      } else if (this.match(TokenType.S_MAX)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after sMax");
        sMax = parseFloat(this.consume(TokenType.NUMBER, 'Expected sMax number').value);
      } else if (this.match(TokenType.D_MIN)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after dMin");
        dMin = parseFloat(this.consume(TokenType.NUMBER, 'Expected dMin number').value);
      } else if (this.match(TokenType.D_MAX)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after dMax");
        dMax = parseFloat(this.consume(TokenType.NUMBER, 'Expected dMax number').value);
      } else if (this.match(TokenType.KNN_K)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after knnK");
        knnK = parseInt(this.consume(TokenType.NUMBER, 'Expected knnK number').value, 10);
      } else if (this.match(TokenType.TAGS)) {
        this.consume(TokenType.ASSIGN, "Expected '=' after tags");
        const tagStr = this.consume(TokenType.STRING, 'Expected tags comma-separated string').value;
        tags = tagStr.split(',').map((t) => t.trim());
      } else if (this.match(TokenType.IDENTIFIER)) {
        destReg = this.previous().value;
      }
    }

    this.consume(TokenType.RPAREN, "Expected ')' after spatial_query arguments");
    this.consume(TokenType.SEMICOLON, "Expected ';' after spatial_query");
    return {
      type: 'SpatialQuery',
      queryType,
      rMin,
      rMax,
      sMin,
      sMax,
      dMin,
      dMax,
      tags,
      knnK,
      destReg,
    };
  }

  // snapshot_diff(sourceReg1, sourceReg2);
  private snapshotDiffStatement(): SnapshotDiffNode {
    this.consume(TokenType.LPAREN, "Expected '(' after snapshot_diff");
    let sourceReg = this.consumeIdentifierOrString('Expected sourceReg1');
    let destReg: string | undefined;
    if (this.match(TokenType.COMMA)) {
      destReg = this.consumeIdentifierOrString('Expected sourceReg2');
    }
    this.consume(TokenType.RPAREN, "Expected ')' after snapshot_diff arguments");
    this.consume(TokenType.SEMICOLON, "Expected ';' after snapshot_diff");
    return { type: 'SnapshotDiff', sourceReg, destReg };
  }

  // query_aggregate(destReg);
  private queryAggregateStatement(): QueryAggregateNode {
    this.consume(TokenType.LPAREN, "Expected '(' after query_aggregate");
    let destReg: string | undefined;
    if (this.match(TokenType.IDENTIFIER, TokenType.STRING)) {
      destReg = this.previous().value;
    }
    this.consume(TokenType.RPAREN, "Expected ')' after query_aggregate arguments");
    this.consume(TokenType.SEMICOLON, "Expected ';' after query_aggregate");
    return { type: 'QueryAggregate', destReg };
  }

  // entropy_centroid(destReg);
  private entropyCentroidStatement(): EntropyCentroidNode {
    this.consume(TokenType.LPAREN, "Expected '(' after entropy_centroid");
    let destReg: string | undefined;
    if (this.match(TokenType.IDENTIFIER, TokenType.STRING)) {
      destReg = this.previous().value;
    }
    this.consume(TokenType.RPAREN, "Expected ')' after entropy_centroid arguments");
    this.consume(TokenType.SEMICOLON, "Expected ';' after entropy_centroid");
    return { type: 'EntropyCentroid', destReg };
  }
}
