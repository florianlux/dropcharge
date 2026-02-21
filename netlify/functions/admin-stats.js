const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

/**
 * GET /admin/stats?window=24h|7d
 * Returns aggregated analytics metrics for admin chips:
 * - clicks: Total deal clicks
 * - conversions: Total email submits
 * - CTR: Conversion rate (conversions/clicks * 100)
 * - revenue: Sum of estimated revenue
 */

const WINDOW_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
};

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ ok: false, error: 'Supabase not configured' }) 
    };
  }

  const params = event.queryStringParameters || {};
  const window = params.window || '24h';
  
  if (!WINDOW_MS[window]) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: 'Invalid window. Use 24h or 7d' })
    };
  }

  const now = Date.now();
  const windowMs = WINDOW_MS[window];
  const sinceIso = new Date(now - windowMs).toISOString();

  try {
    // Fetch events for clicks and conversions
    const { data: eventRows = [], error: eventErr } = await supabase
      .from('events')
      .select('type, slug, created_at')
      .in('type', ['deal_click', 'email_submit'])
      .gte('created_at', sinceIso);
    
    if (eventErr) throw eventErr;

    // Count clicks and conversions
    let clicks = 0;
    let conversions = 0;
    
    eventRows.forEach(row => {
      if (row.type === 'deal_click') clicks++;
      if (row.type === 'email_submit') conversions++;
    });

    // Calculate CTR
    const ctr = clicks > 0 ? (conversions / clicks) * 100 : 0;

    // Fetch all active deals to calculate revenue
    const { data: deals = [], error: dealsErr } = await supabase
      .from('spotlights')
      .select('slug, price, price_cents')
      .eq('active', true);
    
    if (dealsErr) throw dealsErr;

    // Build price map
    const priceMap = {};
    deals.forEach(deal => {
      if (!deal.slug) return;
      const price = deal.price_cents 
        ? deal.price_cents / 100 
        : deal.price 
        ? toNumber(deal.price) 
        : 0;
      priceMap[deal.slug] = price;
    });

    // Calculate revenue (clicks * price for each deal)
    let revenue = 0;
    const clicksBySlug = {};
    
    eventRows.forEach(row => {
      if (row.type === 'deal_click' && row.slug) {
        clicksBySlug[row.slug] = (clicksBySlug[row.slug] || 0) + 1;
      }
    });

    Object.entries(clicksBySlug).forEach(([slug, clickCount]) => {
      const price = priceMap[slug] || 0;
      revenue += price * clickCount;
    });

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json', 
        'Cache-Control': 'no-store, max-age=0' 
      },
      body: JSON.stringify({
        ok: true,
        window,
        generatedAt: new Date().toISOString(),
        metrics: {
          clicks,
          conversions,
          ctr: Number(ctr.toFixed(2)),
          revenue: Number(revenue.toFixed(2))
        }
      })
    };
  } catch (err) {
    console.error('admin-stats error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
