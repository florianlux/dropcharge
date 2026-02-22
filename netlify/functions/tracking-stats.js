/**
 * tracking-stats.js – Admin GET endpoint.
 * Returns KPI summary for the selected time window (24h | 7d | 30d).
 *
 * Query params:
 *   range=24h|7d|30d  (default: 7d)
 */

const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

function sinceDate(range) {
  const hours = range === '24h' ? 24 : range === '30d' ? 720 : 168; // default 7d
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

async function safeCount(query) {
  try {
    const { count, error } = await query;
    return error ? 0 : (count || 0);
  } catch { return 0; }
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

  const [
    pageviews,
    sessions,
    ctaClicks,
    spotlightViews,
    newsletterSuccess,
    consentedSessions
  ] = await Promise.all([
    safeCount(supabase.from('events').select('id', { count: 'exact', head: true }).eq('event_name', 'page_view').gte('ts', since)),
    safeCount(supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('first_seen', since)),
    safeCount(supabase.from('events').select('id', { count: 'exact', head: true }).eq('event_name', 'cta_click').gte('ts', since)),
    safeCount(supabase.from('events').select('id', { count: 'exact', head: true }).eq('event_name', 'spotlight_view').gte('ts', since)),
    safeCount(supabase.from('events').select('id', { count: 'exact', head: true }).eq('event_name', 'newsletter_success').gte('ts', since)),
    safeCount(supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('consent_analytics', true).gte('first_seen', since))
  ]);

  // Unique visitors: count distinct user_ids where consented, fallback session_keys
  let uniques = 0;
  try {
    const { data: uidRows } = await supabase
      .from('sessions')
      .select('user_id')
      .not('user_id', 'is', null)
      .gte('first_seen', since);
    const uidSet = new Set((uidRows || []).map(r => r.user_id));
    if (uidSet.size > 0) {
      uniques = uidSet.size;
    } else {
      // fallback: count distinct session_keys
      const { data: skRows } = await supabase
        .from('sessions')
        .select('session_key')
        .gte('first_seen', since);
      uniques = new Set((skRows || []).map(r => r.session_key)).size;
    }
  } catch { /* ignore */ }

  // Top UTM sources
  const sourceRows = await safeRows(
    supabase.from('sessions').select('utm_source').not('utm_source', 'is', null).gte('first_seen', since).limit(2000)
  );
  const sourceCounts = {};
  sourceRows.forEach(r => { sourceCounts[r.utm_source] = (sourceCounts[r.utm_source] || 0) + 1; });
  const topSources = Object.entries(sourceCounts)
    .map(([k, v]) => ({ name: k, count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top campaigns
  const campaignRows = await safeRows(
    supabase.from('sessions').select('utm_campaign').not('utm_campaign', 'is', null).gte('first_seen', since).limit(2000)
  );
  const campaignCounts = {};
  campaignRows.forEach(r => { campaignCounts[r.utm_campaign] = (campaignCounts[r.utm_campaign] || 0) + 1; });
  const topCampaigns = Object.entries(campaignCounts)
    .map(([k, v]) => ({ name: k, count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top spotlights by cta_click
  const spotlightRows = await safeRows(
    supabase.from('events').select('slug').eq('event_name', 'cta_click').not('slug', 'is', null).gte('ts', since).limit(2000)
  );
  const spotlightCounts = {};
  spotlightRows.forEach(r => { spotlightCounts[r.slug] = (spotlightCounts[r.slug] || 0) + 1; });
  const topSpotlights = Object.entries(spotlightCounts)
    .map(([k, v]) => ({ slug: k, count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Device breakdown
  const deviceRows = await safeRows(
    supabase.from('sessions').select('device_type').gte('first_seen', since).limit(2000)
  );
  const deviceCounts = {};
  deviceRows.forEach(r => { const d = r.device_type || 'unknown'; deviceCounts[d] = (deviceCounts[d] || 0) + 1; });

  // Top referrers
  const referrerRows = await safeRows(
    supabase.from('sessions').select('referrer').not('referrer', 'is', null).gte('first_seen', since).limit(2000)
  );
  const referrerCounts = {};
  referrerRows.forEach(r => { referrerCounts[r.referrer] = (referrerCounts[r.referrer] || 0) + 1; });
  const topReferrers = Object.entries(referrerCounts)
    .map(([k, v]) => ({ name: k, count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const ctr = spotlightViews > 0 ? Math.round((ctaClicks / spotlightViews) * 1000) / 10 : 0;
  const newsletterConversion = pageviews > 0 ? Math.round((newsletterSuccess / pageviews) * 1000) / 10 : 0;
  const consentRate = sessions > 0 ? Math.round((consentedSessions / sessions) * 1000) / 10 : 0;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      ok: true,
      range,
      since,
      kpis: {
        pageviews,
        sessions,
        uniques,
        cta_clicks: ctaClicks,
        spotlight_views: spotlightViews,
        newsletter_success: newsletterSuccess,
        ctr,
        newsletter_conversion: newsletterConversion,
        consent_rate: consentRate
      },
      top_sources: topSources,
      top_campaigns: topCampaigns,
      top_spotlights: topSpotlights,
      top_referrers: topReferrers,
      device_breakdown: deviceCounts
    })
  };
});
