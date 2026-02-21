const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

const EMAIL_API_KEY = process.env.EMAIL_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const BASE_URL = (process.env.BASE_URL || 'https://dropcharge.netlify.app').replace(/\/$/, '');
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
  if (!EMAIL_API_KEY) throw new Error('email_api_key_missing');
  if (!EMAIL_FROM) throw new Error('email_from_missing');
  const body = {
    from: EMAIL_FROM,
    to,
    subject,
    html
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

async function sendCampaign({ recipients, subject, html, context }) {
  let sent = 0;
  const failed = [];
  const batches = chunk(recipients, BATCH_SIZE);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    await Promise.all(batch.map(async (email) => {
      const unsubscribe = `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}`;
      const htmlWithUnsub = html.replace(/__UNSUB__/g, unsubscribe);
      try {
        await sendEmail({ to: email, subject, html: htmlWithUnsub });
        sent += 1;
      } catch (err) {
        console.log('email send failed', email, err.message);
        failed.push(email);
      }
    }));
    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  return { sent, failed };
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

  if (!EMAIL_API_KEY || !EMAIL_FROM) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'email_env_missing' }) };
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, ...result, test: Boolean(testEmail) })
    };
  } catch (err) {
    console.log('campaign send failed', err.message);
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
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
