const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { TEMPLATES } = require('./_lib/email-templates');
const { supabase, hasSupabase } = require('./_lib/supabase');

const EMAIL_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.RESEND_FROM || process.env.RESEND_FALLBACK_FROM;
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function logEmailSend({ email, template, subject, status, error: errMsg }) {
  if (!hasSupabase || !supabase) return { logged: false, reason: 'supabase_not_configured' };
  try {
    const { error } = await supabase.from('email_logs').insert({
      recipient: email,
      template: template || 'test',
      subject,
      status,
      error: errMsg || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    });
    if (error) {
      console.error('email_log insert error:', error.message);
      return { logged: false, reason: error.message };
    }
    return { logged: true };
  } catch (err) {
    console.error('email_log insert error:', err.message);
    return { logged: false, reason: err.message };
  }
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  }

  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }

  const to = (payload.to || '').trim().toLowerCase();
  const templateId = payload.templateId || '';
  const vars = payload.vars || {};

  if (!isValidEmail(to)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_email', details: 'A valid recipient email is required.' })
    };
  }

  if (!templateId || !TEMPLATES[templateId]) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_template', available: Object.keys(TEMPLATES) })
    };
  }

  if (!EMAIL_API_KEY || !EMAIL_FROM) {
    const missing = [!EMAIL_API_KEY && 'RESEND_API_KEY', !EMAIL_FROM && 'RESEND_FROM'].filter(Boolean);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'email_env_missing', missing })
    };
  }

  const tpl = TEMPLATES[templateId];
  const data = { ...tpl.sampleData, ...vars };
  const rendered = tpl.render(data);

  const subject = rendered.subject || tpl.name || templateId;
  const html = rendered.html;

  const emailBody = {
    from: EMAIL_FROM,
    to,
    subject,
    html,
    ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {})
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EMAIL_API_KEY}`
      },
      body: JSON.stringify(emailBody)
    });

    let resBody;
    try { resBody = await res.json(); } catch { resBody = await res.text().catch(() => ''); }

    if (!res.ok) {
      console.error('RESEND ERROR:', { status: res.status, response: resBody });
      const detail = typeof resBody === 'object' ? JSON.stringify(resBody) : String(resBody);
      const logResult = await logEmailSend({ email: to, template: templateId, subject, status: 'failed', error: `resend_error:${res.status}:${detail}` });
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'resend_failed', details: detail, logged: logResult.logged })
      };
    }

    const logResult = await logEmailSend({ email: to, template: templateId, subject, status: 'sent' });

    const response = { ok: true, messageId: resBody?.id ?? null, template: templateId, to };
    if (!logResult.logged) {
      response.warning = 'log_insert_failed';
      response.details = logResult.reason || 'Email log could not be saved. Run migration 004_email_logs.sql.';
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (err) {
    console.error('send-test-email error:', err.message);
    await logEmailSend({ email: to, template: templateId, subject, status: 'failed', error: err.message });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'send_failed', details: err.message })
    };
  }
}

exports.handler = withCors(handler);
