const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

console.log("ENV CHECK:", {
  hasResendKey: !!process.env.RESEND_API_KEY,
  hasFrom: !!process.env.RESEND_FROM,
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

const EMAIL_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.RESEND_FROM;
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;
const BASE_URL = (process.env.PUBLIC_SITE_URL || 'https://dropcharge.netlify.app').replace(/\/$/, '');
const BATCH_SIZE = Number(process.env.CAMPAIGN_BATCH_SIZE || 50);
const BATCH_DELAY_MS = Number(process.env.CAMPAIGN_BATCH_DELAY || 750);
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeHtml(html = '') {
  const unsubscribePlaceholder = '<p style="margin-top:24px;font-size:12px;color:#666">\n    Du willst keine Deals mehr? <a href="__UNSUB__">Hier abmelden</a>\n  </p>';
  const trimmed = html && html.trim() ? html.trim() : '<p>Kein Inhalt.</p>';
  return trimmed.includes('__UNSUB__') ? trimmed : `${trimmed}\n${unsubscribePlaceholder}`;
}

async function fetchSubscribers(segment) {
  if (!hasSupabase || !supabase) throw new Error('supabase_not_configured');
  let query = supabase
    .from('newsletter_subscribers')
    .select('email')
    .eq('status', 'active');
  if (segment) {
    query = query.eq('source', segment);
  }
  const { data, error } = await query;
  if (error) throw error;
  const cleaned = (data || [])
    .map(row => (row.email || '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

async function getLastCampaign() {
  if (!hasSupabase || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('newsletter_campaigns')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

async function logCampaign(payload) {
  if (!hasSupabase || !supabase) return;
  try {
    const { error } = await supabase.from('newsletter_campaigns').insert(payload);
    if (error) console.log('campaign log error', error.message);
  } catch (err) {
    console.log('campaign log error', err.message);
  }
}

async function sendEmail({ to, subject, html }) {
  const body = {
    from: EMAIL_FROM,
    to,
    subject,
    html,
    ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {})
  };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EMAIL_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`email_provider_error:${res.status}:${text}`);
  }
  return true;
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function logEmailSend({ email, template, subject, status, error: errMsg }) {
  if (!hasSupabase || !supabase) return { logged: false, reason: 'supabase_not_configured' };
  try {
    const { error } = await supabase.from('email_logs').insert({
      recipient: email,
      template: template || 'campaign',
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

async function sendCampaign({ recipients, subject, html, context }) {
  let sent = 0;
  const failed = [];
  let logWarnings = 0;
  const batches = chunk(recipients, BATCH_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    await Promise.all(batch.map(async (email) => {
      const unsubscribe = `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}`;
      const htmlWithUnsub = html.replace(/__UNSUB__/g, unsubscribe);
      try {
        await sendEmail({ to: email, subject, html: htmlWithUnsub });
        sent += 1;
        const logResult = await logEmailSend({ email, subject, status: 'sent' });
        if (!logResult.logged) logWarnings += 1;
      } catch (err) {
        console.log('email send failed', email, err.message);
        failed.push(email);
        const logResult = await logEmailSend({ email, subject, status: 'failed', error: err.message });
        if (!logResult.logged) logWarnings += 1;
      }
    }));
    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  return { sent, failed, logWarnings };
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }

  const subject = (payload.subject || '').trim();
  const rawHtml = payload.html || '';
  const testEmail = (payload.testEmail || '').trim().toLowerCase();
  const segment = typeof payload.segment === 'string' && payload.segment.trim() ? payload.segment.trim() : null;

  if (!subject || !rawHtml.trim()) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'subject_required' }) };
  }

  const required = {
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    RESEND_FROM: !!process.env.RESEND_FROM,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  const missing = Object.entries(required)
    .filter(([k, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'email_env_missing',
        missing
      })
    };
  }

  const now = Date.now();
  const lastCampaign = await getLastCampaign();
  if (!testEmail && lastCampaign?.created_at) {
    const lastTs = new Date(lastCampaign.created_at).getTime();
    if (now - lastTs < RATE_LIMIT_MS) {
      return {
        statusCode: 429,
        body: JSON.stringify({ ok: false, error: 'rate_limited', retryInMs: RATE_LIMIT_MS - (now - lastTs) })
      };
    }
  }

  let recipients = [];
  if (testEmail) {
    recipients = [testEmail];
  } else {
    recipients = await fetchSubscribers(segment);
    if (!recipients.length) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'no_recipients' }) };
    }
  }

  const normalizedHtml = normalizeHtml(rawHtml);

  try {
    const result = await sendCampaign({
      recipients,
      subject,
      html: normalizedHtml,
      context: { segment }
    });

    if (!testEmail) {
      await logCampaign({
        subject,
        body_html: normalizedHtml,
        segment,
        total_recipients: recipients.length,
        sent_count: result.sent,
        failed_count: result.failed.length,
        status: 'completed',
        completed_at: new Date().toISOString()
      });
    }

    const response = { ok: true, ...result, test: Boolean(testEmail) };
    if (result.logWarnings > 0) {
      response.warning = 'log_insert_failed';
      response.details = `${result.logWarnings} email log(s) could not be saved. Run migration 004_email_logs.sql.`;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (err) {
    console.error('campaign send failed', err.message);
    if (!testEmail) {
      await logCampaign({
        subject,
        body_html: normalizedHtml,
        segment,
        total_recipients: recipients.length,
        sent_count: 0,
        failed_count: recipients.length,
        status: 'failed',
        error: err.message,
        completed_at: new Date().toISOString()
      });
    }
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'resend_failed', details: err.message })
    };
  }
}

exports.handler = withCors(handler);
