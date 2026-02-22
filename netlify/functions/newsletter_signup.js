const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');
const { BASE_URL } = require('./_lib/email-templates');
const { sendWelcomeEmail } = require('./_lib/send-welcome');
const crypto = require('crypto');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
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

  // --- Build subscriber record with source tracking + unsubscribe token ---
  const source = typeof payload.source === 'string' ? payload.source.slice(0, 64) : 'newsletter_signup';
  const unsubscribeToken = generateToken();

  const record = {
    email,
    status: 'active',
    source,
    unsubscribe_token: unsubscribeToken
  };
  // Pass through UTM params if present
  if (payload.utm_source) record.utm_source = String(payload.utm_source).slice(0, 128);
  if (payload.utm_medium) record.utm_medium = String(payload.utm_medium).slice(0, 128);
  if (payload.utm_campaign) record.utm_campaign = String(payload.utm_campaign).slice(0, 128);
  if (payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)) {
    record.meta = payload.meta;
  }

  const { data: upsertData, error } = await supabase
    .from('newsletter_subscribers')
    .upsert(record, { onConflict: 'email' })
    .select('unsubscribe_token')
    .maybeSingle();

  if (error) {
    console.error('newsletter_signup upsert error:', error.message, error.stack || '');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, success: false, status: 'error', message: error.message })
    };
  }

  // Use the token from DB (may be existing if subscriber already had one)
  const token = (upsertData && upsertData.unsubscribe_token) || unsubscribeToken;
  const unsubscribeUrl = `${BASE_URL}/.netlify/functions/unsubscribe?token=${encodeURIComponent(token)}`;

  // --- Send welcome email via Resend ---
  const welcomeResult = await sendWelcomeEmail({ email, unsubscribeUrl });
  const emailSent = welcomeResult.sent;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, success: true, status: 'subscribed', email_sent: emailSent })
  };
}

exports.handler = withCors(handler);
