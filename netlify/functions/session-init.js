/**
 * session-init.js – Public POST endpoint.
 * Creates or refreshes a session row and returns the session_key.
 * Called optionally by the frontend tracker on page load.
 */

const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

const MAX_STR = 512;

function truncate(val, max) {
  if (val == null) return null;
  const s = String(val);
  return s.length > max ? s.slice(0, max) : s;
}

function detectDevice(ua) {
  if (!ua) return 'unknown';
  const l = ua.toLowerCase();
  if (l.includes('mobile') || l.includes('iphone') || l.includes('android')) return 'mobile';
  if (l.includes('tablet') || l.includes('ipad')) return 'tablet';
  return 'desktop';
}

function detectOS(ua) {
  if (!ua) return null;
  const l = ua.toLowerCase();
  if (l.includes('windows')) return 'Windows';
  if (l.includes('mac os') || l.includes('macos')) return 'macOS';
  if (l.includes('iphone') || l.includes('ipad') || l.includes('ios')) return 'iOS';
  if (l.includes('android')) return 'Android';
  if (l.includes('linux')) return 'Linux';
  return null;
}

function detectBrowser(ua) {
  if (!ua) return null;
  const l = ua.toLowerCase();
  if (l.includes('edg/') || l.includes('edge/')) return 'Edge';
  if (l.includes('opr/') || l.includes('opera')) return 'Opera';
  if (l.includes('chrome')) return 'Chrome';
  if (l.includes('safari')) return 'Safari';
  if (l.includes('firefox')) return 'Firefox';
  return null;
}

function parseGeo(headers = {}) {
  const raw = headers['x-nf-geo'];
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return {}; }
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }

  const headers = event.headers || {};
  const ua = headers['user-agent'] || '';
  const geo = parseGeo(headers);
  const now = new Date().toISOString();
  const consentAnalytics = Boolean(payload.consent_analytics);

  const sessionKey = truncate(payload.session_key || null, MAX_STR);
  if (!sessionKey) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'session_key_required' }) };
  }

  const userId = consentAnalytics ? truncate(payload.user_id || null, MAX_STR) : null;

  const sessionRow = {
    session_key: sessionKey,
    user_id: userId,
    last_seen: now,
    landing_path: truncate(payload.landing_path || payload.path || null, MAX_STR),
    referrer: truncate(payload.referrer || headers.referer || null, MAX_STR),
    utm_source: truncate(payload.utm_source || null, MAX_STR),
    utm_medium: truncate(payload.utm_medium || null, MAX_STR),
    utm_campaign: truncate(payload.utm_campaign || null, MAX_STR),
    utm_content: truncate(payload.utm_content || null, MAX_STR),
    utm_term: truncate(payload.utm_term || null, MAX_STR),
    device_type: truncate(detectDevice(ua), 32),
    os: truncate(detectOS(ua), 64),
    browser: truncate(detectBrowser(ua), 64),
    country: truncate(payload.country || geo.country || null, 64),
    consent_analytics: consentAnalytics
  };

  try {
    const { data: existing } = await supabase
      .from('sessions')
      .select('session_key')
      .eq('session_key', sessionKey)
      .maybeSingle();

    if (existing) {
      await supabase.from('sessions')
        .update({ last_seen: now, user_id: userId, consent_analytics: consentAnalytics })
        .eq('session_key', sessionKey);
    } else {
      await supabase.from('sessions').insert({ ...sessionRow, first_seen: now });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, session_key: sessionKey })
    };
  } catch (err) {
    console.error('session-init error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
