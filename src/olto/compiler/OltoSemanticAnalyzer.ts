/**
 * OLTO Frontend Subsystem — Semantic Analyzer & Invariant Validator
 * =================================================================
 * Enforces compile-time type safety, client-side secret leakage guards (E9001),
 * component registry verification (E9002), and state immutability constraints.
 */

import {
  OltoProgram,
  OltoComponent,
  OltoPage,
  OltoElementNode,
  OltoUINode,
  OltoStatement,
  OltoAssignmentStatement,
} from './OltoAST';

export interface OltoDiagnostic {
  code: string;
  message: string;
  line: number;
  column: number;
  severity: 'Error' | 'Warning';
}

const BUILTIN_COMPONENTS = new Set([
  'Container',
  'Row',
  'Column',
  'Grid',
  'Text',
  'Button',
  'Input',
  'Card',
  'Modal',
  'Image',
  'Badge',
  'LoadingSpinner',
  'Spacer',
  'Toast',
]);

const FORBIDDEN_SECRET_PATTERNS = [
  /STRIPE_SECRET/i,
  /SECRET_KEY/i,
  /DATABASE_URL/i,
  /DB_PASSWORD/i,
  /PRIVATE_KEY/i,
  /AWS_SECRET/i,
  /API_SECRET/i,
];

export class OltoSemanticAnalyzer {
  private program: OltoProgram;
  private diagnostics: OltoDiagnostic[] = [];
  private definedComponents: Set<string> = new Set();

  constructor(program: OltoProgram) {
    this.program = program;
  }

  public analyze(): OltoDiagnostic[] {
    this.diagnostics = [];
    this.definedComponents = new Set();

    // 1. Collect all component & page names
    for (const decl of this.program.declarations) {
      this.definedComponents.add(decl.name);
    }

    // 2. Add imported names
    for (const imp of this.program.imports) {
      for (const spec of imp.specifiers) {
        this.definedComponents.add(spec);
      }
    }

    // 3. Analyze each component/page
    for (const decl of this.program.declarations) {
      this.analyzeComponentOrPage(decl);
    }

    return this.diagnostics;
  }

  private analyzeComponentOrPage(decl: OltoComponent | OltoPage): void {
    const stateNames = new Set<string>();
    const computedNames = new Set<string>();

    // Check states
    for (const st of decl.state) {
      // Invariant E9001: Secret key leakage check
      for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
        if (pattern.test(st.name)) {
          this.diagnostics.push({
            code: 'E9001',
            message: `[E9001: ClientSecretExposureViolation] Sensitive secret '${st.name}' cannot be declared in client-side OLTO state. Move secrets to backend .one service.`,
            line: st.loc.line,
            column: st.loc.column,
            severity: 'Error',
          });
        }
      }

      if (stateNames.has(st.name)) {
        this.diagnostics.push({
          code: 'E9003',
          message: `[E9003: DuplicateStateError] Duplicate state variable '${st.name}' in component '${decl.name}'.`,
          line: st.loc.line,
          column: st.loc.column,
          severity: 'Error',
        });
      }
      stateNames.add(st.name);
    }

    // Check computed
    for (const comp of decl.computed) {
      if (stateNames.has(comp.name) || computedNames.has(comp.name)) {
        this.diagnostics.push({
          code: 'E9003',
          message: `[E9003: DuplicateStateError] Computed property '${comp.name}' conflicts with existing state variable in '${decl.name}'.`,
          line: comp.loc.line,
          column: comp.loc.column,
          severity: 'Error',
        });
      }
      computedNames.add(comp.name);
    }

    // Check actions for invalid assignment to computed (E9003)
    for (const action of decl.actions) {
      this.validateStatements(action.body, computedNames);
    }

    // Check view tree (E9002 unrecognized components)
    this.validateViewNode(decl.view.rootNode);
  }

  private validateStatements(statements: OltoStatement[], computedNames: Set<string>): void {
    for (const stmt of statements) {
      if (stmt.kind === 'AssignmentStatement') {
        const assign = stmt as OltoAssignmentStatement;
        if (computedNames.has(assign.target)) {
          this.diagnostics.push({
            code: 'E9003',
            message: `[E9003: InvalidStateMutationError] Cannot mutate read-only computed property '${assign.target}'.`,
            line: assign.loc.line,
            column: assign.loc.column,
            severity: 'Error',
          });
        }
      } else if (stmt.kind === 'IfStatement') {
        this.validateStatements(stmt.thenBlock, computedNames);
        if (stmt.elseBlock) {
          this.validateStatements(stmt.elseBlock, computedNames);
        }
      }
    }
  }

  private validateViewNode(node: OltoUINode): void {
    if (node.kind === 'ElementNode') {
      const elem = node as OltoElementNode;
      if (!BUILTIN_COMPONENTS.has(elem.componentName) && !this.definedComponents.has(elem.componentName)) {
        this.diagnostics.push({
          code: 'E9002',
          message: `[E9002: UnrecognizedComponentError] Component '<${elem.componentName}>' is not defined or imported.`,
          line: elem.loc.line,
          column: elem.loc.column,
          severity: 'Error',
        });
      }

      for (const child of elem.children) {
        this.validateViewNode(child);
      }
    } else if (node.kind === 'ConditionalNode') {
      for (const child of node.thenBranch) {
        this.validateViewNode(child);
      }
      if (node.elseBranch) {
        for (const child of node.elseBranch) {
          this.validateViewNode(child);
        }
      }
    } else if (node.kind === 'IterationNode') {
      for (const child of node.children) {
        this.validateViewNode(child);
      }
    }
  }
}
