const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

function toCsv(rows) {
  const header = ['email', 'status', 'source', 'page', 'created_at', 'confirmed_at', 'unsubscribed_at'];
  if (!rows.length) return header.join(',');
  const lines = [header.join(',')];
  rows.forEach((row) => {
    lines.push(header.map((key) => JSON.stringify(row[key] ?? '')).join(','));
  });
  return lines.join('\n');
}

exports.handler = withCors(async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'supabase_not_configured' };
  }

  const params = event.queryStringParameters || {};
  const status = params.status && params.status !== 'all' ? params.status : null;
  const search = (params.search || '').trim();

  try {
    let query = supabase
      .from('newsletter_leads')
      .select('email,status,source,page,created_at,confirmed_at,unsubscribed_at')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('email', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    const csv = toCsv(data || []);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="newsletter-leads.csv"'
      },
      body: csv
    };
  } catch (err) {
    console.log('admin export leads error', err.message);
    return { statusCode: 500, body: 'export_failed' };
  }
});
