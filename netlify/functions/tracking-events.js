/**
 * tracking-events.js – Admin GET endpoint.
 * Paginated recent events stream with optional filters.
 *
 * Query params:
 *   limit       – rows per page (max 100, default 50)
 *   offset      – pagination offset (default 0)
 *   event_name  – filter by event name
 *   slug        – filter by slug
 *   utm_campaign – filter
 *   utm_source   – filter
 *   range       – 24h|7d|30d (default: 7d)
 */

const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

function sinceDate(range) {
  const hours = range === '24h' ? 24 : range === '30d' ? 720 : 168;
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

exports.handler = withCors(async (event) => {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  const p = event.queryStringParameters || {};
  const limit = Math.min(parseInt(p.limit, 10) || 50, 100);
  const offset = Math.max(parseInt(p.offset, 10) || 0, 0);
  const range = p.range || '7d';
  const since = sinceDate(range);

  try {
    let query = supabase
      .from('events')
      .select('id,ts,created_at,event_name,name,type,slug,path,utm_source,utm_medium,utm_campaign,session_key,user_id,device_type,device_hint,country,props,meta')
      .gte('ts', since)
      .order('ts', { ascending: false })
      .range(offset, offset + limit - 1);

    if (p.event_name) query = query.eq('event_name', p.event_name);
    if (p.slug) query = query.eq('slug', p.slug);
    if (p.utm_campaign) query = query.eq('utm_campaign', p.utm_campaign);
    if (p.utm_source) query = query.eq('utm_source', p.utm_source);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, items: data || [], total: count, limit, offset })
    };
  } catch (err) {
    console.error('tracking-events error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
});
