/**
 * Unit tests for the Temu performance calculator formulas.
 *
 * Run with: node tests/performance.test.js
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log('  \u2713 ' + label);
  } else {
    failed++;
    console.error('  \u2717 ' + label);
  }
}

function assertClose(actual, expected, label, tolerance) {
  tolerance = tolerance || 0.005;
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
    console.log('  \u2713 ' + label);
  } else {
    failed++;
    console.error('  \u2717 ' + label);
    console.error('    expected: ' + expected);
    console.error('    actual:   ' + actual);
  }
}

// Temu constants
var DOWNLOAD_BONUS = 4;
var COMMISSION_RATE = 0.10;
var AVG_CART = 20;
var REV_PER_CONV = DOWNLOAD_BONUS + (COMMISSION_RATE * AVG_CART);

// ── Revenue per conversion ────────────────────────────
console.log('\nRevenue per conversion');
assertClose(REV_PER_CONV, 6.00, 'Revenue = 4 + 10% * 20 = 6.00 EUR');

// ── Break-Even CPC ───────────────────────────────────
console.log('\nBreak-Even CPC');

var ctr = 0.35;
var cr = 0.08;
var beCPC = ctr * cr * REV_PER_CONV;
assertClose(beCPC, 0.168, 'BE-CPC at 35% CTR, 8% CR = 0.168 EUR');

var ctr2 = 0.50;
var cr2 = 0.10;
var beCPC2 = ctr2 * cr2 * REV_PER_CONV;
assertClose(beCPC2, 0.30, 'BE-CPC at 50% CTR, 10% CR = 0.30 EUR');

// ── Minimum Conversion Rate ─────────────────────────
console.log('\nMinimum Conversion Rate');

var cpc1 = 0.08;
var minCR1 = cpc1 / (ctr * REV_PER_CONV);
assertClose(minCR1, 0.03809, 'Min CR at CPC=0.08, CTR=35% ≈ 3.81%', 0.001);

var cpc2 = 0.25;
var minCR2 = cpc2 / (ctr * REV_PER_CONV);
assertClose(minCR2, 0.11905, 'Min CR at CPC=0.25, CTR=35% ≈ 11.90%', 0.001);

// ── Required ClickTemu Rate ─────────────────────────
console.log('\nRequired ClickTemu Rate');

var minCTR1 = cpc1 / (cr * REV_PER_CONV);
assertClose(minCTR1, 0.16667, 'Min CTR at CPC=0.08, CR=8% ≈ 16.67%', 0.001);

var minCTR2 = cpc2 / (cr * REV_PER_CONV);
assertClose(minCTR2, 0.52083, 'Min CTR at CPC=0.25, CR=8% ≈ 52.08%', 0.001);

// ── Simulation at 1000 clicks ───────────────────────
console.log('\nSimulation: 1000 clicks (CPC=0.08, CTR=35%, CR=8%)');

var clicks = 1000;
var cpc = 0.08;
var adCost = clicks * cpc;
assertClose(adCost, 80.00, 'Ad cost = 80.00 EUR');

var temuClicks = Math.round(clicks * ctr);
assertClose(temuClicks, 350, 'Temu clicks = 350');

var conversions = Math.round(temuClicks * cr);
assertClose(conversions, 28, 'Conversions = 28');

var revenue = conversions * REV_PER_CONV;
assertClose(revenue, 168.00, 'Revenue = 168.00 EUR');

var profit = revenue - adCost;
assertClose(profit, 88.00, 'Profit = 88.00 EUR');
assert(profit > 0, 'Scenario is profitable');

// ── Simulation at 3000 clicks ───────────────────────
console.log('\nSimulation: 3000 clicks (CPC=0.08, CTR=35%, CR=8%)');

var clicks3k = 3000;
var adCost3k = clicks3k * cpc;
assertClose(adCost3k, 240.00, 'Ad cost = 240.00 EUR');

var temuClicks3k = Math.round(clicks3k * ctr);
var conversions3k = Math.round(temuClicks3k * cr);
var revenue3k = conversions3k * REV_PER_CONV;
var profit3k = revenue3k - adCost3k;
assertClose(profit3k, 264.00, 'Profit = 264.00 EUR');
assert(profit3k > 0, 'Scenario is profitable');

// ── Simulation at 10000 clicks ──────────────────────
console.log('\nSimulation: 10000 clicks (CPC=0.08, CTR=35%, CR=8%)');

var clicks10k = 10000;
var adCost10k = clicks10k * cpc;
assertClose(adCost10k, 800.00, 'Ad cost = 800.00 EUR');

var temuClicks10k = Math.round(clicks10k * ctr);
var conversions10k = Math.round(temuClicks10k * cr);
var revenue10k = conversions10k * REV_PER_CONV;
var profit10k = revenue10k - adCost10k;
assertClose(profit10k, 880.00, 'Profit = 880.00 EUR');
assert(profit10k > 0, 'Scenario is profitable');

// ── Edge case: unprofitable scenario ────────────────
console.log('\nEdge case: unprofitable (CPC=0.25, CTR=35%, CR=8%)');

var adCostHigh = 1000 * 0.25;
var revenueHigh = Math.round(1000 * 0.35 * 0.08) * REV_PER_CONV;
var profitHigh = revenueHigh - adCostHigh;
assert(profitHigh < 0, 'High CPC scenario is not profitable');
assertClose(profitHigh, -82.00, 'Loss = -82.00 EUR');

// ── Summary ─────────────────────────────────────────
console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
