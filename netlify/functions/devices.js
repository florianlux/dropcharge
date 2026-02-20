const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

function aggregate(rows, field, limit = 5) {
  const map = new Map();
  rows.forEach(row => {
    const value = row[field] || 'unknown';
    const entry = map.get(value) || { value, count: 0 };
    entry.count += 1;
    map.set(value, entry);
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, limit);
}

async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const windowMs = 14 * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(Date.now() - windowMs).toISOString();

  try {
    const { data, error } = await supabase
      .from('events')
      .select('device_hint, platform, country')
      .gte('created_at', sinceIso);
    if (error) throw error;

    const rows = data || [];
    const devices = aggregate(rows, 'device_hint');
    const platforms = aggregate(rows, 'platform');
    const countries = aggregate(rows, 'country', 8);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, devices, platforms, countries, sample: rows.length })
    };
  } catch (err) {
    console.log('devices fetch error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

exports.handler = withCors(handler);
