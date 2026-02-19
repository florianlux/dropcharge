const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');

function parseWindow(paramsWindow) {
  const allowed = new Set(['1d', '7d', '30d']);
  if (!paramsWindow || !allowed.has(paramsWindow)) return '7d';
  return paramsWindow;
}

function windowToMs(label) {
  switch (label) {
    case '1d':
      return 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    case '7d':
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

function aggregateField(rows, field, limit = 10) {
  const map = new Map();
  rows.forEach(row => {
    const value = (row[field] || '').trim();
    if (!value) return;
    const entry = map.get(value) || { value, count: 0 };
    entry.count += 1;
    map.set(value, entry);
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, limit);
}

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const params = event.queryStringParameters || {};
  const windowLabel = parseWindow(params.window);
  const sinceIso = new Date(Date.now() - windowToMs(windowLabel)).toISOString();

  try {
    const { data, error } = await supabase
      .from('events')
      .select('utm_source, utm_medium, utm_campaign, referrer, path')
      .gte('created_at', sinceIso);
    if (error) throw error;

    const rows = data || [];
    const response = {
      ok: true,
      window: windowLabel,
      top: {
        sources: aggregateField(rows, 'utm_source'),
        mediums: aggregateField(rows, 'utm_medium'),
        campaigns: aggregateField(rows, 'utm_campaign'),
        referrers: aggregateField(rows, 'referrer'),
        landings: aggregateField(rows, 'path')
      }
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(response)
    };
  } catch (err) {
    console.log('utm fetch error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
