const { supabase, hasSupabase, supabaseUrlPresent, supabaseServiceKeyPresent } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  if (!hasSupabase || !supabase) {
    console.error('Server not configured', { SUPABASE_URL: supabaseUrlPresent, SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKeyPresent });
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server not configured' }) };
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }) };
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
  }

  try {
    const source = typeof payload.source === 'string' ? payload.source.slice(0, 64) : 'landing_page';
    const utm = payload.utm && typeof payload.utm === 'object' ? payload.utm : {};

    const row = {
      email,
      status: 'active',
      source,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_term: utm.utm_term || null,
      utm_content: utm.utm_content || null,
    };

    const { error } = await supabase.from('newsletter_subscribers').insert(row);

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique') || error.code === '23505') {
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true, status: 'exists', message: 'Email already subscribed' })
        };
      }
      throw error;
    }

    // Optional: send welcome email if RESEND_API_KEY is configured
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: email,
          subject: 'Welcome to DropCharge 🚀',
          html: '<p>Thanks for subscribing!</p>'
        });
      } catch (mailErr) {
        console.warn('Welcome email failed (non-blocking):', mailErr.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, status: 'inserted', message: 'Subscribed' })
    };
  } catch (err) {
    console.error('newsletter_signup error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: 'Subscription failed', details: err.message })
    };
  }
}

exports.handler = withCors(handler);
