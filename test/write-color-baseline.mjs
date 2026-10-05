// Writes how many colours each source file still writes out instead of reading
// a design token (#42). Run it after removing some, or — for a colour that is
// an identity rather than a theme choice (a brand, a flag, a rating logo) —
// after adding one; the test fails until the baseline matches.
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { colorLiteralCounts } from './color-literals.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const counts = colorLiteralCounts(root);
writeFileSync(new URL('./fixtures/color-baseline.json', import.meta.url), JSON.stringify(counts, null, 2) + '\n');
console.log(`${Object.keys(counts).length} files, ${Object.values(counts).reduce((a, b) => a + b, 0)} colours`);
