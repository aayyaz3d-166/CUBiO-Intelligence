/**
 * Phase 4 — Mock LLM Simulator
 *
 * Simulates what a real Cubio LLM would output: maps simple natural-language
 * prompts to valid ONE Language source strings.  When the real LLM is ready,
 * this file is replaced by an actual LLM client / code-generation adapter.
 */

export type MockPrompt =
  | 'sum function'
  | 'multiply function'
  | 'variable declaration'
  | 'factorial function'
  | 'array loop'
  | 'hello world'
  | 'invalid code';

export interface MockLLMOutput {
  prompt: MockPrompt;
  oneCode: string;
  description: string;
}

/**
 * Generate a valid ONE Language source snippet for the given mock prompt.
 * The real LLM would produce this — here we hardcode examples so the bridge
 * pipeline can be tested without waiting for Cubio LLM training.
 */
export function mockGenerate(prompt: MockPrompt): MockLLMOutput {
  const map: Record<MockPrompt, MockLLMOutput> = {
    'sum function': {
      prompt: 'sum function',
      description: 'User asked: "Ek function bana jo do numbers ka sum return kare" → LLM generates add()',
      oneCode: `
function add(a: number, b: number) {
  let result = a + b;
  return result;
}
let s: number = add(10, 20);
`.trim(),
    },

    'multiply function': {
      prompt: 'multiply function',
      description: 'User asked: "Do numbers ka multiply karne wala function" → LLM generates multiply()',
      oneCode: `
function multiply(x: number, y: number) {
  return x * y;
}
let p: number = multiply(6, 7);
`.trim(),
    },

    'variable declaration': {
      prompt: 'variable declaration',
      description: 'User asked: "Kuch variables declare kar" → LLM generates a mix of types',
      oneCode: `
let count: number = 42;
let name: string = "MockLLM";
let active: bool = true;
let tags: array = ["alpha", "beta", "gamma"];
let meta: object = { version: 1, build: "mock" };
`.trim(),
    },

    'factorial function': {
      prompt: 'factorial function',
      description: 'User asked: "Factorial calculate karne wala function" → LLM generates recursive factorial',
      oneCode: `
function factorial(n: number) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}
let fact5: number = factorial(5);
`.trim(),
    },

    'array loop': {
      prompt: 'array loop',
      description: 'User asked: "Ek array ke saare elements print kar" -> LLM generates a for-of loop',
      oneCode: `
let items: array = ["one", "two", "three"];
for (let elem of items) {
  // iterate — body stored for inspection
}
`.trim(),
    },

    'hello world': {
      prompt: 'hello world',
      description: 'User asked: "Hello world program" → LLM generates a simple variable + print',
      oneCode: `
let message: string = "Hello from Cubío ONE Language!";
let version: string = "Phase4 Mock";
`.trim(),
    },

    'invalid code': {
      prompt: 'invalid code',
      description: 'Simulated LLM mistake — code with a syntax error, bridge should catch it safely',
      oneCode: `
let x = 10
let y = 20
let sum = x + y
// Missing semicolons + broken syntax below:
if (x > y {
  let z = x + y
}
`.trim(),
    },
  };

  return map[prompt];
}

/**
 * List all supported mock prompts so the bridge test can iterate over them.
 */
export function listMockPrompts(): MockPrompt[] {
  return [
    'hello world',
    'variable declaration',
    'sum function',
    'multiply function',
    'factorial function',
    'array loop',
    'invalid code',
  ];
}
