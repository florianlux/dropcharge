const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handler(event) {
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

  // --- Insert into newsletter_subscribers ---
  const row = {
    email,
    status: 'active',
    source: typeof payload.source === 'string' ? payload.source.slice(0, 64) : undefined
  };

  const { error: insertErr } = await supabase
    .from('newsletter_subscribers')
    .insert(row);

  if (insertErr) {
    const msg = (insertErr.message || '').toLowerCase();
    const isDuplicate = insertErr.code === '23505' || msg.includes('duplicate') || msg.includes('unique');

    if (isDuplicate) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, success: true, status: 'exists', email_sent: false })
      };
    }

    console.error('newsletter_signup insert error:', insertErr.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: insertErr.message })
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
    body: JSON.stringify({ ok: true, success: true, status: 'inserted', email_sent: emailSent })
  };
}

exports.handler = withCors(handler);
