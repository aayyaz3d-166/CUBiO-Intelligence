/**
 * CUBiO Knowledge Inference Engine & Theorem Prover
 * Gate: CNL-P7-001 | Sovereign Architecture
 */
export class KnowledgeInferenceEngine {
    facts = new Map();
    rules = new Map();
    proofLog = [];
    assertFact(subject, predicate, object, confidence = 1.0) {
        const key = `${subject}:${predicate}:${object}`;
        this.facts.set(key, { subject, predicate, object, confidence });
    }
    registerRule(rule) {
        this.rules.set(rule.id, rule);
    }
    /**
     * Executes deterministic forward-chaining reasoning over the spatial knowledge base.
     */
    inferNewKnowledge(maxIterations = 10) {
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
                            const bindings = {
                                [ant.subjectVar]: fact.subject,
                                [ant.objectVar]: fact.object,
                            };
                            const newSub = bindings[rule.consequent.subjectVar] || rule.consequent.subjectVar;
                            const newObj = bindings[rule.consequent.objectVar] || rule.consequent.objectVar;
                            const newKey = `${newSub}:${rule.consequent.predicate}:${newObj}`;
                            if (!this.facts.has(newKey)) {
                                stepCount++;
                                const newFact = {
                                    subject: newSub,
                                    predicate: rule.consequent.predicate,
                                    object: newObj,
                                    confidence: fact.confidence * rule.confidenceWeight,
                                };
                                this.facts.set(newKey, newFact);
                                const step = {
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
    queryFact(subject, predicate, object) {
        return this.facts.get(`${subject}:${predicate}:${object}`);
    }
    getFactsCount() {
        return this.facts.size;
    }
    getProofLog() {
        return [...this.proofLog];
    }
}
