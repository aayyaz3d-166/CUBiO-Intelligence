import { SourceSpan } from './SourceLocation';

export type ASTNodeKind =
  | 'Program'
  | 'VariableDeclaration'
  | 'FunctionDeclaration'
  | 'ReturnStatement'
  | 'IfStatement'
  | 'WhileStatement'
  | 'ForStatement'
  | 'BlockStatement'
  | 'ExpressionStatement'
  | 'PrintStatement'
  | 'ImportStatement'
  | 'DeclarativeSpatialNode'
  | 'Literal'
  | 'Identifier'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'CallExpression'
  | 'ArrayLiteral'
  | 'ObjectLiteral'
  | 'MemberExpression';

export interface BaseASTNode {
  kind: ASTNodeKind;
  span?: SourceSpan;
  inferredType?: string;
}

// ── Expressions ─────────────────────────────────────────────────────────────

export interface LiteralNode extends BaseASTNode {
  kind: 'Literal';
  literalType: 'number' | 'string' | 'boolean' | 'null';
  value: number | string | boolean | null;
  raw?: string;
}

export interface IdentifierNode extends BaseASTNode {
  kind: 'Identifier';
  name: string;
}

export interface BinaryExpressionNode extends BaseASTNode {
  kind: 'BinaryExpression';
  operator: string; // '+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=', '&&', '||'
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryExpressionNode extends BaseASTNode {
  kind: 'UnaryExpression';
  operator: string; // '-', '!', '+'
  operand: ExpressionNode;
  prefix: boolean;
}

export interface CallExpressionNode extends BaseASTNode {
  kind: 'CallExpression';
  callee: ExpressionNode;
  args: ExpressionNode[];
}

export interface ArrayLiteralNode extends BaseASTNode {
  kind: 'ArrayLiteral';
  elements: ExpressionNode[];
}

export interface ObjectPropertyNode {
  key: string;
  value: ExpressionNode;
  span?: SourceSpan;
}

export interface ObjectLiteralNode extends BaseASTNode {
  kind: 'ObjectLiteral';
  properties: ObjectPropertyNode[];
}

export interface MemberExpressionNode extends BaseASTNode {
  kind: 'MemberExpression';
  object: ExpressionNode;
  property: string | ExpressionNode;
  computed: boolean;
}

export type ExpressionNode =
  | LiteralNode
  | IdentifierNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | CallExpressionNode
  | ArrayLiteralNode
  | ObjectLiteralNode
  | MemberExpressionNode;

// ── Statements ──────────────────────────────────────────────────────────────

export interface ParameterDeclaration {
  name: string;
  typeAnnotation?: string;
  span?: SourceSpan;
}

export interface VariableDeclarationNode extends BaseASTNode {
  kind: 'VariableDeclaration';
  identifier: string;
  isConst: boolean;
  typeAnnotation?: string;
  initializer?: ExpressionNode;
}

export interface BlockStatementNode extends BaseASTNode {
  kind: 'BlockStatement';
  statements: UnifiedStatementNode[];
}

export interface FunctionDeclarationNode extends BaseASTNode {
  kind: 'FunctionDeclaration';
  name: string;
  params: ParameterDeclaration[];
  returnTypeAnnotation?: string;
  body: BlockStatementNode;
}

export interface ReturnStatementNode extends BaseASTNode {
  kind: 'ReturnStatement';
  value?: ExpressionNode;
}

export interface IfStatementNode extends BaseASTNode {
  kind: 'IfStatement';
  condition: ExpressionNode;
  consequent: BlockStatementNode;
  alternate?: BlockStatementNode | IfStatementNode;
}

export interface WhileStatementNode extends BaseASTNode {
  kind: 'WhileStatement';
  condition: ExpressionNode;
  body: BlockStatementNode;
}

export interface ForStatementNode extends BaseASTNode {
  kind: 'ForStatement';
  iterator: string;
  iterable: ExpressionNode;
  body: BlockStatementNode;
}

export interface ExpressionStatementNode extends BaseASTNode {
  kind: 'ExpressionStatement';
  expression: ExpressionNode;
}

export interface PrintStatementNode extends BaseASTNode {
  kind: 'PrintStatement';
  expression: ExpressionNode;
}

export interface ImportStatementNode extends BaseASTNode {
  kind: 'ImportStatement';
  moduleName: string;
  alias?: string;
}

export interface DeclarativeSpatialNodeWrapper extends BaseASTNode {
  kind: 'DeclarativeSpatialNode';
  nodeType: 'Node' | 'Funnel' | 'Channel' | 'Seal' | 'Slice';
  payload: Record<string, unknown>;
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

// ── Top-Level Program ───────────────────────────────────────────────────────

export interface DeclarativeMetadata {
  rssMaxLimitMB: number;
  assertRssLimitMB?: number;
  actuationLock?: boolean;
}

export interface UnifiedProgramNode extends BaseASTNode {
  kind: 'Program';
  declarativeMeta?: DeclarativeMetadata;
  body: UnifiedStatementNode[];
}
