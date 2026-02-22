/**
 * Unit tests for the drops data & go.js integration.
 *
 * Run with: node tests/drops.test.js
 */

const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

// ── drops.json structure ──────────────────────────────
console.log('\ndrops.json structure');

const drops = require('../drops.json');

assert(Array.isArray(drops), 'drops.json is an array');
assertEqual(drops.length, 4, 'drops.json contains 4 entries');

const requiredIds = ['nintendo15', 'psn20', 'xbox3m', 'steam20'];
const dropIds = drops.map(d => d.id);
for (const id of requiredIds) {
  assert(dropIds.includes(id), `drop "${id}" exists`);
}

// ── drops.json fields ─────────────────────────────────
console.log('\ndrops.json fields');

for (const drop of drops) {
  assert(typeof drop.id === 'string' && drop.id.length > 0, `drop ${drop.id} has id`);
  assert(typeof drop.title === 'string' && drop.title.length > 0, `drop ${drop.id} has title`);
  assert(typeof drop.platform === 'string' && drop.platform.length > 0, `drop ${drop.id} has platform`);
  assert(typeof drop.value_eur === 'number' && drop.value_eur > 0, `drop ${drop.id} has value_eur`);
  assert(typeof drop.destination_url === 'string' && drop.destination_url.startsWith('https://'), `drop ${drop.id} has valid destination_url`);
  assert(typeof drop.active === 'boolean', `drop ${drop.id} has active flag`);
  assert(typeof drop.featured === 'boolean', `drop ${drop.id} has featured flag`);
  assert(typeof drop.sort_order === 'number', `drop ${drop.id} has sort_order`);
}

// ── drops destination URLs ────────────────────────────
console.log('\ndrops destination URLs');

const dropMap = Object.fromEntries(drops.map(d => [d.id, d]));

assertEqual(
  dropMap.nintendo15.destination_url,
  'https://www.g2a.com/n/nintendo15_lux',
  'nintendo15 destination matches spec'
);
assertEqual(
  dropMap.psn20.destination_url,
  'https://www.g2a.com/n/psn5_lux',
  'psn20 destination matches spec'
);
assertEqual(
  dropMap.xbox3m.destination_url,
  'https://www.g2a.com/n/xbox_lux1',
  'xbox3m destination matches spec'
);
assertEqual(
  dropMap.steam20.destination_url,
  'https://www.g2a.com/n/reanimalux',
  'steam20 destination matches spec'
);

// ── G2A URL normalization with drops ──────────────────
console.log('\nG2A normalization on drop URLs');

const { normalizeG2AReflink } = require('../netlify/functions/_lib/affiliates');
const GTAG = 'e5d2fce463';

for (const drop of drops) {
  const normalized = normalizeG2AReflink(drop.destination_url, GTAG);
  assert(normalized.includes(`gtag=${GTAG}`), `drop ${drop.id} URL gets gtag appended`);
  assert(!normalized.includes('gtag=old'), `drop ${drop.id} URL has no old gtag`);
}

// ── drops sort order ──────────────────────────────────
console.log('\ndrops sort order');

const sorted = [...drops].sort((a, b) => a.sort_order - b.sort_order);
assertEqual(sorted[0].id, 'nintendo15', 'nintendo15 is first by sort_order');
assertEqual(sorted[1].id, 'psn20', 'psn20 is second by sort_order');
assertEqual(sorted[2].id, 'xbox3m', 'xbox3m is third by sort_order');
assertEqual(sorted[3].id, 'steam20', 'steam20 is fourth by sort_order');

// ── all drops are active and featured ─────────────────
console.log('\ndrops active and featured');

for (const drop of drops) {
  assert(drop.active === true, `drop ${drop.id} is active`);
  assert(drop.featured === true, `drop ${drop.id} is featured`);
}

// ── Summary ───────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
