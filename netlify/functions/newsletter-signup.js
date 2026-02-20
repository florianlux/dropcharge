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

  const source = (payload.source || 'popup').slice(0, 64);
  const page = (payload.page || '/').slice(0, 160);
  const userAgent = (event.headers['user-agent'] || event.headers['User-Agent'] || '').slice(0, 255);
  const utms = normalizeUtm(payload.utm || {});
  const meta = {
    consent: Boolean(payload.consent),
    context: payload.meta?.context || null,
  };

  try {
    const { data: existing, error: selectErr } = await supabase
      .from('newsletter_signups')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (selectErr && selectErr.code !== 'PGRST116') throw selectErr;

    if (existing) {
      await supabase
        .from('newsletter_signups')
        .update({
          status: 'active',
          unsubscribed_at: null,
          source,
          page,
          user_agent: userAgent,
          meta
        })
        .eq('id', existing.id);
      return { statusCode: 200, body: JSON.stringify({ ok: true, duplicate: true }) };
    }

    const insertPayload = {
      email,
      status: 'active',
      source,
      page,
      user_agent: userAgent,
      meta,
      ...utms
    };

    const { error: insertErr } = await supabase
      .from('newsletter_signups')
      .insert(insertPayload);

    if (insertErr) throw insertErr;

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.log('newsletter signup error', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'signup_failed' }) };
  }
}

exports.handler = withCors(handler);
