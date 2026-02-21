/**
 * Unit tests for newsletter_signup Netlify function.
 *
 * Mocks the Supabase client so we can exercise every handler path
 * without needing a live database.
 *
 * Run:  node tests/newsletter_signup.test.js
 *   or: npm run test:unit
 */

const assert = require('node:assert/strict');
const { test, describe, beforeEach, mock } = require('node:test');
const path = require('node:path');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Build a minimal Netlify-function event object. */
function makeEvent({ method = 'POST', body, headers = {} } = {}) {
  return {
    httpMethod: method,
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : body != null ? JSON.stringify(body) : undefined,
  };
}

function parseBody(res) {
  return JSON.parse(res.body);
}

// ---------------------------------------------------------------------------
// mock wiring
// ---------------------------------------------------------------------------

/**
 * We need to intercept the Supabase module *before* newsletter_signup.js
 * is required, because the module-level require caches the client.
 *
 * Strategy: pre-populate the require cache for _lib/supabase.js with a
 * mock that we control per-test.
 */
const supabaseMockPath = require.resolve(
  path.join(__dirname, '..', 'netlify', 'functions', '_lib', 'supabase.js')
);

let insertResult = { error: null };  // default: successful insert

const mockSupabase = {
  from: (_table) => ({
    insert: async (_row) => insertResult,
  }),
};

// Pre-fill the require cache so newsletter_signup sees our mock.
require.cache[supabaseMockPath] = {
  id: supabaseMockPath,
  filename: supabaseMockPath,
  loaded: true,
  exports: {
    supabase: mockSupabase,
    hasSupabase: true,
    supabaseUrlPresent: true,
    supabaseServiceKeyPresent: true,
    verifyConnection: async () => ({ ok: true }),
  },
};

