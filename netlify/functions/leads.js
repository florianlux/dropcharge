const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'method_not_allowed' })
    };
  }

  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: rows, error } = await supabase
      .from('newsletter_subscribers')
      .select('id,email,status,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    const items = rows || [];
    const emails24h = items.filter(r => r.created_at >= since24h).length;

    const { count: clicks24h, error: clickErr } = await supabase
      .from('clicks')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h);
    if (clickErr) throw clickErr;

    const conversion = clicks24h
      ? Number(((emails24h / clicks24h) * 100).toFixed(1))
      : 0;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        kpis24h: { emails: emails24h, conversion },
        items
      })
    };
  } catch (err) {
    console.error('leads error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
