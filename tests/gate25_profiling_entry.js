/**
 * GATE 25 — Continuous Learning Research: Profiling Entry Point
 *
 * Start here. Uses createRequire to load the CommonJS compiled dist
 * files from within the ESM package. Then runs the profiling logic.
 *
 * Run via: node tests/gate25_profiling_entry.js
 */
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

// Create a CJS require function bound to this module's URL
const require = createRequire(import.meta.url);

// Load compiled dist files (CommonJS)
const ReasoningEngine = require('./dist/one/intelligence/reasoning/ReasoningEngine.js');
const types = require('./dist/one/intelligence/reasoning/types.js');
const ReasoningStatus = types.ReasoningStatus;
const ReasoningPolicy = types.ReasoningPolicy;

// Run the profiling logic
import('./gate25_profiling_logic.js').then(m => {
  m.runBenchmarks(ReasoningEngine, ReasoningStatus, ReasoningPolicy);
}).catch(err => {
  console.error('Failed to run profiling:', err);
  process.exit(1);
});
