/**
 * Unit tests for ops-simulate and ops-health Netlify functions.
 *
 * Run with: node tests/ops-functions.test.js
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
    console.error(`  ✗ ${label}  (expected ${expected}, got ${actual})`);
  }
}

// ── ops-simulate ──────────────────────────────────────

console.log('\n── ops-simulate ──');

const simulate = require('../netlify/functions/ops-simulate');

async function testSimulate() {
  // POST returns 200 with valid input
  const r1 = await simulate.handler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({
      traffic: 10000, cpc: 0.08, clickRate: 12,
      convRate: 4, aov: 28, commission: 10, bonus: 0
    })
  });
  assertEqual(r1.statusCode, 200, 'POST returns 200');
  const body1 = JSON.parse(r1.body);
  assert(body1.ok === true, 'response ok=true');
  assert(typeof body1.expectedRevenue === 'number', 'expectedRevenue is number');
  assert(typeof body1.expectedCost === 'number', 'expectedCost is number');
  assert(typeof body1.expectedProfit === 'number', 'expectedProfit is number');
  assert(typeof body1.breakevenCpc === 'number', 'breakevenCpc is number');
  assertEqual(body1.expectedCost, 800, 'cost = traffic * cpc');

  // GET returns 405
  const r2 = await simulate.handler({
    httpMethod: 'GET',
    headers: {},
    body: ''
  });
  assertEqual(r2.statusCode, 405, 'GET returns 405');

  // Invalid JSON returns 400
  const r3 = await simulate.handler({
    httpMethod: 'POST',
    headers: {},
    body: 'bad json'
  });
  assertEqual(r3.statusCode, 400, 'bad JSON returns 400');

  // Empty body returns 200 (all zeros)
  const r4 = await simulate.handler({
    httpMethod: 'POST',
    headers: {},
    body: '{}'
  });
  assertEqual(r4.statusCode, 200, 'empty input returns 200');
  const body4 = JSON.parse(r4.body);
  assertEqual(body4.expectedCost, 0, 'empty input cost is 0');
}

// ── ops-health ────────────────────────────────────────

console.log('\n── ops-health ──');

const health = require('../netlify/functions/ops-health');

async function testHealth() {
  // OPTIONS returns 204
  const r1 = await health.handler({
    httpMethod: 'OPTIONS',
    headers: {}
  });
  assertEqual(r1.statusCode, 204, 'OPTIONS returns 204');

  // GET returns 200 (no Supabase = graceful fallback)
  const r2 = await health.handler({
    httpMethod: 'GET',
    headers: {}
  });
  assertEqual(r2.statusCode, 200, 'GET returns 200');
  const body = JSON.parse(r2.body);
  assert(typeof body.pixelDetected === 'boolean', 'pixelDetected is boolean');
  assert(typeof body.dbOk === 'boolean', 'dbOk is boolean');
  assert(typeof body.clickTemuCount24h === 'number', 'clickTemuCount24h is number');

  // POST returns 405
  const r3 = await health.handler({
    httpMethod: 'POST',
    headers: {}
  });
  assertEqual(r3.statusCode, 405, 'POST returns 405');
}

// ── Run ───────────────────────────────────────────────

(async () => {
  await testSimulate();
  await testHealth();
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
