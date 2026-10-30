/**
 * OLTO Frontend Subsystem — Abstract Syntax Tree (AST) Model
 * ==========================================================
 * Strongly-typed AST definitions representing OLTO components, pages,
 * reactive states, computed properties, view trees, actions, and layouts.
 */

export interface SourceLocation {
  line: number;
  column: number;
}

export type OltoASTNode =
  | OltoProgram
  | OltoImport
  | OltoComponent
  | OltoPage
  | OltoParameter
  | OltoStateDeclaration
  | OltoComputedDeclaration
  | OltoWatchDeclaration
  | OltoLifecycleHook
  | OltoActionDeclaration
  | OltoViewBlock
  | OltoElementNode
  | OltoConditionalNode
  | OltoIterationNode
  | OltoSlotNode
  | OltoAttribute
  | OltoStatement
  | OltoExpression;

export interface OltoProgram {
  kind: 'Program';
  imports: OltoImport[];
  declarations: (OltoComponent | OltoPage)[];
  loc: SourceLocation;
}

export interface OltoImport {
  kind: 'Import';
  specifiers: string[];
  source: string;
  loc: SourceLocation;
}

export interface OltoParameter {
  kind: 'Parameter';
  name: string;
  type: string;
  defaultValue?: OltoExpression;
  loc: SourceLocation;
}

export interface OltoStateDeclaration {
  kind: 'StateDeclaration';
  name: string;
  type: string;
  initialValue: OltoExpression;
  loc: SourceLocation;
}

export interface OltoComputedDeclaration {
  kind: 'ComputedDeclaration';
  name: string;
  type: string;
  body: OltoStatement[];
  loc: SourceLocation;
}

export interface OltoWatchDeclaration {
  kind: 'WatchDeclaration';
  target: string;
  body: OltoStatement[];
  loc: SourceLocation;
}

export interface OltoLifecycleHook {
  kind: 'LifecycleHook';
  hookType: 'onMount' | 'onDestroy';
  body: OltoStatement[];
  loc: SourceLocation;
}

export interface OltoActionDeclaration {
  kind: 'ActionDeclaration';
  name: string;
  isAsync: boolean;
  parameters: OltoParameter[];
  body: OltoStatement[];
  loc: SourceLocation;
}

export interface OltoViewBlock {
  kind: 'ViewBlock';
  rootNode: OltoUINode;
  loc: SourceLocation;
}

export type OltoUINode =
  | OltoElementNode
  | OltoConditionalNode
  | OltoIterationNode
  | OltoSlotNode;

export interface OltoElementNode {
  kind: 'ElementNode';
  componentName: string;
  attributes: OltoAttribute[];
  children: OltoUINode[];
  loc: SourceLocation;
}

export interface OltoConditionalNode {
  kind: 'ConditionalNode';
  condition: OltoExpression;
  thenBranch: OltoUINode[];
  elseBranch?: OltoUINode[];
  loc: SourceLocation;
}

export interface OltoIterationNode {
  kind: 'IterationNode';
  itemName: string;
  indexName?: string;
  iterable: OltoExpression;
  children: OltoUINode[];
  loc: SourceLocation;
}

export interface OltoSlotNode {
  kind: 'SlotNode';
  name?: string;
  loc: SourceLocation;
}

export interface OltoAttribute {
  kind: 'Attribute';
  name: string;
  value: OltoExpression | OltoHandler;
  loc: SourceLocation;
}

export interface OltoHandler {
  kind: 'Handler';
  parameterName?: string;
  body: OltoStatement[];
  loc: SourceLocation;
}

export interface OltoComponent {
  kind: 'Component';
  name: string;
  parameters: OltoParameter[];
  state: OltoStateDeclaration[];
  computed: OltoComputedDeclaration[];
  watchers: OltoWatchDeclaration[];
  hooks: OltoLifecycleHook[];
  actions: OltoActionDeclaration[];
  view: OltoViewBlock;
  loc: SourceLocation;
}

