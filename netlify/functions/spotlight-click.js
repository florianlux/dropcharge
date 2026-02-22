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
  if (lowered.includes('mobile') || lowered.includes('iphone') || lowered.includes('android')) return 'mobile';
  if (lowered.includes('tablet') || lowered.includes('ipad')) return 'tablet';
  return 'desktop';
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_json' })
    };
  }

  const slug = (payload.slug || '').trim();
  if (!slug) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'slug_required' })
    };
  }

  const headers = event.headers || {};
  const userAgent = headers['user-agent'] || '';
  const ipRaw = (headers['x-forwarded-for'] || headers['client-ip'] || '').split(',')[0].trim() || null;

  try {
    // Increment click counter on the spotlight page
    const { error: rpcError } = await supabase.rpc('increment_spotlight_clicks', { page_slug: slug });
    if (rpcError) {
      // Fallback: manual increment if RPC not available
      const { data: page } = await supabase
        .from('spotlight_pages')
        .select('id, clicks')
        .eq('slug', slug)
        .maybeSingle();
      if (page) {
        await supabase
          .from('spotlight_pages')
          .update({ clicks: (page.clicks || 0) + 1 })
          .eq('id', page.id);
      }
    }

    // Log to events table
    const eventRecord = {
      type: 'spotlight_click',
      name: 'spotlight_click',
      slug: 'spotlight:' + slug,
      user_agent_hash: hashValue(userAgent),
      device_hint: detectDevice(userAgent),
      country: payload.country || null,
      meta: { source: 'spotlight', spotlight_slug: slug },
      created_at: new Date().toISOString()
    };
    const { error: evtError } = await supabase.from('events').insert(eventRecord);
    if (evtError) {
      console.log('spotlight-click event insert warning:', evtError.message);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error('spotlight-click error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
