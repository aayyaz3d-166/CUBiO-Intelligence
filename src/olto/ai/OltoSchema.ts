/**
 * OLTO Frontend Subsystem — Structured AI Application Schema (JSON IR)
 * ====================================================================
 * Provides a structured, deterministic intermediate representation (.olto.spec.json)
 * allowing AI models, ECHO-1, and autonomous agents to emit valid UI schemas
 * without risking syntax degradation or bracket mismatch errors.
 */

export interface OltoStateField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'Array' | 'any';
  initial: any;
}

export interface OltoComputedField {
  name: string;
  type: string;
  expression: string;
}

export interface OltoActionDef {
  name: string;
  params?: string[];
  statements: string[];
}

export interface OltoLayoutNode {
  component: string;
  props?: Record<string, any>;
  children?: Array<OltoLayoutNode | string>;
}

export interface OltoAppSchema {
  version: '1.0';
  name: string;
  kind?: 'component' | 'page';
  theme?: 'dark' | 'light';
  state: OltoStateField[];
  computed?: OltoComputedField[];
  actions?: OltoActionDef[];
  layout: OltoLayoutNode;
}

export class OltoSchemaValidator {
  /**
   * Validates that an object conforms to the OltoAppSchema.
   */
  public static validate(obj: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!obj || typeof obj !== 'object') {
      return { valid: false, errors: ['Schema root must be an object.'] };
    }

    if (obj.version !== '1.0') {
      errors.push("Invalid or missing schema 'version'. Expected '1.0'.");
    }

    if (!obj.name || typeof obj.name !== 'string' || !/^[A-Z][a-zA-Z0-9_]*$/.test(obj.name)) {
      errors.push("Invalid 'name': Component/Page name must start with a capital letter (PascalCase).");
    }

    if (!Array.isArray(obj.state)) {
      errors.push("Schema 'state' must be an array of state field declarations.");
    } else {
      for (let i = 0; i < obj.state.length; i++) {
        const s = obj.state[i];
        if (!s.name || typeof s.name !== 'string') {
          errors.push(`State field at index ${i} is missing a valid 'name'.`);
        }
        if (!s.type) {
          errors.push(`State field '${s.name || i}' is missing 'type'.`);
        }
      }
    }

    if (!obj.layout || typeof obj.layout !== 'object') {
      errors.push("Schema 'layout' root node is missing or invalid.");
    } else {
      this.validateLayoutNode(obj.layout, 'layout', errors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateLayoutNode(node: any, path: string, errors: string[]): void {
    if (typeof node === 'string') return;

    if (!node || typeof node !== 'object') {
      errors.push(`Layout node at '${path}' must be an object or string.`);
      return;
    }

    if (!node.component || typeof node.component !== 'string') {
      errors.push(`Layout node at '${path}' is missing 'component' tag name.`);
    }

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any, idx: number) => {
        this.validateLayoutNode(child, `${path}.children[${idx}]`, errors);
      });
    }
  }
}
