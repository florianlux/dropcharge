const { supabase, hasSupabase, verifyConnection } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');
const { requireAdmin } = require('./_lib/admin-token');

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  const authErr = requireAdmin(event.headers);
  if (authErr) return authErr;

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  const result = {
    ok: false,
    pixelDetected: Boolean(process.env.TIKTOK_PIXEL_ID),
    lastEventSeenAt: null,
    clickTemuCount24h: 0,
    landingLive: true,
    dbOk: false
  };

  if (!hasSupabase) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  }

  // DB connectivity
  const conn = await verifyConnection();
  result.dbOk = conn.ok;

  // Last event timestamp
  try {
    const { data } = await supabase
      .from('events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      result.lastEventSeenAt = data[0].created_at;
    }
  } catch { /* ignore */ }

  // ClickTemu count last 24h
  try {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase
      .from('events')
      .select('*', { head: true, count: 'exact' })
      .eq('event_type', 'ClickTemu')
      .gte('created_at', since);
    result.clickTemuCount24h = count || 0;
  } catch { /* ignore */ }

  result.ok = result.dbOk;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  };
}

exports.handler = withCors(handler);
