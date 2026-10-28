/**
 * ONE Language — Phase 3: 0/1 Reasoning Intelligence Engine
 * Module: Reusable Rule Registry (src/one/intelligence/reasoning/RuleRegistry.ts)
 */

import { ReasoningRule } from './types.js';

export class RuleRegistry<T = unknown> {
  private readonly rules: Map<string, ReasoningRule<T>> = new Map();

  /**
   * Registers a reusable reasoning rule.
   * Rejects duplicate rule IDs to maintain determinism.
   */
  public register(rule: ReasoningRule<T>): this {
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
  public unregister(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Retrieves a rule by ID.
   */
  public get(ruleId: string): ReasoningRule<T> | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Returns all registered rules in stable insertion order.
   */
  public getAll(): ReasoningRule<T>[] {
    return Array.from(this.rules.values());
  }

  /**
   * Returns all rules applicable to the given state and context.
   * Sorted deterministically by rule priority (descending) and rule ID (lexicographical).
   */
  public getApplicable(value: T, context?: Record<string, unknown>): ReasoningRule<T>[] {
    const applicable: ReasoningRule<T>[] = [];
    for (const rule of this.rules.values()) {
      try {
        if (rule.isApplicable(value, context as any)) {
          applicable.push(rule);
        }
      } catch {
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
  public size(): number {
    return this.rules.size;
  }

  /**
   * Clears all registered rules.
   */
  public clear(): void {
    this.rules.clear();
  }
}
