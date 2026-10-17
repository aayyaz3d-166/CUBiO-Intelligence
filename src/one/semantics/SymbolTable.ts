import { SourceSpan } from '../ast/SourceLocation';

export type SymbolKind =
  | 'variable'
  | 'constant'
  | 'function'
  | 'parameter'
  | 'module'
  | 'spatial_node';

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  typeAnnotation?: string;
  scopeLevel: number;
  paramCount?: number;
  span?: SourceSpan;
}

export type ScopeType = 'global' | 'function' | 'block';

export class Scope {
  public symbols: Map<string, SymbolEntry> = new Map();
  public parent?: Scope;
  public scopeType: ScopeType;
  public level: number;

  constructor(scopeType: ScopeType = 'global', parent?: Scope) {
    this.scopeType = scopeType;
    this.parent = parent;
    this.level = parent ? parent.level + 1 : 0;
  }

  public define(symbol: SymbolEntry): boolean {
    if (this.symbols.has(symbol.name)) {
      return false; // Duplicate in same immediate scope
    }
    this.symbols.set(symbol.name, symbol);
    return true;
  }

  public resolveLocal(name: string): SymbolEntry | undefined {
    return this.symbols.get(name);
  }

  public resolve(name: string): SymbolEntry | undefined {
    if (this.symbols.has(name)) {
      return this.symbols.get(name);
    }
    if (this.parent) {
      return this.parent.resolve(name);
    }
    return undefined;
  }

  public getEnclosingFunction(): Scope | undefined {
    let curr: Scope | undefined = this;
    while (curr) {
      if (curr.scopeType === 'function') {
        return curr;
      }
      curr = curr.parent;
    }
    return undefined;
  }
}
