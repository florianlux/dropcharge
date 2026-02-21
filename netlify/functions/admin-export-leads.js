const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');

function toCsv(rows) {
  const header = ['email', 'status', 'source', 'created_at', 'unsubscribed_at', 'last_sent_at', 'utm_source', 'utm_campaign'];
  if (!rows.length) return header.join(',');
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
  const search = (params.search || '').trim();

  try {
    console.log('[admin-export-leads] Exporting with filters:', { status, search });
    
    let query = supabase
      .from('newsletter_subscribers')
      .select('email,status,source,created_at,unsubscribed_at,last_sent_at,utm_source,utm_campaign')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('email', `%${search}%`);

    const { data, error } = await query;
    if (error) {
      console.error('[admin-export-leads] Query error:', error.message);
      throw error;
    }

    console.log('[admin-export-leads] Exporting', data?.length || 0, 'subscribers');
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
    console.error('[admin-export-leads] Error:', err.message);
    return { statusCode: 500, body: 'export_failed' };
  }
};
