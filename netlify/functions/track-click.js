const crypto = require('crypto');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

function hashValue(val) {
  if (!val) return null;
  return crypto.createHash('sha256').update(val).digest('hex');
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

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const slug = (payload.slug || '').trim();
  if (!slug) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'slug_required' }) };
  }

  const headers = event.headers || {};
  const userAgent = headers['user-agent'] || '';
  const ipRaw = (headers['x-forwarded-for'] || headers['client-ip'] || '').split(',')[0].trim() || null;

  const clickRecord = {
    slug,
    platform: payload.platform || null,
    amount: payload.amount || null,
    utm_source: payload.utm_source || null,
    utm_campaign: payload.utm_campaign || null,
    utm_medium: payload.utm_medium || null,
    referrer: payload.referrer || headers.referer || null,
    user_agent: userAgent || null,
    user_agent_hash: hashValue(userAgent),
    device_hint: detectDevice(userAgent),
    ip_hash: ipRaw ? hashValue(ipRaw) : null,
    country: payload.country || null,
    created_at: new Date().toISOString()
  };

  try {
    const { error: clickError } = await supabase.from('clicks').insert(clickRecord);
    if (clickError) {
      console.error('track-click insert error', clickError.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: clickError.message })
      };
    }

    // Also log as an event
    const eventRecord = {
      type: 'click',
      name: 'track_click',
      slug,
      platform: payload.platform || null,
      user_agent_hash: hashValue(userAgent),
      device_hint: detectDevice(userAgent),
      country: payload.country || null,
      meta: { source: 'track-click' },
      created_at: new Date().toISOString()
    };
    const { error: evtError } = await supabase.from('events').insert(eventRecord);
    if (evtError) {
      console.log('track-click event insert warning', evtError.message);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error('track-click error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
