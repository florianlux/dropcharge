const { requireAdmin } = require('./_lib/admin-token');
const { fetchSettings, upsertSettings } = require('./_lib/settings');
const { isSchemaError, schemaMismatchResponse } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

async function handleGet() {
  const map = await fetchSettings();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: true, settings: map })
  };
}

async function handlePut(event) {
  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }

  const updates = payload.updates || payload;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_payload' }) };
  }

  if (updates.flags && typeof updates.flags === 'object' && !Array.isArray(updates.flags)) {
    const current = await fetchSettings(['flags']);
    updates.flags = { ...(current.flags || {}), ...updates.flags };
  }

  await upsertSettings(updates);
  const fresh = await fetchSettings();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: true, settings: fresh })
  };
}

async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  try {
    if (event.httpMethod === 'GET') {
      return await handleGet();
    }
    if (event.httpMethod === 'PUT' || event.httpMethod === 'POST') {
      return await handlePut(event);
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    if (isSchemaError(err)) return schemaMismatchResponse(err);
    console.log('settings handler error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

exports.handler = withCors(handler);
