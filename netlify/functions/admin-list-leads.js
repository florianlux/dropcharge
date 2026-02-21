const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

exports.handler = withCors(async (event) => {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const params = event.queryStringParameters || {};
  const status = params.status && params.status !== 'all' ? params.status : null;
  const search = (params.search || '').trim();
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);

  try {
    let query = supabase
      .from('newsletter_subscribers')
      .select('id,email,status,created_at,last_sent_at,unsubscribed_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('email', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, items: data || [], total: count ?? 0 })
    };
  } catch (err) {
    console.error('admin list leads error', err.message, err.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
});
