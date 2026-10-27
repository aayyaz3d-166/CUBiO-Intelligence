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
  | 'ExportStatement'
  | 'ModuleDeclaration'
  | 'StructDeclaration'
  | 'EnumDeclaration'
  | 'DeclarativeSpatialNode'
  | 'Literal'
  | 'Identifier'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'CallExpression'
  | 'ArrayLiteral'
  | 'ObjectLiteral'
  | 'MemberExpression'
  | 'AwaitExpression';

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
  structName?: string;
}

export interface MemberExpressionNode extends BaseASTNode {
  kind: 'MemberExpression';
  object: ExpressionNode;
  property: string | ExpressionNode;
  computed: boolean;
}

export interface AwaitExpressionNode extends BaseASTNode {
  kind: 'AwaitExpression';
  argument: ExpressionNode;
}

export type ExpressionNode =
  | LiteralNode
  | IdentifierNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | CallExpressionNode
  | ArrayLiteralNode
  | ObjectLiteralNode
  | MemberExpressionNode
  | AwaitExpressionNode
  | FunctionDeclarationNode;

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
  isAsync?: boolean;
  params: ParameterDeclaration[];
  returnTypeAnnotation?: string;
  body: BlockStatementNode;
  capturedVars?: string[];
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

export interface ImportSpecifier {
  name: string;
  alias?: string;
  span?: SourceSpan;
}

export interface ImportStatementNode extends BaseASTNode {
  kind: 'ImportStatement';
  moduleName: string;
  alias?: string;
  specifiers?: ImportSpecifier[];
  isNamespace?: boolean;
}

export interface ExportSpecifier {
  name: string;
  alias?: string;
  span?: SourceSpan;
}

export interface ExportStatementNode extends BaseASTNode {
  kind: 'ExportStatement';
  declaration?: UnifiedStatementNode;
  specifiers?: ExportSpecifier[];
}

export interface ModuleDeclarationNode extends BaseASTNode {
  kind: 'ModuleDeclaration';
  name: string;
}

export interface StructFieldDeclaration {
  name: string;
  typeAnnotation: string;
  span?: SourceSpan;
}

export interface StructDeclarationNode extends BaseASTNode {
  kind: 'StructDeclaration';
  name: string;
  fields: StructFieldDeclaration[];
}

export interface EnumVariantDeclaration {
  name: string;
  value: number | string;
  span?: SourceSpan;
}

export interface EnumDeclarationNode extends BaseASTNode {
  kind: 'EnumDeclaration';
  name: string;
  variants: EnumVariantDeclaration[];
}

export interface DeclarativeSpatialNodeWrapper extends BaseASTNode {
  kind: 'DeclarativeSpatialNode';
  nodeType: 'Node' | 'Funnel' | 'Channel' | 'Seal' | 'Slice';
  payload: Record<string, unknown>;
}

export type UnifiedStatementNode =
  | VariableDeclarationNode
  | FunctionDeclarationNode
  | StructDeclarationNode
  | EnumDeclarationNode
  | ReturnStatementNode
  | IfStatementNode
  | WhileStatementNode
  | ForStatementNode
  | BlockStatementNode
  | ExpressionStatementNode
  | PrintStatementNode
  | ImportStatementNode
  | ExportStatementNode
  | ModuleDeclarationNode
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
