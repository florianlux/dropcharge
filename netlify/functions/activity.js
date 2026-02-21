const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');
const { withLogging } = require('./_lib/logger');
const labelMap = {
  'psn-10': 'PSN 10€',
  'psn-20': 'PSN 20€',
  'psn-50': 'PSN 50€',
  'xbox-1m': 'Xbox Live 1 Monat',
  'xbox-3m': 'Xbox Live 3 Monate',
  'xbox-6m': 'Xbox Live 6 Monate',
  'nintendo-15': 'Nintendo eShop 15€',
  'nintendo-25': 'Nintendo eShop 25€',
  'nintendo-50': 'Nintendo eShop 50€'
};


function formatResponse(count, topSlug) {
  return {
    playload: {
      clicksLast30m: count || 0,
      topDeal: topSlug ? { slug: topSlug, label: labelMap[topSlug] || topSlug } : null
    }
  };
}

async function handler(event, context, logger) {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startIso = startOfDay.toISOString();

  if (hasSupabase && supabase) {
    try {
      logger.info('Fetching activity from Supabase', { startIso, thirtyMinutesAgo });
      const { data: recent = [], error } = await supabase
        .from('clicks')
        .select('slug, created_at')
        .gte('created_at', startIso)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      let last30 = 0;
      const counts = {};
      recent.forEach(entry => {
        if (!entry || !entry.created_at) return;
        if (entry.created_at >= thirtyMinutesAgo) last30 += 1;
        if (entry.slug) counts[entry.slug] = (counts[entry.slug] || 0) + 1;
      });
      const topSlug = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      
      logger.success(200, 'Activity data retrieved', { clicksLast30m: last30, topSlug, totalToday: recent.length });
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clicksLast30m: last30, topDeal: topSlug ? { slug: topSlug, label: labelMap[topSlug] || topSlug } : null })
      };
    } catch (err) {
      logger.error('Activity fetch failed', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load activity' }) };
    }
  }

  logger.error('Supabase not configured');
  return { statusCode: 500, body: 'Storage not configured' };
};

exports.handler = withCors(withLogging('activity', handler));
