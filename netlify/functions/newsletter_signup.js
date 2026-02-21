const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handler(event) {
  // Handle CORS preflight before method guard
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_json' })
    };
  }

  const email = (payload.email || '').trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_email' })
    };
  }

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  // --- Upsert into newsletter_subscribers (idempotent on email) ---
  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email, status: 'active' }, { onConflict: 'email' });

  if (error) {
    console.error('newsletter_signup upsert error:', error.message, error.stack || '');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, success: false, status: 'error', message: error.message })
    };
  }

  // --- Optional: send welcome email via Resend ---
  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Welcome to DropCharge 🚀',
        html: '<p>Thanks for subscribing!</p>'
      });
      emailSent = true;
    } catch (err) {
      console.error('Resend email failed (non-fatal):', err.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, success: true, status: 'subscribed', email_sent: emailSent })
  };
}

exports.handler = withCors(handler);
