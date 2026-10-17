# ONE LANGUAGE — ABSTRACT SYNTAX TREE (AST) CONTRACT v0.1
**Specification Lock:** Phase 1  
**Authority:** Compiler Engineer & Static Analysis Architect

---

## 1. Implemented AST Node Inventory (`src/one/oneParser.ts`)

```typescript
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
```

---

## 2. Implemented Unified AST Layer (`src/one/ast/UnifiedAST.ts`)
*Status:* **IMPLEMENTED (Phase 2)**

The canonical Unified AST bridges Declarative Spatial AST nodes and Computational statements:

```typescript
export interface UnifiedProgramNode extends BaseASTNode {
  kind: 'Program';
  declarativeMeta?: DeclarativeMetadata;
  body: UnifiedStatementNode[];
}

export type UnifiedStatementNode =
  | VariableDeclarationNode
  | FunctionDeclarationNode
  | ReturnStatementNode
  | IfStatementNode
  | WhileStatementNode
  | ForStatementNode
  | BlockStatementNode
  | ExpressionStatementNode
  | PrintStatementNode
  | ImportStatementNode
  | DeclarativeSpatialNodeWrapper;
```

---

## 3. Lowering Pipeline (Unified Phase 2 Architecture)

```text
Source Text (.one)
      │
      ▼ (oneLexer.ts)
Token Stream
      │
      ▼ (GrammarRouter.ts)
[Declarative Parser | Computational Parser]
      │
      ▼ (DeclarativeASTAdapter.ts)
UnifiedProgramNode AST
      │
      ▼ (SemanticAnalyzer.ts & TypeChecker.ts)
Type-Checked & Validated AST
      │
      ▼ (IRLowering.ts)
UnifiedIRProgram (16 Linear Opcodes)
      │
      ▼ (cubioVM.ts - Phase 3)
Virtual Machine Execution
```
