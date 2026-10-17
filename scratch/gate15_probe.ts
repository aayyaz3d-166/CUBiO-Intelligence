/**
 * GATE 15 focused probe: Concept Graph intelligence.
 * Uses the SAME helpers as tests/hybrid/phase5_hybrid_conversation.test.ts
 * to reproduce the four failing assertions exactly.
 */
import { HybridConversationEngine } from './src/one/intelligence/hybrid/HybridConversationEngine';
import { SelectiveMemory } from './src/one/intelligence/memory/SelectiveMemory';
import { RuleRegistry } from './src/one/intelligence/reasoning/RuleRegistry';
import { HybridRequest } from './src/one/intelligence/hybrid/types';
import { ConceptGraph } from './src/one/intelligence/memory/ConceptGraph';

const ruleRegistry = new RuleRegistry<number>();
const memory = new SelectiveMemory(ruleRegistry as RuleRegistry<unknown>, 50);
const engine = new HybridConversationEngine(memory);

// Reproduction of G-02 / G-06-style: concept query for concept_car, then "it"
const req1c: HybridRequest = { text: 'What properties does concept_car have?', sessionId: 'sess-probe-c' };
const resp1c = engine.processInput(req1c);
console.log('=== G-style: "What properties does concept_car have?" ===');
console.log('  status:', resp1c.status, '| isSolved:', resp1c.isSolved);
console.log('  resolvedConcepts:', JSON.stringify(resp1c.resolvedConcepts));
console.log('  relTypes:', resp1c.resolvedConcepts ? resp1c.resolvedConcepts.map((c: any) => c.relationType) : 'none');

console.log('\n=== Resp2: "it" after that ===');
const req2c: HybridRequest = { text: 'it', sessionId: 'sess-probe-c' };
const resp2c = engine.processInput(req2c);
console.log('  status:', resp2c.status, '| isSolved:', resp2c.isSolved);
console.log('  text:', resp2c.naturalLanguageText.slice(0, 120));
