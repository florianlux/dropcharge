/**
 * Unit tests for netlify/functions/_lib/affiliates.js
 *
 * Run with: node tests/affiliates.test.js
 */

const {
  isG2AUrl,
  normalizeG2AReflink,
  normalizeDealUrlByProvider
} = require('../netlify/functions/_lib/affiliates');

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

// ── isG2AUrl ───────────────────────────────────────────
console.log('\nisG2AUrl');
assert(isG2AUrl('https://www.g2a.com/some-product') === true, 'www.g2a.com');
assert(isG2AUrl('https://g2a.com/item') === true, 'g2a.com');
assert(isG2AUrl('https://shop.g2a.com/deal') === true, 'subdomain *.g2a.com');
assert(isG2AUrl('g2a.com/no-scheme') === true, 'no scheme');
assert(isG2AUrl('https://amazon.com/item') === false, 'amazon.com');
assert(isG2AUrl('') === false, 'empty string');
assert(isG2AUrl(null) === false, 'null input');
assert(isG2AUrl(undefined) === false, 'undefined input');
assert(isG2AUrl('not a url at all') === false, 'garbage input');
assert(isG2AUrl('https://notg2a.com/foo') === false, 'notg2a.com');

// ── normalizeG2AReflink ────────────────────────────────
console.log('\nnormalizeG2AReflink');

// adds gtag when missing
assertEqual(
  normalizeG2AReflink('https://www.g2a.com/n/psn5_lux', 'e5d2fce463'),
  'https://www.g2a.com/n/psn5_lux?gtag=e5d2fce463',
  'adds gtag when missing'
);

// replaces existing gtag
assertEqual(
  normalizeG2AReflink('https://www.g2a.com/n/psn5_lux?gtag=old123', 'e5d2fce463'),
  'https://www.g2a.com/n/psn5_lux?gtag=e5d2fce463',
  'replaces existing gtag'
);

// preserves other params
assertEqual(
  normalizeG2AReflink('https://www.g2a.com/item?currency=EUR&gtag=old', 'e5d2fce463'),
  'https://www.g2a.com/item?currency=EUR&gtag=e5d2fce463',
  'preserves other params'
);

// preserves hash fragment
assertEqual(
  normalizeG2AReflink('https://www.g2a.com/item#reviews', 'e5d2fce463'),
  'https://www.g2a.com/item?gtag=e5d2fce463#reviews',
  'preserves hash fragment'
);

// preserves hash + other params
assertEqual(
  normalizeG2AReflink('https://www.g2a.com/item?ref=abc#top', 'e5d2fce463'),
  'https://www.g2a.com/item?ref=abc&gtag=e5d2fce463#top',
  'preserves hash + other params'
);

// handles missing scheme
{
  const result = normalizeG2AReflink('www.g2a.com/product', 'e5d2fce463');
  assert(result.includes('gtag=e5d2fce463'), 'handles missing scheme – gtag present');
  assert(!result.startsWith('https://'), 'handles missing scheme – scheme not added');
}

// leaves non-g2a unchanged
assertEqual(
  normalizeG2AReflink('https://amazon.com/item', 'e5d2fce463'),
  'https://amazon.com/item',
  'leaves non-g2a unchanged'
);

// handles empty/null input (no throw)
assertEqual(
  normalizeG2AReflink('', 'e5d2fce463'),
  '',
  'handles empty string'
);
assertEqual(
  normalizeG2AReflink(null, 'e5d2fce463'),
  '',
  'handles null'
);
assertEqual(
  normalizeG2AReflink(undefined, 'e5d2fce463'),
  '',
  'handles undefined'
);

// no gtag provided — returns as-is
assertEqual(
  normalizeG2AReflink('https://www.g2a.com/item', ''),
  'https://www.g2a.com/item',
  'no gtag returns as-is'
);
assertEqual(
  normalizeG2AReflink('https://www.g2a.com/item', null),
  'https://www.g2a.com/item',
  'null gtag returns as-is'
);

// whitespace trimming
assertEqual(
  normalizeG2AReflink('  https://www.g2a.com/item  ', 'e5d2fce463'),
  'https://www.g2a.com/item?gtag=e5d2fce463',
  'trims whitespace'
);

// ── normalizeDealUrlByProvider ─────────────────────────
console.log('\nnormalizeDealUrlByProvider');

assertEqual(
  normalizeDealUrlByProvider('https://www.g2a.com/item', 'g2a', { G2A_GTAG: 'e5d2fce463' }),
  'https://www.g2a.com/item?gtag=e5d2fce463',
  'g2a provider with env'
);

assertEqual(
  normalizeDealUrlByProvider('https://www.g2a.com/item', null, { G2A_GTAG: 'e5d2fce463' }),
  'https://www.g2a.com/item?gtag=e5d2fce463',
  'auto-detect g2a without provider hint'
);

assertEqual(
  normalizeDealUrlByProvider('https://amazon.com/item', 'amazon', { G2A_GTAG: 'e5d2fce463' }),
  'https://amazon.com/item',
  'non-g2a URL unchanged'
);

assertEqual(
  normalizeDealUrlByProvider('https://www.g2a.com/item', 'g2a', {}),
  'https://www.g2a.com/item',
  'g2a without G2A_GTAG env returns trimmed'
);

// ── Summary ────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
