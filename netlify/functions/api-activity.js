const fs = require('fs');
const path = require('path');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');
const { withLogging } = require('./_lib/logger');

function readLocal() {
  const dir = path.join(__dirname, '..', '..', 'data');
  const file = path.join(dir, 'clicks.json');
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function buildResponse(slug, entries) {
  const now = Date.now();
  const thirtyAgo = now - 30 * 60 * 1000;
  const latest = entries[0] ? new Date(entries[0].created_at).getTime() : null;
  const clicks30m = entries.filter(entry => new Date(entry.created_at).getTime() >= thirtyAgo).length;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug,
      lastClickTs: latest || null,
      clicks30m
    })
  };
}

async function handler(event, context, logger) {
  const slug = (event.queryStringParameters?.slug || 'psn-20').trim();
  logger.info('Fetching activity', { slug });

  if (hasSupabase && supabase) {
    try {
      const { data = [], error } = await supabase
        .from('clicks')
        .select('slug, created_at')
        .eq('slug', slug)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      logger.success(200, 'Activity fetched from Supabase', { slug, count: data.length });
      return buildResponse(slug, data);
    } catch (err) {
      logger.error('Supabase query failed', err, { slug });
    }
  }

  logger.info('Falling back to local data', { slug });
  const entries = readLocal().filter(entry => entry.slug === slug).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return buildResponse(slug, entries);
};

exports.handler = withCors(withLogging('api-activity', handler));
