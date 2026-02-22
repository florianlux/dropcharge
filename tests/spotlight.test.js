/**
 * Unit tests for spotlight-create and spotlight-autofill serverless functions.
 *
 * Run with: node tests/spotlight.test.js
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

// ── spotlight-create ──────────────────────────────────────

// We can't call the handler directly without Supabase, but we can test
// validation paths by setting hasSupabase = false (no env vars set).
console.log('\nspotlight-create validation');

// Remove env vars to ensure Supabase is not configured
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE;
// Disable admin auth so we can test other paths
process.env.ADMIN_TOKEN = '';

// We need fresh requires so the supabase module picks up the missing env
delete require.cache[require.resolve('../netlify/functions/_lib/supabase')];
delete require.cache[require.resolve('../netlify/functions/_lib/admin-token')];
delete require.cache[require.resolve('../netlify/functions/spotlight-create')];

const { handler: createHandler } = require('../netlify/functions/spotlight-create');

(async () => {
  // OPTIONS returns 204 (CORS preflight handled by withCors)
  {
    const res = await createHandler({ httpMethod: 'OPTIONS', headers: {} });
    assertEqual(res.statusCode, 204, 'OPTIONS returns 204');
  }

  // POST without supabase returns 500 with supabase_not_configured
  {
    const res = await createHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ title: 'Test', affiliate_url: 'https://example.com' })
    });
    const body = JSON.parse(res.body);
    assertEqual(res.statusCode, 500, 'POST without supabase returns 500');
    assertEqual(body.error, 'supabase_not_configured', 'error is supabase_not_configured');
    assert(body.details && body.details.hint, 'includes details.hint');
  }

  // GET without supabase returns 500
  {
    const res = await createHandler({
      httpMethod: 'GET',
      headers: {},
    });
    const body = JSON.parse(res.body);
    assertEqual(res.statusCode, 500, 'GET without supabase returns 500');
  }

  // Unsupported method returns 500 when supabase is not configured
  // (supabase check happens before method routing)
  {
    const res = await createHandler({
      httpMethod: 'PATCH',
      headers: {},
    });
    const body = JSON.parse(res.body);
    assertEqual(res.statusCode, 500, 'PATCH without supabase returns 500');
    assertEqual(body.error, 'supabase_not_configured', 'error is supabase_not_configured');
  }

  // ── spotlight-autofill ──────────────────────────────────

  console.log('\nspotlight-autofill validation');

  delete require.cache[require.resolve('../netlify/functions/spotlight-autofill')];
  const { handler: autofillHandler } = require('../netlify/functions/spotlight-autofill');

  // Missing URL returns 400
  {
    const res = await autofillHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({})
    });
    const body = JSON.parse(res.body);
    assertEqual(res.statusCode, 400, 'missing url returns 400');
    assertEqual(body.error, 'url_required', 'error is url_required');
  }

  // Accepts affiliate_url field
  {
    const res = await autofillHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ affiliate_url: 'ftp://invalid' })
    });
    const body = JSON.parse(res.body);
    // ftp:// should be rejected as invalid protocol
    assertEqual(res.statusCode, 400, 'ftp protocol returns 400');
    assertEqual(body.error, 'invalid_protocol', 'error is invalid_protocol');
  }

  // Accepts url field with invalid URL
  {
    const res = await autofillHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ url: 'not-a-url' })
    });
    const body = JSON.parse(res.body);
    assertEqual(res.statusCode, 400, 'invalid url returns 400');
    assertEqual(body.error, 'invalid_url', 'error is invalid_url');
  }

  // Invalid JSON returns 400
  {
    const res = await autofillHandler({
      httpMethod: 'POST',
      headers: {},
      body: 'not json'
    });
    const body = JSON.parse(res.body);
    assertEqual(res.statusCode, 400, 'invalid json returns 400');
    assertEqual(body.error, 'invalid_json', 'error is invalid_json');
  }

  // Wrong method returns 405
  {
    const res = await autofillHandler({
      httpMethod: 'GET',
      headers: {},
    });
    const body = JSON.parse(res.body);
    assertEqual(res.statusCode, 405, 'GET returns 405');
    assertEqual(body.error, 'method_not_allowed', 'error is method_not_allowed');
  }

  // SSRF — blocked private IP
  {
    const res = await autofillHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ url: 'http://localhost/admin' })
    });
    const body = JSON.parse(res.body);
    assertEqual(res.statusCode, 502, 'localhost fetch returns 502');
    assertEqual(body.error, 'fetch_failed', 'error is fetch_failed');
  }

  // ── Summary ──────────────────────────────────────────
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
