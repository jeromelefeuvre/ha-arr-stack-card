// Counts the colours a source file writes out instead of reading a design
// token (#42). Shared by the test and by the script that writes its baseline.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Comments name colours in prose; a var() fallback is the colour a token
// replaces, which is how a tokenised colour is meant to look.
export function countColorLiterals(text) {
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
    .replace(/var\(--[\w-]+,\s*#[0-9a-fA-F]{3,8}\b/g, '');
  return (code.match(/rgba?\(\s*\d[^)]*\)|(?<![/\w&])#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?(?![\w-])/g) || []).length;
}

function walk(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}

export function colorLiteralCounts(root) {
  const out = {};
  // The editor draws Home Assistant's own UI, not the card, and its swatches
  // show each token's default colour by design.
  for (const file of walk(join(root, 'src')).sort().filter(f => !/[/\\]editor[\w-]*\.js$/.test(f))) {
    const n = countColorLiterals(readFileSync(file, 'utf8'));
    if (n) out[relative(root, file)] = n;
  }
  return out;
}
