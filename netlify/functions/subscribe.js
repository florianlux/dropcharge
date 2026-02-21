async function insertEmailRecord({ email, confirmed, source, meta }) {
  const basePayload = { email, created_at: new Date().toISOString() };
  if (typeof confirmed === 'boolean') basePayload.confirmed = confirmed;
  if (source) basePayload.source = source;
  if (meta && typeof meta === 'object') basePayload.meta = meta;

  const fallbackFields = ['confirmed', 'source', 'meta'];
  let payload = { ...basePayload };

  while (true) {
    const { error } = await supabase.from('emails').insert(payload);
    if (!error) return;
    const message = (error.message || '').toLowerCase();
    const missingField = fallbackFields.find(field => message.includes(field));
    if (missingField && payload[missingField] !== undefined) {
      console.log(`emails table missing ${missingField} column, retrying without it`);
      delete payload[missingField];
      continue;
    }
    throw error;
  }
}

const { supabase, hasSupabase } = require('./_lib/supabase');
const { fetchSettings, extractFlags } = require('./_lib/settings');
const { withCors } = require('./_lib/cors');
const { createSnapshot } = require('./_lib/snapshot-helper');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getFlags() {
  try {
    const map = await fetchSettings(['flags', 'banner_message']);
    return extractFlags(map);
  } catch (err) {
    console.log('settings fetch (subscribe) failed', err.message);
    return extractFlags();
  }
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
  }

  const flags = await getFlags();
  if (flags.disable_email_capture) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'email_capture_disabled', message: flags.banner_message || 'Email capture deaktiviert.' })
    };
  }

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const confirmed = false;

  try {
    const { data: existing, error: selectErr } = await supabase
      .from('emails')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (selectErr) throw selectErr;

    if (existing) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'already_exists' })
      };
    }

    const source = typeof payload.source === 'string' ? payload.source.slice(0, 64) : 'landing_page';
    const meta = payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta) ? payload.meta : undefined;

    await insertEmailRecord({ email, confirmed, source, meta });

    await createSnapshot('subscriber_added');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.log('email insert/select error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

exports.handler = withCors(handler);
