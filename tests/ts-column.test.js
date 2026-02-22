/**
 * Unit tests for _lib/ts-column.js
 *
 * Run with: node tests/ts-column.test.js
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

// ── Mock supabase client ──────────────────────────────
function mockSupabase(selectError) {
  return {
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ data: [], error: selectError })
      })
    })
  };
}

// ── Tests ─────────────────────────────────────────────
const { getTimestampColumn, _resetCache } = require('../netlify/functions/_lib/ts-column');

async function run() {
  console.log('\nts-column: returns "ts" when column exists');
  _resetCache();
  const result1 = await getTimestampColumn(mockSupabase(null));
  assertEqual(result1, 'ts', 'returns ts when no error');

  console.log('\nts-column: returns "created_at" on schema error');
  _resetCache();
  const schemaErr = { message: 'column events.ts does not exist' };
  const result2 = await getTimestampColumn(mockSupabase(schemaErr));
  assertEqual(result2, 'created_at', 'returns created_at on schema mismatch');

  console.log('\nts-column: caches result across calls');
  // Don't reset cache – should still return created_at from previous call
  const result3 = await getTimestampColumn(mockSupabase(null));
  assertEqual(result3, 'created_at', 'cached value is returned');

  console.log('\nts-column: returns "created_at" when supabase throws');
  _resetCache();
  const throwingClient = {
    from: () => ({
      select: () => ({
        limit: () => Promise.reject(new Error('network error'))
      })
    })
  };
  const result4 = await getTimestampColumn(throwingClient);
  assertEqual(result4, 'created_at', 'falls back to created_at on exception');

  console.log('\nts-column: returns "ts" for non-schema error');
  _resetCache();
  const nonSchemaErr = { message: 'timeout exceeded' };
  const result5 = await getTimestampColumn(mockSupabase(nonSchemaErr));
  assertEqual(result5, 'ts', 'non-schema errors do not trigger fallback');

  // ── Summary ───────────────────────────────────────
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
