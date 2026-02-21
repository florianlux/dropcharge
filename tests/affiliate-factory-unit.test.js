/**
 * Unit tests for affiliate-factory URL validation and slug generation
 * Run with: node tests/affiliate-factory-unit.test.js
 */

// Helper functions extracted from affiliate-factory.js for testing
function slugify(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 72) || null
}

function coerceUrl(raw = '') {
  try {
    const url = new URL(raw)
    // Only allow http and https protocols for security
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url
  } catch (err) {
    return null
  }
}

function buildAffiliateUrl(productUrl, networkKey, trackerId, utmParams = {}) {
  const NETWORKS = {
    amazon: {
      label: 'Amazon',
      trackerParam: 'tag',
      defaultTracker: 'dropcharge-21'
    },
    g2a: {
      label: 'G2A',
      trackerParam: null
    },
    custom: {
      label: 'Custom',
      trackerParam: null
    }
  }
  
  const network = NETWORKS[networkKey] || NETWORKS.custom
  const parsed = coerceUrl(productUrl)
  if (!parsed) return null
  if (network.trackerParam) {
    parsed.searchParams.set(
      network.trackerParam,
      trackerId || network.defaultTracker
    )
  }
  // Add UTM parameters if provided
  if (utmParams.utm_source) parsed.searchParams.set('utm_source', utmParams.utm_source)
  if (utmParams.utm_campaign) parsed.searchParams.set('utm_campaign', utmParams.utm_campaign)
  if (utmParams.utm_medium) parsed.searchParams.set('utm_medium', utmParams.utm_medium)
  return parsed.toString()
}

// Test runner
let testsPassed = 0;
let testsFailed = 0;