// Now require the function under test (it will pick up the cached mock).
const { handler } = require('../netlify/functions/newsletter_signup');

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('newsletter_signup handler', () => {
  beforeEach(() => {
    // Reset the mock insert result before each test.
    insertResult = { error: null };

    // Ensure RESEND_API_KEY is absent so we don't attempt real emails.
    delete process.env.RESEND_API_KEY;
  });

  // ---- CORS / OPTIONS ---------------------------------------------------

  test('OPTIONS returns 200 with CORS headers', async () => {
    const res = await handler(makeEvent({ method: 'OPTIONS' }));
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers['Access-Control-Allow-Methods']);
  });

  // ---- Method check ------------------------------------------------------

  test('GET returns 405', async () => {
    const res = await handler(makeEvent({ method: 'GET' }));
    assert.equal(res.statusCode, 405);
    const data = parseBody(res);
    assert.equal(data.ok, false);
  });

  // ---- Invalid payloads --------------------------------------------------

  test('POST with invalid JSON returns 400', async () => {
    const res = await handler(makeEvent({ body: '{bad json' }));
    assert.equal(res.statusCode, 400);
    const data = parseBody(res);
    assert.equal(data.ok, false);
    assert.match(data.error, /Invalid JSON/i);
  });

  test('POST with empty email returns 400 invalid_email', async () => {
    const res = await handler(makeEvent({ body: { email: '' } }));
    assert.equal(res.statusCode, 400);
    const data = parseBody(res);
    assert.equal(data.error, 'invalid_email');
  });

  test('POST with malformed email returns 400 invalid_email', async () => {
    const res = await handler(makeEvent({ body: { email: 'not-an-email' } }));
    assert.equal(res.statusCode, 400);
    const data = parseBody(res);
    assert.equal(data.error, 'invalid_email');
  });

  // ---- Happy path: new subscriber ----------------------------------------

  test('POST with valid email inserts and returns ok:true, status:inserted', async () => {
    const res = await handler(makeEvent({
      body: { email: 'test@example.com', source: 'popup' }
    }));
    assert.equal(res.statusCode, 200);
    const data = parseBody(res);
    assert.equal(data.ok, true);
    assert.equal(data.status, 'inserted');
    assert.equal(data.message, 'Subscribed');
  });

  test('Email is lowercased and trimmed', async () => {
    let capturedRow = null;
    mockSupabase.from = (_table) => ({
      insert: async (row) => { capturedRow = row; return { error: null }; },
    });

    await handler(makeEvent({ body: { email: '  Test@Example.COM  ' } }));
    assert.equal(capturedRow.email, 'test@example.com');

    // Restore default mock
    mockSupabase.from = (_table) => ({
      insert: async (_row) => insertResult,
    });
  });

  test('UTM parameters are forwarded to the insert row', async () => {
    let capturedRow = null;
    mockSupabase.from = (_table) => ({
      insert: async (row) => { capturedRow = row; return { error: null }; },
    });

    await handler(makeEvent({
      body: {
        email: 'utm@example.com',
        source: 'popup',
        utm: { utm_source: 'tiktok', utm_campaign: 'launch' },
      }
    }));

    assert.equal(capturedRow.utm_source, 'tiktok');
    assert.equal(capturedRow.utm_campaign, 'launch');
    assert.equal(capturedRow.source, 'popup');

    mockSupabase.from = (_table) => ({
      insert: async (_row) => insertResult,
    });
  });

  // ---- Duplicate handling ------------------------------------------------

  test('Duplicate email (code 23505) returns ok:true, status:exists', async () => {
    insertResult = { error: { message: 'duplicate key value violates unique constraint', code: '23505' } };

    const res = await handler(makeEvent({
      body: { email: 'dup@example.com' }
    }));
    assert.equal(res.statusCode, 200);
    const data = parseBody(res);
    assert.equal(data.ok, true);
    assert.equal(data.status, 'exists');
  });

  test('Duplicate email (message contains "unique") returns ok:true', async () => {
    insertResult = { error: { message: 'unique constraint violated' } };

    const res = await handler(makeEvent({
      body: { email: 'dup2@example.com' }
    }));
    assert.equal(res.statusCode, 200);
    const data = parseBody(res);
    assert.equal(data.ok, true);
    assert.equal(data.status, 'exists');
  });

  // ---- Non-duplicate DB error --------------------------------------------

  test('Non-duplicate DB error returns 500 with details', async () => {
    insertResult = { error: { message: 'connection refused', code: 'XX000' } };

    const res = await handler(makeEvent({
      body: { email: 'fail@example.com' }
    }));
    assert.equal(res.statusCode, 500);
    const data = parseBody(res);
    assert.equal(data.ok, false);
    assert.match(data.error, /Subscription failed/i);
    assert.ok(data.details);
  });

  // ---- Supabase not configured -------------------------------------------

  test('Returns 500 when Supabase is not configured', async () => {
    // Temporarily make hasSupabase false
    const cached = require.cache[supabaseMockPath];
    cached.exports.hasSupabase = false;

    const res = await handler(makeEvent({
      body: { email: 'noconfig@example.com' }
    }));
    assert.equal(res.statusCode, 500);
    const data = parseBody(res);
    assert.equal(data.ok, false);
    assert.match(data.error, /Server not configured/i);

    // Restore
    cached.exports.hasSupabase = true;
  });

  // ---- CORS headers on success -------------------------------------------

  test('Success response includes CORS headers', async () => {
    const res = await handler(makeEvent({
      body: { email: 'cors@example.com' }
    }));
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers['Access-Control-Allow-Origin']);
  });

  // ---- Frontend-compatibility contract -----------------------------------

  test('Frontend contract: res.ok + data.ok + data.status works for success', async () => {
    const res = await handler(makeEvent({
      body: { email: 'contract@example.com', source: 'popup' }
    }));

    // Simulate what app.js does:
    const isHttpOk = res.statusCode >= 200 && res.statusCode < 300;
    const data = JSON.parse(res.body);
    const frontendSuccess = isHttpOk && data.ok;
    const status = data.status || 'inserted';

    assert.ok(frontendSuccess, 'Frontend should treat this as success');
    assert.equal(status, 'inserted', 'New subscriber gets "inserted" status');
  });

  test('Frontend contract: duplicate shows "already subscribed" message', async () => {
    insertResult = { error: { message: 'duplicate key', code: '23505' } };

    const res = await handler(makeEvent({
      body: { email: 'dup-contract@example.com' }
    }));

    const isHttpOk = res.statusCode >= 200 && res.statusCode < 300;
    const data = JSON.parse(res.body);
    const frontendSuccess = isHttpOk && data.ok;
    const status = data.status || 'inserted';

    assert.ok(frontendSuccess, 'Frontend should treat duplicate as success');
    assert.equal(status, 'exists', 'Duplicate subscriber gets "exists" status');
  });

  test('Frontend contract: error triggers catch branch', async () => {
    insertResult = { error: { message: 'connection refused', code: 'XX000' } };

    const res = await handler(makeEvent({
      body: { email: 'err-contract@example.com' }
    }));

    const isHttpOk = res.statusCode >= 200 && res.statusCode < 300;
    const data = JSON.parse(res.body);
    const frontendSuccess = isHttpOk && data.ok;

    assert.ok(!frontendSuccess, 'Frontend should treat this as failure and show alert');
  });
});
