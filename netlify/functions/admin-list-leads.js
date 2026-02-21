const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { withLogging } = require('./_lib/logger');

async function handler(event, context, logger) {
  const authError = requireAdmin(event.headers || {});
  if (authError) {
    logger.warn('Admin authentication failed');
    return authError;
  }

  if (!hasSupabase || !supabase) {
    logger.error('Supabase not configured');
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const params = event.queryStringParameters || {};
  const status = params.status && params.status !== 'all' ? params.status : null;
  const search = (params.search || '').trim();
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);

  logger.info('Listing leads', { status, search, limit, offset });

  try {
    let query = supabase
      .from('newsletter_leads')
      .select('id,email,status,source,page,created_at,last_sent_at,confirmed_at,unsubscribed_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('email', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    logger.success(200, 'Leads listed successfully', { count, returned: data?.length || 0 });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, items: data || [], total: count ?? 0 })
    };
  } catch (err) {
    logger.error('Failed to list leads', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(withLogging('admin-list-leads', handler));
