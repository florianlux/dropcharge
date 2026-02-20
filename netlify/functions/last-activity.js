const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

function buildResponse(entry, slug) {
  const now = Date.now();
  const lastTs = entry ? new Date(entry.created_at).getTime() : null;
  const secondsSince = lastTs ? Math.max(0, Math.floor((now - lastTs) / 1000)) : null;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: entry?.slug || slug,
      occurredAt: entry?.created_at || null,
      secondsSince
    })
  };
}

async function handler(event) {
  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'Storage not configured' };
  }

  const slug = (event.queryStringParameters?.slug || 'psn-20').trim();

  try {
    const { data, error } = await supabase
      .from('clicks')
      .select('slug, created_at')
      .eq('slug', slug)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const entry = data && data.length ? data[0] : null;
    return buildResponse(entry, slug);
  } catch (err) {
    console.log('last-activity error', err.message);
    return { statusCode: 500, body: 'Failed to load activity' };
  }
};

exports.handler = withCors(handler);
