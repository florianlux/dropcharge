const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email) {
    return jsonResponse(400, { ok: false, error: 'Email is required' });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required Supabase configuration');
      return jsonResponse(500, { ok: false, error: 'Server configuration error' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email, status: 'active' });

    if (error) {
      if (error.code === '23505') {
        return jsonResponse(200, { ok: true, success: true, status: 'exists' });
      }
      console.error('supabase insert error:', error);
      return jsonResponse(500, { ok: false, error: error.message });
    }

    // Optional: send welcome email via Resend
    try {
      if (process.env.RESEND_API_KEY) {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: 'Welcome to DropCharge 🚀',
          html: '<p>Thanks for subscribing!</p>',
        });
      }
    } catch (resendErr) {
      // Resend failure must never break signup
      console.log('Resend email failed (non-critical):', resendErr.message);
    }

    return jsonResponse(200, { ok: true, success: true, status: 'inserted' });
  } catch (err) {
    console.error('newsletter_signup unexpected error:', err);
    return jsonResponse(500, { ok: false, error: 'Internal Server Error' });
  }
};
