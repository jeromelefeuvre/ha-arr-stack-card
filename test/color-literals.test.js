// Colours written out instead of read from a design token (#42). The styling
// options went stale once before because every new feature hard-coded its
// colours; this keeps the count from growing. A file may only go down.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { colorLiteralCounts, countColorLiterals } from './color-literals.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const baseline = JSON.parse(readFileSync(new URL('./fixtures/color-baseline.json', import.meta.url), 'utf8'));

test('no file writes out more colours than it did', () => {
  const now = colorLiteralCounts(root);
  const grew = Object.entries(now)
    .filter(([f, n]) => n > (baseline[f] || 0))
    .map(([f, n]) => `${f}: ${n} colours written out, ${baseline[f] || 0} allowed`);
  assert.deepEqual(grew, [],
    'Read a token from src/styles/tokens.js instead — rgba(var(--_fg, 255, 255, 255), 0.6). '
    + 'A brand or flag colour that has to stay: node test/write-color-baseline.mjs');
});

test('the baseline follows the colours removed', () => {
  const now = colorLiteralCounts(root);
  const stale = Object.entries(baseline)
    .filter(([f, n]) => (now[f] || 0) < n)
    .map(([f, n]) => `${f}: ${now[f] || 0} now, baseline ${n}`);
  assert.deepEqual(stale, [], 'Lock the gain in: node test/write-color-baseline.mjs');
});

test('what counts as a colour written out', () => {
  assert.equal(countColorLiterals('color: rgba(255,255,255,0.5); background: #fff;'), 2);
  assert.equal(countColorLiterals('color: rgba(var(--_fg, 255, 255, 255), 0.5);'), 0);
  assert.equal(countColorLiterals('color: var(--is-text, #fff);'), 0);
  assert.equal(countColorLiterals('/* white is #fff */ // and #000\nx'), 0);
  assert.equal(countColorLiterals("url('https://x.org/#abc') color: #abc;"), 1);
  assert.equal(countColorLiterals('&#8249; id="#top-bar"'), 0);
});
