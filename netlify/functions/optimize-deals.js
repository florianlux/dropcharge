const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

const DAY_MS = 24 * 60 * 60 * 1000;
const CTR_BOOST_THRESHOLD = 2; // %
const CTR_DROP_THRESHOLD = 0.5; // %
const CLICK_MIN_FOR_DROP = 200;
const PRIORITY_STEP = 50;
const PRIORITY_CAP = 999;

async function fetchDeals() {
  const { data, error } = await supabase
    .from('spotlights')
    .select('id, slug, title, priority, active');
  if (error) throw error;
  return data || [];
}

async function fetchEventStats(slugs) {
  if (!slugs.length) return {};
  const since7d = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const { data, error } = await supabase
    .from('events')
    .select('slug, type')
    .in('slug', slugs)
    .in('type', ['cta_click', 'deal_click'])
    .gte('created_at', since7d)
    .limit(5000);
  if (error) throw error;
  const stats = {};
  (data || []).forEach((row) => {
    if (!row.slug) return;
    if (!stats[row.slug]) {
      stats[row.slug] = { cta: 0, deal: 0 };
    }
    if (row.type === 'cta_click') stats[row.slug].cta += 1;
    if (row.type === 'deal_click') stats[row.slug].deal += 1;
  });
  return stats;
}

function evaluateDeal(deal, metrics) {
  const cta = metrics?.cta || 0;
  const dealClicks = metrics?.deal || 0;
  const ctr = cta > 0 ? (dealClicks / cta) * 100 : 0;

  if (ctr > CTR_BOOST_THRESHOLD) {
    const nextPriority = Math.min((deal.priority || 0) + PRIORITY_STEP, PRIORITY_CAP);
    if (nextPriority !== deal.priority) {
      return {
        action: 'boost',
        ctr: Number(ctr.toFixed(2)),
        from: deal.priority || 0,
        to: nextPriority
      };
    }
  }

  if (ctr < CTR_DROP_THRESHOLD && dealClicks >= CLICK_MIN_FOR_DROP && deal.active !== false) {
    return {
      action: 'deactivate',
      ctr: Number(ctr.toFixed(2)),
      clicks: dealClicks
    };
  }

  return null;
}

async function applyAdjustments(jobs) {
  const results = [];
  for (const job of jobs) {
    if (job.action === 'boost') {
      const { error } = await supabase
        .from('spotlights')
        .update({ priority: job.to, updated_at: new Date().toISOString() })
        .eq('id', job.id);
      if (!error) results.push(job.log);
    }
    if (job.action === 'deactivate') {
      const { error } = await supabase
        .from('spotlights')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', job.id);
      if (!error) results.push(job.log);
    }
  }
  return results;
}

async function handler(event) {
  const headers = event.headers || {};
  const isScheduled = Boolean(headers['x-netlify-scheduled-function-name']);

  if (!isScheduled) {
    const authError = requireAdmin(headers);
    if (authError) return authError;
  }

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  try {
    const deals = await fetchDeals();
    const slugMap = deals.reduce((acc, deal) => {
      if (deal.slug) acc[deal.slug] = deal;
      return acc;
    }, {});
    const slugs = Object.keys(slugMap);
    const metricsMap = await fetchEventStats(slugs);

    const jobs = [];
    deals.forEach((deal) => {
      if (!deal.slug) return;
      const decision = evaluateDeal(deal, metricsMap[deal.slug]);
      if (!decision) return;
      if (decision.action === 'boost') {
        jobs.push({
          action: 'boost',
          id: deal.id,
          log: { slug: deal.slug, title: deal.title, ...decision }
        });
        jobs[jobs.length - 1].to = decision.to;
      } else if (decision.action === 'deactivate') {
        jobs.push({
          action: 'deactivate',
          id: deal.id,
          log: { slug: deal.slug, title: deal.title, ...decision }
        });
      }
    });

    const applied = await applyAdjustments(jobs);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        summary: {
          total: deals.length,
          inspected: slugs.length,
          actions: applied.length
        },
        actions: applied
      })
    };
  } catch (err) {
    console.log('optimizer error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
exports.schedule = '0 5 * * *';
