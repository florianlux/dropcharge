/**
 * track-event.js  – Public POST endpoint for first-party event ingestion.
 *
 * Hardening:
 *  - Max body 10 KB
 *  - Validates required fields and field lengths
 *  - In-memory per-IP rate limit (100 req / 60 s window)
 *  - No outgoing fetches (SSRF-safe)
 *  - Writes into Supabase `events` table
 *  - Upserts session row (creates or updates last_seen)
 */

const crypto = require('crypto');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

// ── In-memory rate limiter ──────────────────────────────
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 100;
const _rateBuckets = new Map(); // ip → { count, resetAt }

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  let bucket = _rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    _rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  // Periodically prune stale entries to avoid memory growth
  if (_rateBuckets.size > 5000) {
    for (const [k, v] of _rateBuckets) {
      if (now > v.resetAt) _rateBuckets.delete(k);
    }
  }
  return bucket.count > RATE_LIMIT;
}

// ── Helpers ─────────────────────────────────────────────
const MAX_BODY_BYTES = 10_240; // 10 KB
const MAX_STR = 512;
const ALLOWED_EVENTS = new Set([
  'page_view', 'session_start', 'consent_update',
  'scroll_depth', 'outbound_click',
  'spotlight_view', 'cta_click', 'coupon_copy',
  'newsletter_view', 'newsletter_submit', 'newsletter_success', 'newsletter_error',
  'spotlight_click', 'custom'
]);

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

function hashUA(ua) {
  if (!ua) return null;
  return crypto.createHash('sha256').update(ua).digest('hex');
}

function safeProps(val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  return {};
}

// ── Handler ─────────────────────────────────────────────
async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Rate limit check
  const headers = event.headers || {};
  const ip = (headers['x-forwarded-for'] || '').split(',')[0].trim()
    || headers['x-real-ip']
    || 'unknown';
  if (isRateLimited(ip)) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      body: JSON.stringify({ ok: false, error: 'rate_limited' })
    };
  }

  // Body size guard
  const rawBody = event.body || '{}';
  if (rawBody.length > MAX_BODY_BYTES) {
    return { statusCode: 413, body: JSON.stringify({ ok: false, error: 'payload_too_large' }) };
  }

  let payload = {};
  try { payload = JSON.parse(rawBody); } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  // Determine event name (support both new `event_name` and legacy `type`/`name`)
  const rawEventName = payload.event_name || payload.type || payload.name || 'custom';
  const eventName = truncate(rawEventName, MAX_STR);
  if (!eventName) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'event_name_required' }) };
  }
  const normalizedEvent = ALLOWED_EVENTS.has(eventName) ? eventName : 'custom';

  const userAgent = headers['user-agent'] || '';
  const geo = parseGeo(headers);
  const props = safeProps(payload.props || payload.meta);
  const experiments = Array.isArray(payload.experiments) ? payload.experiments : [];
  if (experiments.length) props.experiments = experiments;

  const sessionKey = truncate(payload.session_key || payload.session_id || payload.sessionId || null, MAX_STR);
  const userId = truncate(payload.user_id || null, MAX_STR);
  const consentAnalytics = Boolean(payload.consent_analytics);

  const now = new Date().toISOString();
  const deviceType = truncate(payload.device_type || detectDevice(userAgent), 32);
  const os = truncate(payload.os || detectOS(userAgent), 64);
  const browser = truncate(payload.browser || detectBrowser(userAgent), 64);
  const country = truncate(payload.country || geo.country || null, 64);

  const record = {
    // Legacy columns (backward compat)
    type: normalizedEvent,
    name: eventName,
    slug: truncate(payload.slug || props.slug || null, MAX_STR),
    platform: truncate(payload.platform || props.platform || null, MAX_STR),
    path: truncate(payload.path || null, MAX_STR),
    referrer: truncate(payload.referrer || headers.referer || null, MAX_STR),
    utm_source: truncate(payload.utm_source || null, MAX_STR),
    utm_medium: truncate(payload.utm_medium || null, MAX_STR),
    utm_campaign: truncate(payload.utm_campaign || null, MAX_STR),
    utm_term: truncate(payload.utm_term || null, MAX_STR),
    utm_content: truncate(payload.utm_content || null, MAX_STR),
    session_id: sessionKey,
    user_agent_hash: hashUA(userAgent),
    device_hint: deviceType,
    country,
    meta: props,
    created_at: now,
    // New tracking columns
    ts: now,
    session_key: sessionKey,
    event_name: eventName,
    user_id: consentAnalytics ? userId : null,
    props,
    theme: truncate(payload.theme || null, MAX_STR),
    device_type: deviceType,
    os,
    browser
  };

  try {
    const { error } = await supabase.from('events').insert(record);
    if (error) throw error;

    // Upsert session row (non-blocking; ignore errors to keep response fast)
    if (sessionKey) {
      upsertSession({
        sessionKey, userId, consentAnalytics, now, payload, headers,
        deviceType, os, browser, country
      }).catch(err => console.log('session upsert warning', err.message));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error('track-event error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

async function upsertSession({ sessionKey, userId, consentAnalytics, now, payload, headers, deviceType, os, browser, country }) {
  const safeUserId = consentAnalytics ? userId : null;
  const { data: existing } = await supabase
    .from('sessions')
    .select('session_key')
    .eq('session_key', sessionKey)
    .maybeSingle();

  if (existing) {
    await supabase.from('sessions')
      .update({ last_seen: now, user_id: safeUserId, consent_analytics: consentAnalytics })
      .eq('session_key', sessionKey);
  } else {
    await supabase.from('sessions').insert({
      session_key: sessionKey,
      user_id: safeUserId,
      first_seen: now,
      last_seen: now,
      landing_path: truncate(payload.path || null, MAX_STR),
      referrer: truncate(payload.referrer || headers.referer || null, MAX_STR),
      utm_source: truncate(payload.utm_source || null, MAX_STR),
      utm_medium: truncate(payload.utm_medium || null, MAX_STR),
      utm_campaign: truncate(payload.utm_campaign || null, MAX_STR),
      utm_content: truncate(payload.utm_content || null, MAX_STR),
      utm_term: truncate(payload.utm_term || null, MAX_STR),
      device_type: deviceType,
      os,
      browser,
      country,
      consent_analytics: consentAnalytics
    });
  }
}

exports.handler = withCors(handler);
