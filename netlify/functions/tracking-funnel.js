/**
 * tracking-funnel.js – Admin GET endpoint.
 * Computes conversion funnel:
 *   Landing (page_view) → spotlight_view → cta_click → newsletter_success
 *
 * Query params:
 *   range=24h|7d|30d  (default: 7d)
 */

const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

function sinceDate(range) {
  const hours = range === '24h' ? 24 : range === '30d' ? 720 : 168;
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

async function safeCount(query) {
  try {
    const { count, error } = await query;
    return error ? 0 : (count || 0);
  } catch { return 0; }
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

  const [landing, spotlightViews, ctaClicks, newsletterSuccess] = await Promise.all([
    safeCount(supabase.from('events').select('id', { count: 'exact', head: true }).eq('event_name', 'page_view').gte('ts', since)),
    safeCount(supabase.from('events').select('id', { count: 'exact', head: true }).eq('event_name', 'spotlight_view').gte('ts', since)),
    safeCount(supabase.from('events').select('id', { count: 'exact', head: true }).eq('event_name', 'cta_click').gte('ts', since)),
    safeCount(supabase.from('events').select('id', { count: 'exact', head: true }).eq('event_name', 'newsletter_success').gte('ts', since))
  ]);

  function pct(num, denom) {
    if (!denom) return 0;
    return Math.round((num / denom) * 1000) / 10;
  }

  const steps = [
    { name: 'Landing (page_view)', count: landing, pct_prev: 100, pct_top: 100 },
    { name: 'Spotlight View', count: spotlightViews, pct_prev: pct(spotlightViews, landing), pct_top: pct(spotlightViews, landing) },
    { name: 'CTA Click', count: ctaClicks, pct_prev: pct(ctaClicks, spotlightViews), pct_top: pct(ctaClicks, landing) },
    { name: 'Newsletter Success', count: newsletterSuccess, pct_prev: pct(newsletterSuccess, ctaClicks), pct_top: pct(newsletterSuccess, landing) }
  ];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: true, range, since, steps })
  };
});
