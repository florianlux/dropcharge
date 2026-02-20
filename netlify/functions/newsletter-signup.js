const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

function isValidEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeUtm(payload = {}) {
  const map = {};
  ['source', 'medium', 'campaign', 'term', 'content'].forEach((key) => {
    const value = payload[`utm_${key}`] || payload[key];
    if (value && typeof value === 'string') {
      map[`utm_${key}`] = value.slice(0, 120);
    }
  });
  return map;
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
  }

  const source = (payload.source || 'landing').slice(0, 64);
  const utms = normalizeUtm(payload.utm || {});
  const meta = {
    consent: Boolean(payload.consent),
    context: payload.meta?.context || null,
  };

  const record = {
    email,
    status: 'active',
    source,
    ...utms,
    unsubscribed_at: null,
    last_sent_at: null,
    meta
  };

  try {
    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert(record, { onConflict: 'email', ignoreDuplicates: false });

    if (error) {
      if ((error.message || '').includes('duplicate')) {
        return { statusCode: 200, body: JSON.stringify({ ok: true, duplicate: true }) };
      }
      throw error;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.log('newsletter signup error', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'signup_failed' }) };
  }
}

exports.handler = withCors(handler);
