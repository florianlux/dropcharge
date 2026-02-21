const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

console.log("newsletter v2 live");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handler(event) {
  console.log('[newsletter] httpMethod:', event.httpMethod);

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, status: 'error', debug: { error_message: 'method_not_allowed', supabase_error_code: null } })
    };
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, status: 'error', debug: { error_message: 'invalid_json', supabase_error_code: null } })
    };
  }

  console.log('[newsletter] parsed body:', JSON.stringify(payload));

  const email = (payload.email || '').trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, status: 'error', debug: { error_message: 'invalid_email', supabase_error_code: null } })
    };
  }

  if (!hasSupabase || !supabase) {
    console.error('[newsletter] Supabase not configured');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, status: 'error', debug: { error_message: 'supabase_not_configured', supabase_error_code: null } })
    };
  }

  // --- Insert into newsletter_subscribers ---
  const row = {
    email,
    status: 'active',
    source: typeof payload.source === 'string' ? payload.source.slice(0, 64) : undefined
  };

  const { data: insertData, error: insertErr } = await supabase
    .from('newsletter_subscribers')
    .insert(row);

  console.log('[newsletter] insert result:', JSON.stringify({ data: insertData, error: insertErr }));

  if (insertErr) {
    const msg = (insertErr.message || '').toLowerCase();
    const isDuplicate = insertErr.code === '23505' || msg.includes('duplicate') || msg.includes('unique');

    if (isDuplicate) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, success: true, status: 'exists', email_sent: false, debug: { error_message: null, supabase_error_code: '23505' } })
      };
    }

    console.error('[newsletter] insert error:', insertErr.message, insertErr.stack || '');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, status: 'error', debug: { error_message: insertErr.message, supabase_error_code: insertErr.code || null } })
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
      console.error('[newsletter] Resend email failed (non-fatal):', err.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, success: true, status: 'inserted', email_sent: emailSent, debug: { error_message: null, supabase_error_code: null } })
  };
}

exports.handler = withCors(handler);
