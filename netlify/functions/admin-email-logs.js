const { supabase, hasSupabase, isSchemaError } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

console.log("ENV CHECK:", {
  hasResendKey: !!process.env.RESEND_API_KEY,
  hasFrom: !!process.env.RESEND_FROM,
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

exports.handler = withCors(async (event) => {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const template = params.template || null;
  const status = params.status || null;

  try {
    let query = supabase
      .from('email_logs')
      .select('id,recipient,template,subject,status,error,created_at,sent_at', { count: 'exact' })
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
    if (isSchemaError(err)) {
      console.error('admin-email-logs schema error', msg);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({
          ok: true,
          items: [],
          total: 0,
          warning: 'schema_missing',
          table: 'email_logs',
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
