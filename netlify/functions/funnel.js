const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

const STAGE_EVENTS = [
  { key: 'landing_view', label: 'landing_views' },
  { key: 'cta_click', label: 'cta_clicks' },
  { key: 'deal_click', label: 'deal_clicks' },
  { key: 'email_submit', label: 'email_submits' },
  { key: 'email_confirmed', label: 'email_confirms' }
];

const WINDOWS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
};

function baseCounts() {
  return STAGE_EVENTS.reduce((acc, stage) => {
    acc[stage.key] = 0;
    return acc;
  }, {});
}

function calcConversion(curr, prev) {
  if (!prev) return 0;
  return Number(((curr / prev) * 100).toFixed(1));
}

function buildFunnelSummary(counts) {
  const landing = counts.landing_view || 0;
  const cta = counts.cta_click || 0;
  const deal = counts.deal_click || 0;
  const email = counts.email_submit || 0;

  const conversion_landing_to_cta = calcConversion(cta, landing);
  const conversion_cta_to_deal = calcConversion(deal, cta);
  const conversion_deal_to_email = calcConversion(email, deal);

  const dropoff_landing_to_cta = Number((100 - conversion_landing_to_cta).toFixed(1));
  const dropoff_cta_to_deal = Number((100 - conversion_cta_to_deal).toFixed(1));
  const dropoff_deal_to_email = Number((100 - conversion_deal_to_email).toFixed(1));

  return {
    landing_views: landing,
    cta_clicks: cta,
    deal_clicks: deal,
    email_submits: email,
    conversion_landing_to_cta,
    conversion_cta_to_deal,
    conversion_deal_to_email,
    dropoff_landing_to_cta,
    dropoff_cta_to_deal,
    dropoff_deal_to_email
  };
}

function calcConversions(counts) {
  const conversions = {};
  for (let i = 1; i < STAGE_EVENTS.length; i += 1) {
    const prev = STAGE_EVENTS[i - 1].key;
    const current = STAGE_EVENTS[i].key;
    conversions[`${prev}_to_${current}`] = calcConversion(counts[current], counts[prev]);
  }
  return conversions;
}

async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  const params = event.queryStringParameters || {};
  const requestedRange = WINDOWS[params.range] ? params.range : '24h';
  const maxWindowMs = WINDOWS['30d'];
  const since = new Date(Date.now() - maxWindowMs).toISOString();

  try {
    const { data, error } = await supabase
      .from('events')
      .select('type, created_at')
      .in('type', STAGE_EVENTS.map((stage) => stage.key))
      .gte('created_at', since);

    if (error) throw error;

    const result = {};
    Object.entries(WINDOWS).forEach(([label, windowMs]) => {
      const threshold = Date.now() - windowMs;
      const counts = baseCounts();
      (data || []).forEach((row) => {
        const ts = new Date(row.created_at).getTime();
        if (ts >= threshold && counts[row.type] !== undefined) {
          counts[row.type] += 1;
        }
      });
      result[label] = {
        counts,
        conversions: calcConversions(counts),
        summary: buildFunnelSummary(counts)
      };
    });

    const selected = result[requestedRange] || result['24h'];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        range: requestedRange,
        funnel: selected?.summary || buildFunnelSummary(baseCounts()),
        funnels: result
      })
    };
  } catch (err) {
    console.log('funnel fetch error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

exports.handler = withCors(handler);
