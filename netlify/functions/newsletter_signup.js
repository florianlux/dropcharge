const crypto = require('crypto');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'DropCharge <news@dropcharge.io>';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://dropcharge.io').replace(/\/$/, '');

function isValidEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendWelcomeEmail({ email, unsubscribeLink }) {
  if (!RESEND_API_KEY) return { skipped: true };
  const body = {
    from: EMAIL_FROM,
    to: email,
    subject: 'Willkommen bei DropCharge 🔥',
    html: `
      <p>Hey Gamer,</p>
      <p>du bist jetzt in der DropCharge Crew. Wir schicken dir nur die heißesten Drops – keine Werbung.</p>
      <p><strong>Was du erwarten kannst:</strong></p>
      <ul>
        <li>Frühzeitige Codes & Rabatt-Aktionen</li>
        <li>Weekly Drops direkt in dein Postfach</li>
        <li>Deals bevor sie auf TikTok explodieren</li>
      </ul>
      <p>Wenn du keine Mails mehr willst, kannst du dich jederzeit <a href="${unsubscribeLink}">hier abmelden</a>.</p>
      <p>GG,<br/>Team DropCharge</p>
    `
  };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`resend_failed:${res.status}:${text}`);
  }
  const payload = await res.json().catch(() => ({}));
  return { skipped: false, providerMessageId: payload.id };
}

async function recordEvent(leadId, type, meta = {}) {
  if (!hasSupabase) return;
  try {
    await supabase.from('newsletter_events').insert({ lead_id: leadId, type, meta });
  } catch (err) {
    console.log('newsletter event insert failed', err.message);
  }
}

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
  }

  const source = (payload.source || 'popup').slice(0, 64);
  const page = (payload.page || '/').slice(0, 160);
  const userAgent = (event.headers['user-agent'] || event.headers['User-Agent'] || '').slice(0, 255);

  try {
    const { data: existing, error: selectErr } = await supabase
      .from('newsletter_leads')
      .select('id,status,unsubscribe_token')
      .eq('email', email)
      .maybeSingle();
    if (selectErr) throw selectErr;

    let leadId;
    let token;
    if (existing) {
      leadId = existing.id;
      token = existing.unsubscribe_token;
      await supabase
        .from('newsletter_leads')
        .update({
          status: existing.status === 'unsubscribed' ? 'confirmed' : existing.status,
          unsubscribed_at: null,
          confirmed_at: new Date().toISOString(),
          source,
          page,
          user_agent: userAgent
        })
        .eq('id', existing.id);
      await recordEvent(existing.id, 'lead_updated', { source, page });
      const unsubscribeLink = `${PUBLIC_BASE_URL}/unsubscribe?token=${token}`;
      try {
        const sendResult = await sendWelcomeEmail({ email, unsubscribeLink });
        await supabase
          .from('newsletter_leads')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (!sendResult.skipped) {
          await recordEvent(existing.id, 'welcome_sent', sendResult);
        }
      } catch (mailErr) {
        console.log('welcome email failed', mailErr.message);
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, status: 'exists' }) };
    }

    token = crypto.randomBytes(16).toString('hex');
    const insert = await supabase
      .from('newsletter_leads')
      .insert({
        email,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        source,
        page,
        user_agent: userAgent,
        unsubscribe_token: token
      })
      .select('id')
      .single();
    if (insert.error) throw insert.error;
    leadId = insert.data.id;

    const unsubscribeLink = `${PUBLIC_BASE_URL}/unsubscribe?token=${token}`;
    try {
      const sendResult = await sendWelcomeEmail({ email, unsubscribeLink });
      await supabase
        .from('newsletter_leads')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', leadId);
      if (!sendResult.skipped) {
        await recordEvent(leadId, 'welcome_sent', sendResult);
      }
    } catch (mailErr) {
      console.log('welcome email failed', mailErr.message);
    }

    await recordEvent(leadId, 'lead_created', { source, page });

    return { statusCode: 200, body: JSON.stringify({ ok: true, status: 'inserted' }) };
  } catch (err) {
    console.log('newsletter signup error', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'signup_failed' }) };
  }
});
