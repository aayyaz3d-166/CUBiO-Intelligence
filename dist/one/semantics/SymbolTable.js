export class Scope {
    symbols = new Map();
    parent;
    scopeType;
    level;
    capturedVars = new Set();
    constructor(scopeType = 'global', parent) {
        this.scopeType = scopeType;
        this.parent = parent;
        this.level = parent ? parent.level + 1 : 0;
    }
    define(symbol) {
        if (this.symbols.has(symbol.name)) {
            return false; // Duplicate in same immediate scope
        }
        this.symbols.set(symbol.name, symbol);
        return true;
    }
    resolveLocal(name) {
        return this.symbols.get(name);
    }
    resolve(name) {
        if (this.symbols.has(name)) {
            return this.symbols.get(name);
        }
        if (this.parent) {
            return this.parent.resolve(name);
        }
        return undefined;
    }
    getEnclosingFunction() {
        let curr = this;
        while (curr) {
            if (curr.scopeType === 'function') {
                return curr;
            }
            curr = curr.parent;
        }
        return undefined;
    }
}
