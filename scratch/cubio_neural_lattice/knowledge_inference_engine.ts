/**
 * CUBiO Knowledge Inference Engine & Theorem Prover
 * Gate: CNL-P7-001 | Sovereign Architecture
 */

export interface KnowledgeFact {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}

export interface InferenceRule {
  id: string;
  name: string;
  antecedents: Array<{ predicate: string; subjectVar: string; objectVar: string }>;
  consequent: { predicate: string; subjectVar: string; objectVar: string };
  confidenceWeight: number;
}

export interface ProofStep {
  stepNumber: number;
  appliedRuleId: string;
  derivedFact: KnowledgeFact;
  justification: string;
}

export class KnowledgeInferenceEngine {
  private facts: Map<string, KnowledgeFact> = new Map();
  private rules: Map<string, InferenceRule> = new Map();
  private proofLog: ProofStep[] = [];

  public assertFact(subject: string, predicate: string, object: string, confidence: number = 1.0): void {
    const key = `${subject}:${predicate}:${object}`;
    this.facts.set(key, { subject, predicate, object, confidence });
  }

  public registerRule(rule: InferenceRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Executes deterministic forward-chaining reasoning over the spatial knowledge base.
   */
  public inferNewKnowledge(maxIterations: number = 10): ProofStep[] {
    this.proofLog = [];
    let stepCount = 0;
    let newFactAdded = true;
    let iterations = 0;

    while (newFactAdded && iterations < maxIterations) {
      newFactAdded = false;
      iterations++;

      for (const rule of this.rules.values()) {
        if (rule.antecedents.length === 1) {
          const ant = rule.antecedents[0];
          for (const fact of this.facts.values()) {
            if (fact.predicate === ant.predicate) {
              const bindings: Record<string, string> = {
                [ant.subjectVar]: fact.subject,
                [ant.objectVar]: fact.object,
              };

              const newSub = bindings[rule.consequent.subjectVar] || rule.consequent.subjectVar;
              const newObj = bindings[rule.consequent.objectVar] || rule.consequent.objectVar;
              const newKey = `${newSub}:${rule.consequent.predicate}:${newObj}`;

              if (!this.facts.has(newKey)) {
                stepCount++;
                const newFact: KnowledgeFact = {
                  subject: newSub,
                  predicate: rule.consequent.predicate,
                  object: newObj,
                  confidence: fact.confidence * rule.confidenceWeight,
                };

                this.facts.set(newKey, newFact);
                const step: ProofStep = {
                  stepNumber: stepCount,
                  appliedRuleId: rule.id,
                  derivedFact: newFact,
                  justification: `Derived from '${fact.subject} ${fact.predicate} ${fact.object}' via ${rule.name}`,
                };
                this.proofLog.push(step);
                newFactAdded = true;
              }
            }
          }
        }
      }
    }

    return this.proofLog;
  }

  public queryFact(subject: string, predicate: string, object: string): KnowledgeFact | undefined {
    return this.facts.get(`${subject}:${predicate}:${object}`);
  }

  public getFactsCount(): number {
    return this.facts.size;
  }

  public getProofLog(): ProofStep[] {
    return [...this.proofLog];
  }
}
