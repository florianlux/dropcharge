const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');

const STAGES = ['landing_view', 'cta_click', 'deal_click', 'email_submit', 'email_confirmed'];
const WINDOWS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
};

function baseCounts() {
  return STAGES.reduce((acc, stage) => {
    acc[stage] = 0;
    return acc;
  }, {});
}

function calcConversions(counts) {
  const conversions = {};
  for (let i = 1; i < STAGES.length; i += 1) {
    const prev = STAGES[i - 1];
    const current = STAGES[i];
    const prevVal = counts[prev] || 0;
    const currVal = counts[current] || 0;
    conversions[`${prev}_to_${current}`] = prevVal ? Number(((currVal / prevVal) * 100).toFixed(1)) : 0;
  }
  return conversions;
}

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const since30d = new Date(Date.now() - WINDOWS['30d']).toISOString();

  try {
    const { data, error } = await supabase
      .from('events')
      .select('type, created_at')
      .in('type', STAGES)
      .gte('created_at', since30d)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const result = {};
    for (const [label, windowMs] of Object.entries(WINDOWS)) {
      const threshold = Date.now() - windowMs;
      const counts = baseCounts();
      (data || []).forEach(entry => {
        const ts = new Date(entry.created_at).getTime();
        if (ts >= threshold) {
          counts[entry.type] += 1;
        }
      });
      result[label] = {
        counts,
        conversions: calcConversions(counts)
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, funnels: result })
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
