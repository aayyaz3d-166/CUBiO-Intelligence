/**
 * Phase 6B — ONE Language Code Generator (NL2ONE)
 *
 * Maps extracted NLP intents and entities to valid ONE Language source strings.
 */

import { NLUIntent, ExtractedEntity } from './nlParser';

export class NLCodeGenerator {
  /**
   * Generate ONE Language source code from a parsed NL result.
   */
  public generate(parsed: { intent: NLUIntent; entities: ExtractedEntity }): string {
    switch (parsed.intent) {
      case 'CREATE_NODE':
        return this.generateNode(parsed.entities);
      case 'DECLARE_VARIABLE':
        return this.generateVariable(parsed.entities);
      case 'CREATE_FUNCTION':
        return this.generateFunction(parsed.entities);
      case 'SET_RSS':
        return this.generateRss(parsed.entities);
      case 'OPEN_FUNNEL':
        return this.generateFunnel(parsed.entities);
      default:
        return `// [NL2ONE] Could not generate code for unknown intent`;
    }
  }

  // ─── Node Generation ────────────────────────────────────────────────────

  private generateNode(entities: ExtractedEntity): string {
    if (!entities.name) {
      return `// [NL2ONE Error] Node name missing`;
    }
    const name = entities.name;
    if (entities.coordinates) {
      const [x, y, z] = entities.coordinates;
      return `node ${name} {\n  @Space(${x}, ${y}, ${z});\n}`;
    }
    // Default: place at origin
    return `node ${name} {\n  @Space(0, 0, 0);\n}`;
  }

  // ─── Variable Generation ────────────────────────────────────────────────

  private generateVariable(entities: ExtractedEntity): string {
    if (!entities.name) {
      return `// [NL2ONE Error] Variable name missing`;
    }
    const name = entities.name;
    const type = entities.type || this.inferType(entities.value);
    const val = entities.value;

    if (val === undefined) {
      return `let ${name}: ${type};`;
    }

    if (typeof val === 'string') {
      return `let ${name}: ${type} = "${val}";`;
    }

    if (typeof val === 'number') {
      return `let ${name}: ${type} = ${val};`;
    }

    if (typeof val === 'boolean') {
      return `let ${name}: ${type} = ${val};`;
    }

    return `let ${name}: ${type};`;
  }

  /**
   * Infer type from value when not explicitly given.
   */
  private inferType(value: number | string | undefined): string {
    if (value === undefined) return 'number';
    if (typeof value === 'string') {
      // Check if it's a numeric string
      if (!isNaN(parseFloat(value)) && isFinite(Number(value))) return 'number';
      return 'string';
    }
    if (typeof value === 'number') return 'number';
    return 'number';
  }

  // ─── Function Generation ────────────────────────────────────────────────

  private generateFunction(entities: ExtractedEntity): string {
    if (!entities.name) {
      return `// [NL2ONE Error] Function name missing`;
    }
    const name = entities.name;
    const params = entities.parameters || [];
    const returnType = entities.returnType || 'auto';

    // Build parameter string
    const paramStr = params.map(p => `${p.name}: ${p.type || 'number'}`).join(', ');

    // Build body based on available info
    let body = '';
    if (params.length === 2 && entities.expression) {
      // "a plus b" style expressions
      body = `\n  return ${entities.expression};\n`;
    } else if (params.length === 1) {
      body = `\n  return ${params[0].name};\n`;
    } else {
      body = `\n  return 0;\n`;
    }

    return `function ${name}(${paramStr}): ${returnType} {${body}}`;
  }

  // ─── RSS Generation ──────────────────────────────────────────────────────

  private generateRss(entities: ExtractedEntity): string {
    if (entities.value === undefined) {
      return `// [NL2ONE Error] RSS value missing`;
    }
    return `rss_max = ${entities.value};`;
  }

  // ─── Funnel Generation ───────────────────────────────────────────────────

  private generateFunnel(entities: ExtractedEntity): string {
    if (!entities.name) {
      return `// [NL2ONE Error] Funnel name missing`;
    }
    const name = entities.name;
    const source = entities.sourceNode || 'NodeA';
    const target = entities.targetNode || 'NodeB';
    const buffer = entities.bufferMb || 64;

    return `funnel ${name} {\n  stream ${source} -> ${target} : ${buffer};\n}`;
  }
}

/**
 * Convenience: generate ONE code from a raw NL sentence.
 */
export function nlToCode(input: string): string {
  const { NLParser } = require('./nlParser');
  const { NLCodeGenerator } = require('./nlCodeGenerator');
  // This is a circular require guard; use direct import in real usage
  const parser = new (require('./nlParser').NLParser)();
  const generator = new (require('./nlCodeGenerator').NLCodeGenerator)();
  const parsed = parser.parse(input);
  return generator.generate(parsed);
}
