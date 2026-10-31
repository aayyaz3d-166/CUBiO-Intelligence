import { HybridConversationEngine } from '../src/one/intelligence/hybrid/HybridConversationEngine';
import { SelectiveMemory } from './src/one/intelligence/memory/SelectiveMemory';
import { RuleRegistry } from './src/one/intelligence/reasoning/RuleRegistry';
import { HybridRequest } from './src/one/intelligence/hybrid/types';

const ruleRegistry = new RuleRegistry<number>();
const memory = new SelectiveMemory(ruleRegistry as RuleRegistry<unknown>, 50);
const engine = new HybridConversationEngine(memory);

// Session 1: user asks for 42 -> 0
const reqA: HybridRequest = { text: 'starting from 42, subtract until 0', sessionId: 'sess-abc' };
const respA = engine.processInput(reqA);
console.log('TURN 1:');
console.log('  status:', respA.status, '| isSolved:', respA.isSolved, '| text:', respA.naturalLanguageText.slice(0, 90), '...');

// Session 1: follow-up "subtract by 5"
const reqB: HybridRequest = { text: 'subtract by 5', sessionId: 'sess-abc' };
const respB = engine.processInput(reqB);
console.log('TURN 2 (follow-up: "subtract by 5"):');
console.log('  status:', respB.status, '| isSolved:', respB.isSolved, '| text:', respB.naturalLanguageText.slice(0, 80), '...');

// Session 2: different session - no leak
const reqC: HybridRequest = { text: 'starting from 100, subtract until 0', sessionId: 'sess-def' };
const respC = engine.processInput(reqC);
console.log('TURN 3 (sess-def):');
console.log('  status:', respC.status, '| isSolved:', respC.isSolved, '| text:', respC.naturalLanguageText.slice(0, 90), '...');

// Session 2: follow-up "it" - should NOT see sess-abc
const reqD: HybridRequest = { text: 'it', sessionId: 'sess-def' };
const respD = engine.processInput(reqD);
console.log('TURN 4 (sess-def: "it"):');
console.log('  status:', respD.status, '| isSolved:', respD.isSolved, '| text:', respD.naturalLanguageText.slice(0, 100), '...');

// Cross-session isolation check via engine resetSession
engine.resetSession('sess-abc');
const reqE: HybridRequest = { text: 'it', sessionId: 'sess-abc' };
const respE = engine.processInput(reqE);
console.log('TURN 5 (after resetSession, sess-abc: "it"):');
console.log('  status:', respE.status, '| isSolved:', respE.isSolved);
