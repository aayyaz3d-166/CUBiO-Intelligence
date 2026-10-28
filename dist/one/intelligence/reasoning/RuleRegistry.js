/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: Reusable Rule Registry (src/one/intelligence/reasoning/RuleRegistry.ts)
 */
export class RuleRegistry {
    rules = new Map();
    /**
     * Registers a reusable reasoning rule.
     * Rejects duplicate rule IDs to maintain determinism.
     */
    register(rule) {
        if (!rule.id || typeof rule.id !== 'string') {
            throw new Error(`[RuleRegistry] Invalid rule id: ${String(rule.id)}`);
        }
        if (this.rules.has(rule.id)) {
            throw new Error(`[RuleRegistry] Duplicate rule registration for id '${rule.id}'`);
        }
        this.rules.set(rule.id, rule);
        return this;
    }
    /**
     * Unregisters a rule by ID.
     */
    unregister(ruleId) {
        return this.rules.delete(ruleId);
    }
    /**
     * Retrieves a rule by ID.
     */
    get(ruleId) {
        return this.rules.get(ruleId);
    }
    /**
     * Returns all registered rules in stable insertion order.
     */
    getAll() {
        return Array.from(this.rules.values());
    }
    /**
     * Returns all rules applicable to the given state and context.
     * Sorted deterministically by rule priority (descending) and rule ID (lexicographical).
     */
    getApplicable(value, context) {
        const applicable = [];
        for (const rule of this.rules.values()) {
            try {
                if (rule.isApplicable(value, context)) {
                    applicable.push(rule);
                }
            }
            catch {
                // Fail-closed on faulty rule preconditions
                continue;
            }
        }
        // Deterministic sorting: priority (higher first), then rule ID
        return applicable.sort((a, b) => {
            const pA = a.priority ?? 0;
            const pB = b.priority ?? 0;
            if (pA !== pB) {
                return pB - pA;
            }
            return a.id.localeCompare(b.id);
        });
    }
    /**
     * Returns the count of registered rules.
     */
    size() {
        return this.rules.size;
    }
    /**
     * Clears all registered rules.
     */
    clear() {
        this.rules.clear();
    }
}
