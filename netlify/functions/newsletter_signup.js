const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

// Cache Supabase client (warm Lambda reuse)
let supabase;
function getSupabase() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return jsonResponse(400, { ok: false, error: 'Valid email is required' });
  }

  try {
    const db = getSupabase();
    const { error } = await db
      .from('newsletter_subscribers')
      .insert({ email, status: 'active' });

    if (error) {
      if (error.code === '23505') {
        return jsonResponse(200, { ok: true, success: true, status: 'exists' });
      }
      console.error('Supabase insert error:', error);
      return jsonResponse(500, { ok: false, error: 'Database error' });
    }

    // Optional: Welcome-E-Mail via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.FROM_EMAIL || 'noreply@dropcharge.io',
          to: email,
          subject: 'Welcome to DropCharge 🚀',
          html: '<p>Thanks for subscribing!</p>',
        });
      } catch (resendErr) {
        console.warn('Resend failed (non-critical):', resendErr.message);
      }
    }

    return jsonResponse(200, { ok: true, success: true, status: 'inserted' });
  } catch (err) {
    console.error('newsletter_signup unexpected error:', err);
    return jsonResponse(500, { ok: false, error: 'Internal Server Error' });
  }
};
