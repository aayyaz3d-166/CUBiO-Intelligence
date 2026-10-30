/**
 * OLTO Frontend Subsystem — Core Component Verification Suite (Phase 4)
 * =====================================================================
 * Verifies the 12 canonical OLTO UI components, responsive layout generation,
 * interactive event dispatchers, surface elevations, and declarative theme switching.
 */

import {
  Container,
  Row,
  Column,
  Grid,
  Text,
  Button,
  Input,
  Card,
  Modal,
  Image,
  Badge,
  LoadingSpinner,
  Spacer,
  Toast,
} from '../../src/olto/components/CoreComponents';
import { Theme, DarkTheme, LightTheme } from '../../src/olto/components/Theme';
import { Signal } from '../../src/olto/runtime/Signal';
import * as assert from 'assert';

console.log('================================================================================');
console.log('  OLTO FRONTEND SUBSYSTEM — CORE UI COMPONENT LIBRARY VERIFICATION');
console.log('================================================================================\n');

// ── Test 1: Layout Primitives (Container, Row, Column, Grid) ────────────────
console.log('[Test 1] Testing Layout Primitives (Container, Row, Column, Grid)...');
const container = Container({ maxWidth: 1200, padding: 24 }, [
  Row({ justify: 'between', align: 'center', gap: 16 }, [
    Text('Brand Logo', { size: 20 }),
    Text('User Profile', { size: 16 }),
  ]),
  Column({ gap: 12 }, [
    Text('Item 1'),
    Text('Item 2'),
  ]),
  Grid({ columns: [1, 2, 4], gap: 20 }, [
    Text('Col 1'),
    Text('Col 2'),
    Text('Col 3'),
    Text('Col 4'),
  ]),
]);

const containerHtml = container.renderToHTML();
assert.ok(containerHtml.includes('max-width: 1200px'));
assert.ok(containerHtml.includes('padding: 24px'));
assert.ok(containerHtml.includes('justify-content: space-between'));
assert.ok(containerHtml.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'));
console.log('  ✓ Container, Row, Column, and Grid compiled to responsive layout styles.\n');

// ── Test 2: Typography & Reactive Text ──────────────────────────────────────
console.log('[Test 2] Testing Typography & Reactive Text...');
const heading = Text('Welcome to OLTO', { size: 36, weight: 'bold' });
assert.ok(heading.renderToHTML().includes('<h1'));
assert.ok(heading.renderToHTML().includes('font-size: 36px'));

const countSignal = new Signal(0);
const reactiveText = Text(() => `Cart Items: ${countSignal.get()}`, { size: 16 });
assert.ok(reactiveText.renderToHTML().includes('Cart Items: 0'));

countSignal.set(5);
assert.ok(reactiveText.renderToHTML().includes('Cart Items: 5'), 'Reactive Text must micro-patch upon signal update');
console.log('  ✓ Static headings and reactive signal-bound text verified.\n');

// ── Test 3: Interactive Controls (Button & Input) ───────────────────────────
console.log('[Test 3] Testing Interactive Controls (Button & Input)...');
let clicked = false;
const btn = Button({
  label: 'Add to Cart',
  variant: 'solid',
  onClick: () => { clicked = true; },
});

assert.ok(btn.renderToHTML().includes('Add to Cart'));
btn.dispatchEvent('click');
assert.strictEqual(clicked, true, 'Button click event must fire callback');

let typedValue = '';
const input = Input({
  placeholder: 'Enter coupon code',
  onInput: (val) => { typedValue = val; },
});

input.dispatchEvent('input', 'DISCOUNT2026');
assert.strictEqual(typedValue, 'DISCOUNT2026', 'Input must dispatch typed value');
console.log('  ✓ Button click and Input change dispatchers verified.\n');

// ── Test 4: Surfaces & Overlays (Card, Modal, Image) ────────────────────────
console.log('[Test 4] Testing Surfaces & Overlays (Card, Modal, Image)...');
const card = Card({ radius: 16, elevation: 2 }, [
  Image({ src: 'https://example.com/course.png', height: 200, fit: 'cover' }),
  Text('Machine Learning 101', { size: 18, weight: 600 }),
]);

const cardHtml = card.renderToHTML();
assert.ok(cardHtml.includes('border-radius: 16px'));
assert.ok(cardHtml.includes('box-shadow: 0 3px 6px'));
assert.ok(cardHtml.includes('<img'));
assert.ok(cardHtml.includes('src="https://example.com/course.png"'));

let modalClosed = false;
const modal = Modal({
  isOpen: true,
  title: 'Confirm Purchase',
  onClose: () => { modalClosed = true; },
}, [
  Text('Are you sure you want to proceed?'),
]);

assert.ok(modal.renderToHTML().includes('Confirm Purchase'));
console.log('  ✓ Card surfaces, Image media, and Modal dialogs verified.\n');

// ── Test 5: Feedback & Status (Badge, LoadingSpinner, Toast) ────────────────
console.log('[Test 5] Testing Feedback & Notifications (Badge, LoadingSpinner, Toast)...');
const badge = Badge({ label: 'BESTSELLER', color: '#10b981' });
assert.ok(badge.renderToHTML().includes('BESTSELLER'));

const spinner = LoadingSpinner({ message: 'Compiling app...' });
assert.ok(spinner.renderToHTML().includes('Compiling app...'));
assert.ok(spinner.renderToHTML().includes('olto-spinner'));

Toast.clear();
Toast.show('Enrolled successfully!', { type: 'success' });
const activeToasts = Toast.getActive();
assert.strictEqual(activeToasts.length, 1);
assert.strictEqual(activeToasts[0].message, 'Enrolled successfully!');
assert.strictEqual(activeToasts[0].type, 'success');
console.log('  ✓ Badge tags, Loading spinners, and Toast notifications verified.\n');

// ── Test 6: Declarative Theme Switching (Dark & Light Mode) ─────────────────
console.log('[Test 6] Testing Theme Manager & Mode Switching...');
Theme.setMode('dark');
assert.strictEqual(Theme.mode.get(), 'dark');
assert.strictEqual(Theme.colors.background, DarkTheme.background);

Theme.toggle();
assert.strictEqual(Theme.mode.get(), 'light');
assert.strictEqual(Theme.colors.background, LightTheme.background);

Theme.toggle();
assert.strictEqual(Theme.mode.get(), 'dark');
console.log('  ✓ Dark/Light theme switching verified.\n');

console.log('================================================================================');
console.log('  ALL 6 OLTO COMPONENT LIBRARY TEST SUITES PASSED (100%)');
console.log('================================================================================');
