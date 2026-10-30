/**
 * OLTO Frontend Subsystem — Reactive Runtime Verification Suite (Phase 3)
 * =======================================================================
 * Tests fine-grained signal reactivity, computed dependency graphs,
 * batched micro-updates, direct DOM bindings, event dispatching, and component lifecycles.
 */

import { Signal, Computed, createEffect, batch, signal, computed } from '../../src/olto/runtime/Signal';
import { OltoDOMRenderer, OltoDOMElement } from '../../src/olto/runtime/OltoDOMRenderer';
import { OltoComponentInstance } from '../../src/olto/runtime/OltoComponentInstance';
import * as assert from 'assert';

console.log('================================================================================');
console.log('  OLTO FRONTEND SUBSYSTEM — REACTIVE RUNTIME ENGINE VERIFICATION');
console.log('================================================================================\n');

// ── Test 1: Fine-Grained Signal Reactivity ──────────────────────────────────
console.log('[Test 1] Testing Fine-Grained Signal Reactivity...');
const count = new Signal<number>(10);
const history: number[] = [];

const dispose = createEffect(() => {
  history.push(count.get());
});

count.set(20);
count.set(30);

assert.deepStrictEqual(history, [10, 20, 30], 'Effect must capture initial value and both mutations');
dispose(); // Clean up subscriber
count.set(40);
assert.deepStrictEqual(history, [10, 20, 30], 'Disposed effect must not fire on subsequent mutations');
console.log('  ✓ Signal reactivity & automatic cleanup verified.\n');

// ── Test 2: Computed Signal Dependency Tracking ─────────────────────────────
console.log('[Test 2] Testing Computed Reactive Graph...');
const price = new Signal<number>(100);
const taxRate = new Signal<number>(0.15);

const total = new Computed<number>(() => {
  return price.get() * (1 + taxRate.get());
});

assert.strictEqual(Math.round(total.get()), 115);

price.set(200);
assert.strictEqual(Math.round(total.get()), 230);

taxRate.set(0.20);
assert.strictEqual(Math.round(total.get()), 240);
console.log('  ✓ Computed signal dynamically recalculated upon dependency mutations.\n');

// ── Test 3: Batched Mutations ───────────────────────────────────────────────
console.log('[Test 3] Testing Batched Micro-Updates...');
const firstName = new Signal<string>('Alan');
const lastName = new Signal<string>('Turing');
let renderCount = 0;

createEffect(() => {
  // Read both signals
  const fullName = `${firstName.get()} ${lastName.get()}`;
  renderCount++;
});

assert.strictEqual(renderCount, 1, 'Initial render fires once');

// Without batching, 2 mutations would trigger 2 renders.
// With batching, it must trigger only 1 render!
batch(() => {
  firstName.set('Ada');
  lastName.set('Lovelace');
});

assert.strictEqual(renderCount, 2, 'Batching must collapse multiple mutations into 1 render cycle');
console.log('  ✓ Batch scheduler collapsed simultaneous signal mutations into single update.\n');

// ── Test 4: Direct DOM Reactive Text Binding & Micro-Benchmarking ───────────
console.log('[Test 4] Testing Direct DOM Signal Binding & Micro-Benchmark...');
const counterSignal = new Signal<number>(0);
const boundTextNode = OltoDOMRenderer.bindText(() => `Score: ${counterSignal.get()}`);

assert.strictEqual(boundTextNode.text, 'Score: 0');

const t0 = performance.now();
const ITERATIONS = 1000;
for (let i = 1; i <= ITERATIONS; i++) {
  counterSignal.set(i);
}
const elapsedMs = performance.now() - t0;
const perUpdateMicroseconds = (elapsedMs / ITERATIONS) * 1000;

assert.strictEqual(boundTextNode.text, `Score: ${ITERATIONS}`);
console.log(`  ✓ 1,000 Direct DOM text mutations finished in ${elapsedMs.toFixed(2)}ms (${perUpdateMicroseconds.toFixed(2)} µs per update)`);
assert.ok(elapsedMs < 100, '1,000 updates must complete in < 100ms (far below 1ms per update target)');
console.log('  ✓ Micro-second direct DOM reactive patching PASSED.\n');

// ── Test 5: Interactive Component Simulation (Counter) ───────────────────────
console.log('[Test 5] Interactive Component Simulation with Click Events...');
const counterComp = new OltoComponentInstance('InteractiveCounter');
const countState = counterComp.registerState('count', 0);

// Build Component DOM Tree
const card = OltoDOMRenderer.createElement('div');
card.setAttribute('class', 'counter-card');

const minusBtn = OltoDOMRenderer.createElement('button');
minusBtn.appendChild(OltoDOMRenderer.createTextNode('-'));
minusBtn.addEventListener('click', () => {
  countState.set((prev) => prev - 1);
});

const plusBtn = OltoDOMRenderer.createElement('button');
plusBtn.appendChild(OltoDOMRenderer.createTextNode('+'));
plusBtn.addEventListener('click', () => {
  countState.set((prev) => prev + 1);
});

const valueDisplay = OltoDOMRenderer.bindText(() => `Count: ${countState.get()}`);

card.appendChild(minusBtn);
card.appendChild(valueDisplay);
card.appendChild(plusBtn);
counterComp.rootElement = card;

assert.ok(card.renderToHTML().includes('Count: 0'));

// Simulate user clicking '+' button twice
plusBtn.dispatchEvent('click');
plusBtn.dispatchEvent('click');
assert.ok(card.renderToHTML().includes('Count: 2'), 'DOM must reflect count = 2 after 2 clicks');

// Simulate user clicking '-' button once
minusBtn.dispatchEvent('click');
assert.ok(card.renderToHTML().includes('Count: 1'), 'DOM must reflect count = 1 after 1 click');
console.log(`  ✓ Rendered HTML: ${card.renderToHTML()}`);
console.log('  ✓ Event dispatching and DOM reactive patching PASSED.\n');

// ── Test 6: Component Lifecycle (onMount & onDestroy) ────────────────────────
console.log('[Test 6] Testing Component Lifecycle Hooks...');
let isMountedFlag = false;
let isDestroyedFlag = false;

const lifecycleComp = new OltoComponentInstance('LifecycleWidget');
lifecycleComp.rootElement = OltoDOMRenderer.createElement('section');

lifecycleComp.onMount(() => {
  isMountedFlag = true;
});

lifecycleComp.onDestroy(() => {
  isDestroyedFlag = true;
});

const container = OltoDOMRenderer.createElement('main');

assert.strictEqual(lifecycleComp.isMounted, false);
await lifecycleComp.mount(container);

assert.strictEqual(lifecycleComp.isMounted, true);
assert.strictEqual(isMountedFlag, true, 'onMount hook must be executed on mount');
assert.strictEqual(container.children.length, 1);

await lifecycleComp.destroy();
assert.strictEqual(lifecycleComp.isMounted, false);
assert.strictEqual(isDestroyedFlag, true, 'onDestroy hook must be executed on destroy');
assert.strictEqual(container.children.length, 0, 'Element must be removed from container on destroy');
console.log('  ✓ Lifecycle triggers and cleanup confirmed.\n');

console.log('================================================================================');
console.log('  ALL 6 OLTO REACTIVE RUNTIME TEST SUITES PASSED (100%)');
console.log('================================================================================');
