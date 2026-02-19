const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');

function parseIntParam(value, fallback) {
  if (!value && value !== 0) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildSearchFilter(query, search) {
  if (!search) return query;
  const safe = String(search).replace(/,/g, ' ');
  const term = `%${safe}%`;
  return query.or(`slug.ilike.${term},path.ilike.${term},referrer.ilike.${term}`);
}

function summarizeEvents(items = []) {
  const summary = {
    total: items.length,
    types: {},
    platforms: {},
    latest: items[0]?.created_at || null
  };
  items.forEach(item => {
    summary.types[item.type] = (summary.types[item.type] || 0) + 1;
    if (item.platform) {
      summary.platforms[item.platform] = (summary.platforms[item.platform] || 0) + 1;
    }
  });
  return summary;
}

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(parseIntParam(params.limit, 100), 1), 500);
  const sinceMinutes = parseIntParam(params.sinceMinutes, null);

  let query = supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (sinceMinutes) {
    const sinceIso = new Date(Date.now() - sinceMinutes * 60000).toISOString();
    query = query.gte('created_at', sinceIso);
  }
  if (params.type) {
    query = query.eq('type', params.type);
  }
  if (params.platform) {
    query = query.eq('platform', params.platform);
  }
  if (params.slug) {
    query = query.ilike('slug', `${params.slug}%`);
  }
  if (params.session) {
    query = query.eq('session_id', params.session);
  }
  if (params.search) {
    query = buildSearchFilter(query, params.search);
  }

  try {
    const { data, error } = await query;
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, events: data || [], summary: summarizeEvents(data || []) })
    };
  } catch (err) {
    console.log('events fetch error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
