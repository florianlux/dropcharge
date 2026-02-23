/**
 * Academy Auth – simple token-based auth using email.
 * POST: sends a magic-link token (stored in academy_access or generated).
 * In production, sends email via Resend; otherwise returns token directly for dev.
 */
const { withCors } = require('./_lib/cors');
const { supabase, hasSupabase } = require('./_lib/supabase');
const crypto = require('crypto');

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
  }

  if (!hasSupabase) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'database not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid json' }) };
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'valid email required' }) };
  }

  // Generate a secure token
  const token = crypto.randomBytes(32).toString('hex');
  const baseUrl = process.env.PUBLIC_SITE_URL || 'https://dropcharge.io';

  // Upsert a simple session record – we use academy_access user_id = email
  // Store token in a lightweight way: we'll use the settings table or a dedicated approach
  // For simplicity: store token as a row in a sessions-like pattern
  // We'll store it in the academy_access granted_by field temporarily, or better:
  // Use the email as user_id throughout the academy system

  // Check if user exists in academy_access
  const { data: existing } = await supabase
    .from('academy_access')
    .select('user_id')
    .eq('user_id', email)
    .maybeSingle();

  // Store the token – we'll use a simple approach: hash the token and store in settings
  // Actually, let's keep it simple: the token IS the session identifier
  // We store a mapping of token -> email in the settings table as a JSON value
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { error: tokenErr } = await supabase
    .from('settings')
    .upsert({
      key: 'academy_session_' + tokenHash,
      value: JSON.stringify({ email: email, created: Date.now() }),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

  if (tokenErr) {
    console.log('academy_auth: token store error', tokenErr.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'could not create session' }) };
  }

  const loginUrl = baseUrl + '/academy/app/?token=' + token;

  // Try to send email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'DropCharge Academy <noreply@dropcharge.io>';

  if (resendKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: emailFrom,
          to: [email],
          subject: 'Dein DropCharge Academy Login-Link',
          html: '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:2rem;">' +
            '<h2 style="color:#7f5dff;">DropCharge Academy</h2>' +
            '<p>Klicke auf den Button, um dich einzuloggen:</p>' +
            '<a href="' + loginUrl + '" style="display:inline-block;padding:12px 24px;background:#7f5dff;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Jetzt einloggen</a>' +
            '<p style="color:#999;font-size:0.85rem;margin-top:1.5rem;">Dieser Link ist 24 Stunden gültig. Falls du diesen Login nicht angefordert hast, ignoriere diese Email.</p>' +
            '</div>'
        })
      });
      if (!resp.ok) {
        console.log('academy_auth: resend error', resp.status);
      }
    } catch (e) {
      console.log('academy_auth: resend failed', e.message);
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'login link sent' })
    };
  }

  // Dev fallback: return token directly
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, message: 'login link sent', _dev_token: token, _dev_url: loginUrl })
  };
});
