const { supabase, hasSupabase, isSchemaError, schemaMismatchResponse } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

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

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // Clicks in last 24h
    const { count: clicks24h, error: clickErr } = await supabase
      .from('clicks')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h);
    if (clickErr) throw clickErr;

    // Events in last 24h
    const { count: events24h, error: evtErr } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h);
    if (evtErr) throw evtErr;

    // Top 10 links by click count (all time, limited to recent 10000 rows for performance)
    const { data: clickRows, error: topErr } = await supabase
      .from('clicks')
      .select('slug')
      .not('slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10000);
    if (topErr) throw topErr;

    const slugCounts = {};
    (clickRows || []).forEach(row => {
      if (row.slug) {
        slugCounts[row.slug] = (slugCounts[row.slug] || 0) + 1;
      }
    });
    const topLinks = Object.entries(slugCounts)
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        clicks_24h: clicks24h ?? 0,
        events_24h: events24h ?? 0,
        top_links: topLinks
      })
    };
  } catch (err) {
    if (isSchemaError(err)) return schemaMismatchResponse(err);
    console.error('admin-analytics error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
});
