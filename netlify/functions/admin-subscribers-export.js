const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');

function toCsv(rows) {
  if (!rows.length) return 'email,status,created_at,last_sent_at,source';
  const header = ['email', 'status', 'created_at', 'last_sent_at', 'source'];
  const lines = [header.join(',')];
  rows.forEach((row) => {
    lines.push(header.map((key) => JSON.stringify(row[key] ?? '')).join(','));
  });
  return lines.join('\n');
}

exports.handler = async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'supabase_not_configured' };
  }

  const params = event.queryStringParameters || {};
  const status = params.status && params.status !== 'all' ? params.status : null;

  try {
    let query = supabase
      .from('newsletter_signups')
      .select('email, status, created_at, last_sent_at, source')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    const csv = toCsv(data || []);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"'
      },
      body: csv
    };
  } catch (err) {
    console.log('subscribers export error', err.message);
    return { statusCode: 500, body: 'export_failed' };
  }
};
