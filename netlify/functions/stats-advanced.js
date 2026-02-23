/**
 * stats-advanced.js – Admin GET endpoint.
 * Aggregates ROI-oriented metrics from events:
 *   - Top deals by CTR (cta_click / spotlight_view grouped by slug)
 *   - Top referrers by signup
 *   - Outbound clicks grouped by URL domain
 *   - Signup trend last 7/30 days
 *
 * Query params:
 *   range=24h|7d|30d  (default: 7d)
 */

const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { getTimestampColumn } = require('./_lib/ts-column');

function sinceDate(range) {
  const hours = range === '24h' ? 24 : range === '30d' ? 720 : 168;
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

async function safeRows(query) {
  try {
    const { data, error } = await query;
    return error ? [] : (data || []);
  } catch { return []; }
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

  const params = event.queryStringParameters || {};
  const range = params.range || '7d';
  const since = sinceDate(range);
  const tsCol = await getTimestampColumn(supabase);

  // ── Top deals by CTR ──────────────────────────────────
  const [spotViews, ctaClicks] = await Promise.all([
    safeRows(supabase.from('events').select('slug').eq('event_name', 'spotlight_view').not('slug', 'is', null).gte(tsCol, since).limit(5000)),
    safeRows(supabase.from('events').select('slug').eq('event_name', 'cta_click').not('slug', 'is', null).gte(tsCol, since).limit(5000))
  ]);

  const viewCounts = {};
  spotViews.forEach(r => { viewCounts[r.slug] = (viewCounts[r.slug] || 0) + 1; });
  const clickCounts = {};
  ctaClicks.forEach(r => { clickCounts[r.slug] = (clickCounts[r.slug] || 0) + 1; });

  const allSlugs = new Set([...Object.keys(viewCounts), ...Object.keys(clickCounts)]);
  const topDeals = [...allSlugs].map(slug => {
    const views = viewCounts[slug] || 0;
    const clicks = clickCounts[slug] || 0;
    const ctr = views > 0 ? Math.round((clicks / views) * 1000) / 10 : 0;
    return { slug, views, clicks, ctr };
  }).sort((a, b) => b.clicks - a.clicks).slice(0, 15);

  // ── Top referrers by signup ───────────────────────────
  const signupRows = await safeRows(
    supabase.from('events').select('referrer').eq('event_name', 'newsletter_success').not('referrer', 'is', null).gte(tsCol, since).limit(5000)
  );
  const refCounts = {};
  signupRows.forEach(r => {
    let host = r.referrer;
    try { host = new URL(r.referrer).hostname; } catch { /* keep as-is */ }
    refCounts[host] = (refCounts[host] || 0) + 1;
  });
  const topReferrers = Object.entries(refCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // ── Outbound clicks ───────────────────────────────────
  const outboundRows = await safeRows(
    supabase.from('events').select('meta,props').eq('event_name', 'outbound_click').gte(tsCol, since).limit(5000)
  );
  const outCounts = {};
  outboundRows.forEach(r => {
    const p = r.props || r.meta || {};
    let domain = p.url || '';
    try { domain = new URL(domain).hostname; } catch { /* keep as-is */ }
    if (domain) outCounts[domain] = (outCounts[domain] || 0) + 1;
  });
  const outboundClicks = Object.entries(outCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // ── Signup trend (daily) ──────────────────────────────
  const trendRows = await safeRows(
    supabase.from('events').select(tsCol).eq('event_name', 'newsletter_success').gte(tsCol, since).order(tsCol, { ascending: true }).limit(10000)
  );
  const dailyCounts = {};
  trendRows.forEach(r => {
    const ts = r[tsCol] || r.ts || r.created_at;
    if (!ts) return;
    const day = ts.slice(0, 10); // YYYY-MM-DD
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });
  const signupTrend = Object.entries(dailyCounts)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30'
    },
    body: JSON.stringify({
      ok: true,
      range,
      since,
      top_deals: topDeals,
      top_referrers: topReferrers,
      outbound_clicks: outboundClicks,
      signup_trend: signupTrend
    })
  };
});
