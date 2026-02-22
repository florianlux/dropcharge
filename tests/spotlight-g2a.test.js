/**
 * Unit tests for G2A spotlight enhancements:
 * - Platform auto-detect
 * - Region auto-detect
 * - Social proof generation (seeded random)
 *
 * Run with: node tests/spotlight-g2a.test.js
 */

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

// ── Extract functions from spotlight.html inline JS ──
// We replicate the exact functions from spotlight.html to test them in isolation.

function detectPlatform(title) {
  var t = (title || '').toLowerCase();
  if (t.indexOf('steam') !== -1) return 'Steam';
  if (t.indexOf('ps5') !== -1 || t.indexOf('playstation 5') !== -1) return 'PS5';
  if (t.indexOf('ps4') !== -1) return 'PS4';
  if (t.indexOf('xbox series') !== -1) return 'Xbox Series';
  if (t.indexOf('xbox one') !== -1) return 'Xbox One';
  if (t.indexOf('switch') !== -1 || t.indexOf('nintendo') !== -1) return 'Nintendo Switch';
  if (t.indexOf('pc') !== -1) return 'PC';
  return 'PC';
}

function detectRegion(title) {
  var t = (title || '').toLowerCase();
  if (t.indexOf('global') !== -1) return 'GLOBAL';
  if (t.indexOf(' eu') !== -1 || t.indexOf('(eu)') !== -1 || t.indexOf('/eu') !== -1) return 'EU';
  if (t.indexOf(' us') !== -1 || t.indexOf('(us)') !== -1 || t.indexOf('/us') !== -1) return 'US';
  return 'GLOBAL';
}

function platformChipClass(platform) {
  return 'sp-g2a-chip--' + platform.toLowerCase().replace(/\s+/g, '-');
}

function seededRandom(seed) {
  var h = 0;
  for (var i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return function() {
    h = (h * 16807 + 0) % 2147483647;
    if (h < 0) h += 2147483647;
    return (h - 1) / 2147483646;
  };
}

function generateSocialProof(slug) {
  var rng = seededRandom(slug || 'default');
  var rating = (4.4 + rng() * 0.5).toFixed(1);
  var reviews = Math.floor(2000 + rng() * 23000);
  var reviewsStr = reviews >= 1000 ? (reviews / 1000).toFixed(1) + 'k' : String(reviews);
  var purchases = Math.floor(300 + rng() * 1200);
  var stars = '';
  var full = Math.floor(Number(rating));
  for (var i = 0; i < full; i++) stars += '★';
  if (Number(rating) - full >= 0.3) stars += '☆';
  return { rating: rating, reviews: reviewsStr, purchases: purchases, stars: stars };
}

// ── Platform detection tests ──
console.log('\nPlatform auto-detect');

assertEqual(detectPlatform('Elden Ring Steam Key Global'), 'Steam', 'detects Steam from title');
assertEqual(detectPlatform('FIFA 25 PS5 EU'), 'PS5', 'detects PS5 from title');
assertEqual(detectPlatform('God of War PlayStation 5 Global'), 'PS5', 'detects PS5 from "playstation 5"');
assertEqual(detectPlatform('Uncharted PS4 Key'), 'PS4', 'detects PS4 from title');
assertEqual(detectPlatform('Halo Xbox Series Key'), 'Xbox Series', 'detects Xbox Series from title');
assertEqual(detectPlatform('Forza Xbox One Global'), 'Xbox One', 'detects Xbox One from title');
assertEqual(detectPlatform('Zelda Switch Key'), 'Nintendo Switch', 'detects Nintendo Switch from "switch"');
assertEqual(detectPlatform('Mario Kart Nintendo Edition'), 'Nintendo Switch', 'detects Nintendo Switch from "nintendo"');
assertEqual(detectPlatform('Cyberpunk 2077 PC Key'), 'PC', 'detects PC from title');
assertEqual(detectPlatform('Random Game Key'), 'PC', 'defaults to PC when no platform found');
assertEqual(detectPlatform(''), 'PC', 'defaults to PC for empty string');
assertEqual(detectPlatform(null), 'PC', 'defaults to PC for null');
assertEqual(detectPlatform('STEAM KEY'), 'Steam', 'case-insensitive: STEAM');
assertEqual(detectPlatform('xbox SERIES x'), 'Xbox Series', 'case-insensitive: xbox SERIES');

// ── Region detection tests ──
console.log('\nRegion auto-detect');

assertEqual(detectRegion('Elden Ring Steam Key Global'), 'GLOBAL', 'detects GLOBAL from title');
assertEqual(detectRegion('FIFA 25 PS5 EU'), 'EU', 'detects EU from title');
assertEqual(detectRegion('Game Key (EU)'), 'EU', 'detects EU from (EU)');
assertEqual(detectRegion('Game Key US Edition'), 'US', 'detects US from title');
assertEqual(detectRegion('Game Key (US)'), 'US', 'detects US from (US)');
assertEqual(detectRegion('Random Game Key'), 'GLOBAL', 'defaults to GLOBAL when no region found');
assertEqual(detectRegion(''), 'GLOBAL', 'defaults to GLOBAL for empty string');
assertEqual(detectRegion(null), 'GLOBAL', 'defaults to GLOBAL for null');

// ── Platform chip class tests ──
console.log('\nPlatform chip CSS class');

assertEqual(platformChipClass('Steam'), 'sp-g2a-chip--steam', 'Steam chip class');
assertEqual(platformChipClass('PS5'), 'sp-g2a-chip--ps5', 'PS5 chip class');
assertEqual(platformChipClass('Xbox Series'), 'sp-g2a-chip--xbox-series', 'Xbox Series chip class');
assertEqual(platformChipClass('Nintendo Switch'), 'sp-g2a-chip--nintendo-switch', 'Nintendo Switch chip class');
assertEqual(platformChipClass('PC'), 'sp-g2a-chip--pc', 'PC chip class');

// ── Social proof generation tests ──
console.log('\nSocial proof generation');

const proof1 = generateSocialProof('test-game');
const proof2 = generateSocialProof('test-game');
assertEqual(proof1.rating, proof2.rating, 'same slug produces same rating (deterministic)');
assertEqual(proof1.reviews, proof2.reviews, 'same slug produces same reviews (deterministic)');
assertEqual(proof1.purchases, proof2.purchases, 'same slug produces same purchases (deterministic)');

const r = Number(proof1.rating);
assert(r >= 4.4 && r <= 4.9, 'rating is between 4.4 and 4.9');
assert(proof1.purchases >= 300 && proof1.purchases <= 1500, 'purchases between 300 and 1500');
assert(proof1.stars.length > 0, 'stars string is non-empty');
assert(proof1.reviews.indexOf('k') !== -1 || Number(proof1.reviews) >= 2000, 'reviews formatted correctly');

const proof3 = generateSocialProof('different-slug');
assert(proof3.rating !== proof1.rating || proof3.reviews !== proof1.reviews, 'different slug produces different social proof');

// ── Summary ──
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
