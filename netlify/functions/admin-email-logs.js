const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

exports.handler = withCors(async (event) => {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'missing_supabase_service_role_key' }) };
  }

  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const template = params.template || null;
  const status = params.status || null;

  try {
    let query = supabase
      .from('email_logs')
      .select('id,recipient,template,subject,status,message_id,error,created_at,sent_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (template) query = query.eq('template', template);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, items: data || [], total: count ?? 0 })
    };
  } catch (err) {
    const msg = (err && (err.message || err.details || '')) || '';

    // Only report "table missing" when the error specifically mentions the
    // email_logs relation / table not existing.  Other schema or transient
    // errors should surface as generic failures so they are not confused with
    // a missing migration.
    const EMAIL_LOGS_MISSING_RE = /relation "?(?:public\.)?email_logs"? does not exist/i;
    if (EMAIL_LOGS_MISSING_RE.test(msg)) {
      console.error('admin-email-logs: table missing', msg);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          ok: false,
          error: 'email_logs_missing',
          hint: 'Run migration 004_email_logs.sql in your Supabase SQL editor to create the email_logs table.'
        })
      };
    }

    console.error('admin-email-logs error', msg);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: msg || 'unknown_error' })
    };
  }
});
