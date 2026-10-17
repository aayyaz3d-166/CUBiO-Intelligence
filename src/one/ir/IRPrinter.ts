import { UnifiedIRProgram, IRInstruction, IROperand } from './UnifiedIR';

export class IRPrinter {
  public static print(ir: UnifiedIRProgram): string {
    const lines: string[] = [];
    lines.push(`; --- ONE Language Unified IR (Version ${ir.version}) ---`);
    if (ir.declarativeMetadata) {
      lines.push(
        `; Declarative Limits: RSS=${ir.declarativeMetadata.rssMaxLimitMB}MB` +
        (ir.declarativeMetadata.assertRssLimitMB !== undefined
          ? `, AssertRSS=${ir.declarativeMetadata.assertRssLimitMB}MB`
          : '') +
        (ir.declarativeMetadata.actuationLock !== undefined
          ? `, ActuationLock=${ir.declarativeMetadata.actuationLock}`
          : '')
      );
    }
    lines.push('');

    for (const instr of ir.instructions) {
      lines.push(this.formatInstruction(instr));
    }

    return lines.join('\n');
  }

  private static formatInstruction(instr: IRInstruction): string {
    const idx = instr.index.toString().padStart(3, '0');
    const op = instr.opcode.padEnd(10, ' ');

    let dest = '';
    if (instr.destination) {
      dest = `${this.formatOperand(instr.destination)}, `;
    }

    const src = instr.sources.map((s) => this.formatOperand(s)).join(', ');
    const meta = instr.metadata ? ` ; ${JSON.stringify(instr.metadata)}` : '';

    return `${idx} ${op} ${dest}${src}${meta}`;
  }

  private static formatOperand(op: IROperand): string {
    switch (op.kind) {
      case 'register':
      case 'variable':
      case 'label':
        return String(op.value);

      case 'constant':
        if (typeof op.value === 'string') {
          return `"${op.value}"`;
        }
        return String(op.value);

      case 'spatial_payload':
        return `[SpatialNode ${(op.value as Record<string, unknown>).id || 'Data'}]`;

      default:
        return String(op.value);
    }
  }
}
