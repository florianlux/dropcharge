/**
 * Lightweight validation for spotlight.html.
 * Fails with a non-zero exit code if:
 *  - conflict markers are present
 *  - renderSpotlight is declared more than once
 *  - any required renderer function is missing
 *
 * Run with: node scripts/validate-spotlight.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '..', 'spotlight.html');
const src = readFileSync(file, 'utf8');

let errors = 0;

// 1. Check for conflict markers
if (/<<<<<<<|=======|>>>>>>>/.test(src)) {
  console.error('FAIL: conflict markers present in spotlight.html');
  errors++;
}

// 2. Check renderSpotlight is not duplicated
const renderSpotlightCount = (src.match(/function renderSpotlight\s*\(/g) || []).length;
if (renderSpotlightCount > 1) {
  console.error(`FAIL: renderSpotlight declared ${renderSpotlightCount} times (must be exactly 1)`);
  errors++;
}

// 3. Check all required renderer functions exist
const required = [
  'renderSpotlight',
  'renderDefaultSpotlight',
  'renderTemuSpotlight',
  'renderG2A',
];
for (const fn of required) {
  if (!src.includes(`function ${fn}(`)) {
    console.error(`FAIL: missing required renderer function: ${fn}`);
    errors++;
  }
}

if (errors === 0) {
  console.log('OK: spotlight.html validation passed');
  process.exit(0);
} else {
  console.error(`\n${errors} validation error(s) found.`);
  process.exit(1);
}
