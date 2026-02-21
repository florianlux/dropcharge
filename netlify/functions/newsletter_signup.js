const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
    };
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Invalid JSON body' })
    };
  }

  const email = (payload.email || '').trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_email' })
    };
  }

  if (!hasSupabase || !supabase) {
    console.error('newsletter_signup: Supabase not configured');
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Service temporarily unavailable' })
    };
  }

  const record = {
    email,
    status: 'active',
    source: payload.source || null,
    utm_source: payload.utm?.utm_source || null,
    utm_medium: payload.utm?.utm_medium || null,
    utm_campaign: payload.utm?.utm_campaign || null,
    utm_term: payload.utm?.utm_term || null,
    utm_content: payload.utm?.utm_content || null,
    meta: { page: payload.page || null, consent: payload.consent || false }
  };

  try {
    const { error } = await supabase.from('newsletter_subscribers').insert(record);

    if (error) {
      // Unique constraint violation → duplicate email
      if (error.code === '23505') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: true, status: 'exists', message: 'Email already subscribed' })
        };
      }
      throw error;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, status: 'inserted', message: 'Subscribed successfully' })
    };
  } catch (err) {
    console.error('newsletter_signup error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Internal server error', details: err.message })
    };
  }
}

exports.handler = withCors(handler);