function test(description, testFn) {
  try {
    testFn();
    console.log(`✓ ${description}`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${description}`);
    console.error(`  ${error.message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertTruthy(value, message) {
  if (!value) {
    throw new Error(message || `Expected truthy value, got ${value}`);
  }
}

function assertFalsy(value, message) {
  if (value) {
    throw new Error(message || `Expected falsy value, got ${value}`);
  }
}

function assertContains(str, substring, message) {
  if (!str || !str.includes(substring)) {
    throw new Error(message || `Expected "${str}" to contain "${substring}"`);
  }
}

// Test Suite
console.log('\n=== URL Validation Tests ===\n');

test('coerceUrl accepts valid HTTP URL', () => {
  const result = coerceUrl('http://example.com');
  assertTruthy(result, 'Should return URL object');
  assertEqual(result.protocol, 'http:');
});

test('coerceUrl accepts valid HTTPS URL', () => {
  const result = coerceUrl('https://example.com');
  assertTruthy(result);
  assertEqual(result.protocol, 'https:');
});

test('coerceUrl accepts URL with path', () => {
  const result = coerceUrl('https://example.com/product/123');
  assertTruthy(result);
  assertEqual(result.pathname, '/product/123');
});

test('coerceUrl accepts URL with query params', () => {
  const result = coerceUrl('https://example.com/product?id=123&ref=abc');
  assertTruthy(result);
  assertContains(result.href, 'id=123');
});

test('coerceUrl accepts URL with port', () => {
  const result = coerceUrl('https://example.com:8080/product');
  assertTruthy(result);
  assertEqual(result.port, '8080');
});

test('coerceUrl rejects malformed URL', () => {
  const result = coerceUrl('not-a-valid-url');
  assertFalsy(result, 'Should return null for invalid URL');
});

test('coerceUrl rejects URL without protocol', () => {
  const result = coerceUrl('example.com');
  assertFalsy(result);
});

test('coerceUrl rejects empty string', () => {
  const result = coerceUrl('');
  assertFalsy(result);
});

test('coerceUrl rejects javascript: protocol', () => {
  const result = coerceUrl('javascript:alert(1)');
  assertFalsy(result, 'Should reject javascript: protocol for security');
});

test('coerceUrl rejects FTP protocol', () => {
  const result = coerceUrl('ftp://example.com');
  assertFalsy(result, 'Should reject FTP protocol, only HTTP(S) allowed');
});

console.log('\n=== Slug Generation Tests ===\n');

test('slugify converts to lowercase', () => {
  const result = slugify('Test Product');
  assertEqual(result, 'test-product');
});

test('slugify replaces spaces with hyphens', () => {
  const result = slugify('My Test Product');
  assertEqual(result, 'my-test-product');
});

test('slugify removes special characters', () => {
  const result = slugify('Test!@#$%Product');
  assertEqual(result, 'test-product');
});

test('slugify handles German umlauts', () => {
  const result = slugify('Über Produkt');
  assertEqual(result, 'ber-produkt');
});

test('slugify removes leading and trailing hyphens', () => {
  const result = slugify('  Test Product  ');
  assertEqual(result, 'test-product');
});

test('slugify handles multiple consecutive spaces', () => {
  const result = slugify('Test    Product');
  assertEqual(result, 'test-product');
});

test('slugify truncates to 72 characters', () => {
  const longString = 'a'.repeat(100);
  const result = slugify(longString);
  assertEqual(result.length, 72);
});

test('slugify returns null for empty string', () => {
  const result = slugify('');
  assertEqual(result, null);
});

test('slugify returns null for only special characters', () => {
  const result = slugify('!!!@@@###');
  assertEqual(result, null);
});

console.log('\n=== Affiliate URL Building Tests ===\n');

test('buildAffiliateUrl adds Amazon tag for amazon network', () => {
  const result = buildAffiliateUrl('https://amazon.com/product', 'amazon', 'custom-tag-21');
  assertTruthy(result);
  assertContains(result, 'tag=custom-tag-21');
});

test('buildAffiliateUrl uses default Amazon tag if not provided', () => {
  const result = buildAffiliateUrl('https://amazon.com/product', 'amazon');
  assertTruthy(result);
  assertContains(result, 'tag=dropcharge-21');
});

test('buildAffiliateUrl does not modify custom network URLs', () => {
  const result = buildAffiliateUrl('https://example.com/product', 'custom');
  assertEqual(result, 'https://example.com/product');
});

test('buildAffiliateUrl adds UTM source', () => {
  const result = buildAffiliateUrl('https://example.com/product', 'custom', null, {
    utm_source: 'tiktok'
  });
  assertContains(result, 'utm_source=tiktok');
});

test('buildAffiliateUrl adds UTM campaign', () => {
  const result = buildAffiliateUrl('https://example.com/product', 'custom', null, {
    utm_campaign: 'winter-sale'
  });
  assertContains(result, 'utm_campaign=winter-sale');
});

test('buildAffiliateUrl adds UTM medium', () => {
  const result = buildAffiliateUrl('https://example.com/product', 'custom', null, {
    utm_medium: 'social'
  });
  assertContains(result, 'utm_medium=social');
});

test('buildAffiliateUrl adds all UTM parameters', () => {
  const result = buildAffiliateUrl('https://example.com/product', 'custom', null, {
    utm_source: 'tiktok',
    utm_campaign: 'winter-sale',
    utm_medium: 'social'
  });
  assertContains(result, 'utm_source=tiktok');
  assertContains(result, 'utm_campaign=winter-sale');
  assertContains(result, 'utm_medium=social');
});

test('buildAffiliateUrl preserves existing query parameters', () => {
  const result = buildAffiliateUrl('https://example.com/product?existing=param', 'custom', null, {
    utm_source: 'test'
  });
  assertContains(result, 'existing=param');
  assertContains(result, 'utm_source=test');
});

test('buildAffiliateUrl combines affiliate tag with UTM params for Amazon', () => {
  const result = buildAffiliateUrl('https://amazon.com/product', 'amazon', 'test-21', {
    utm_source: 'tiktok',
    utm_campaign: 'promo'
  });
  assertContains(result, 'tag=test-21');
  assertContains(result, 'utm_source=tiktok');
  assertContains(result, 'utm_campaign=promo');
});

test('buildAffiliateUrl returns null for invalid URL', () => {
  const result = buildAffiliateUrl('not-a-url', 'custom');
  assertFalsy(result);
});

// Summary
console.log('\n=== Test Summary ===\n');
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log(`Total tests: ${testsPassed + testsFailed}\n`);

process.exit(testsFailed > 0 ? 1 : 0);
