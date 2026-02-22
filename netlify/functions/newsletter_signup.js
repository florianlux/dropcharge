const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');
const { welcomeEmail, BASE_URL } = require('./_lib/email-templates');
const crypto = require('crypto');

console.log("ENV CHECK:", {
  hasResendKey: !!process.env.RESEND_API_KEY,
  hasFrom: !!process.env.RESEND_FROM,
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

const EMAIL_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.RESEND_FROM;
const EMAIL_FALLBACK_FROM = process.env.RESEND_FALLBACK_FROM || undefined;
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function logEmailSend({ email, template, subject, status, error: errMsg }) {
  if (!hasSupabase || !supabase) return;
  try {
    await supabase.from('email_logs').insert({
      recipient: email,
      template,
      subject,
      status,
      error: errMsg || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    });
  } catch (err) {
    console.error('email_log insert error:', err.message);
  }
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
  let emailSent = false;
  const welcomeSubject = welcomeEmail({ email, unsubscribeUrl: '#' }).subject;
  const senderFrom = EMAIL_FROM || EMAIL_FALLBACK_FROM;
  if (EMAIL_API_KEY && senderFrom) {
    try {
      const tpl = welcomeEmail({ email, unsubscribeUrl });
      if (!tpl.subject || !tpl.html) {
        throw new Error('invalid_template_payload: welcome template produced empty subject or html');
      }
      const body = {
        from: senderFrom,
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {})
      };

      console.log('EMAIL PAYLOAD:', {
        from: senderFrom,
        to: email,
        subjectLength: tpl.subject.length,
        htmlLength: tpl.html.length
      });

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${EMAIL_API_KEY}`
        },
        body: JSON.stringify(body)
      });

      let resBody;
      try { resBody = await res.json(); } catch { resBody = await res.text().catch(() => ''); }

      if (!res.ok) {
        console.error('RESEND ERROR FULL:', {
          status: res.status,
          response: resBody
        });
        const detail = typeof resBody === 'object' ? JSON.stringify(resBody) : String(resBody);
        throw new Error(`resend_error:${res.status}:${detail}`);
      }
      console.log('RESEND SUCCESS:', resBody);
      emailSent = true;
      await logEmailSend({ email, template: 'welcome', subject: tpl.subject, status: 'sent' });
    } catch (err) {
      console.error('Welcome email failed (non-fatal):', err.message);
      await logEmailSend({ email, template: 'welcome', subject: welcomeSubject, status: 'failed', error: err.message });
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, success: true, status: 'subscribed', email_sent: emailSent })
  };
}

exports.handler = withCors(handler);
