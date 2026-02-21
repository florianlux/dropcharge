const crypto = require('crypto');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

function hashUserAgent(ua) {
  if (!ua) return null;
  return crypto.createHash('sha256').update(ua).digest('hex');
}

function detectDevice(ua) {
  if (!ua) return 'unknown';
  const lowered = ua.toLowerCase();
  if (lowered.includes('mobile') || lowered.includes('iphone') || lowered.includes('android')) {
    return 'mobile';
  }
  if (lowered.includes('tablet') || lowered.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}

function parseGeo(headers = {}) {
  const geoRaw = headers['x-nf-geo'];
  if (!geoRaw) return {};
  try {
    return typeof geoRaw === 'string' ? JSON.parse(geoRaw) : geoRaw;
  } catch {
    return {};
  }
}

function safeMeta(meta) {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return meta;
  }
  return {};
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  if (!hasSupabase || !supabase) {
    console.warn('track-event: Supabase not configured, skipping event tracking');
    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, warning: 'event_tracking_disabled' }) 
    };
  }

  const headers = event.headers || {};
  const userAgent = headers['user-agent'] || '';
  const geo = parseGeo(headers);
  const meta = safeMeta(payload.meta);
  const experiments = Array.isArray(payload.experiments) ? payload.experiments : [];
  if (experiments.length) {
    meta.experiments = experiments;
  }

  const type = (payload.type || payload.name || 'custom').toLowerCase();
  const sessionId = payload.session_id || payload.sessionId || null;

  const record = {
    type,
    name: payload.name || payload.type || 'custom-event',
    slug: payload.slug || meta.slug || null,
    platform: payload.platform || meta.platform || null,
    path: payload.path || meta.path || null,
    referrer: payload.referrer || headers.referer || null,
    utm_source: payload.utm_source || meta.utm_source || null,
    utm_medium: payload.utm_medium || meta.utm_medium || null,
    utm_campaign: payload.utm_campaign || meta.utm_campaign || null,
    utm_term: payload.utm_term || meta.utm_term || null,
    utm_content: payload.utm_content || meta.utm_content || null,
    session_id: sessionId,
    user_agent_hash: hashUserAgent(userAgent),
    device_hint: detectDevice(userAgent),
    country: payload.country || geo.country || null,
    meta,
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('events').insert(record);
    if (error) throw error;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.log('event insert error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

exports.handler = withCors(handler);