export interface OltoPage {
  kind: 'Page';
  name: string;
  route?: string;
  parameters: OltoParameter[];
  state: OltoStateDeclaration[];
  computed: OltoComputedDeclaration[];
  watchers: OltoWatchDeclaration[];
  hooks: OltoLifecycleHook[];
  actions: OltoActionDeclaration[];
  view: OltoViewBlock;
  loc: SourceLocation;
}

// ──────────────── Statements ────────────────
export type OltoStatement =
  | OltoVariableStatement
  | OltoAssignmentStatement
  | OltoIfStatement
  | OltoReturnStatement
  | OltoExpressionStatement;

export interface OltoVariableStatement {
  kind: 'VariableStatement';
  isConst: boolean;
  name: string;
  type?: string;
  initializer: OltoExpression;
  loc: SourceLocation;
}

export interface OltoAssignmentStatement {
  kind: 'AssignmentStatement';
  target: string;
  operator: '=' | '+=' | '-=' | '*=' | '/=';
  value: OltoExpression;
  loc: SourceLocation;
}

export interface OltoIfStatement {
  kind: 'IfStatement';
  condition: OltoExpression;
  thenBlock: OltoStatement[];
  elseBlock?: OltoStatement[];
  loc: SourceLocation;
}

export interface OltoReturnStatement {
  kind: 'ReturnStatement';
  value?: OltoExpression;
  loc: SourceLocation;
}

export interface OltoExpressionStatement {
  kind: 'ExpressionStatement';
  expression: OltoExpression;
  loc: SourceLocation;
}

// ──────────────── Expressions ────────────────
export type OltoExpression =
  | OltoStringLiteral
  | OltoNumberLiteral
  | OltoBooleanLiteral
  | OltoIdentifier
  | OltoBinaryExpression
  | OltoUnaryExpression
  | OltoCallExpression
  | OltoMemberExpression
  | OltoArrayLiteral
  | OltoTernaryExpression
  | OltoAwaitExpression;

export interface OltoStringLiteral {
  kind: 'StringLiteral';
  value: string;
  hasInterpolation: boolean;
  parts?: (string | OltoExpression)[];
  loc: SourceLocation;
}

export interface OltoNumberLiteral {
  kind: 'NumberLiteral';
  value: number;
  loc: SourceLocation;
}

export interface OltoBooleanLiteral {
  kind: 'BooleanLiteral';
  value: boolean;
  loc: SourceLocation;
}

export interface OltoIdentifier {
  kind: 'Identifier';
  name: string;
  loc: SourceLocation;
}

export interface OltoBinaryExpression {
  kind: 'BinaryExpression';
  operator: string;
  left: OltoExpression;
  right: OltoExpression;
  loc: SourceLocation;
}

export interface OltoUnaryExpression {
  kind: 'UnaryExpression';
  operator: '!' | '-' | '+';
  operand: OltoExpression;
  loc: SourceLocation;
}

export interface OltoNamedArgument {
  kind: 'NamedArgument';
  name: string;
  value: OltoExpression;
  loc: SourceLocation;
}

export interface OltoCallExpression {
  kind: 'CallExpression';
  callee: OltoExpression;
  arguments: (OltoExpression | OltoNamedArgument)[];
  loc: SourceLocation;
}

export interface OltoMemberExpression {
  kind: 'MemberExpression';
  object: OltoExpression;
  property: string;
  loc: SourceLocation;
}

export interface OltoArrayLiteral {
  kind: 'ArrayLiteral';
  elements: OltoExpression[];
  loc: SourceLocation;
}

export interface OltoTernaryExpression {
  kind: 'TernaryExpression';
  condition: OltoExpression;
  consequent: OltoExpression;
  alternate: OltoExpression;
  loc: SourceLocation;
}

export interface OltoAwaitExpression {
  kind: 'AwaitExpression';
  argument: OltoExpression;
  loc: SourceLocation;
}
