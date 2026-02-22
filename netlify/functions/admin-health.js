const { supabase, hasSupabase, verifyConnection } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

const REQUIRED_TABLES = ['clicks', 'emails', 'events', 'newsletter_subscribers', 'settings'];

async function checkTable(name) {
  if (!supabase) return { table: name, ok: false, error: 'no_client' };
  try {
    await supabase.from(name).select('*', { head: true, count: 'exact' }).limit(1);
    return { table: name, ok: true };
  } catch (err) {
    return { table: name, ok: false, error: err.message };
  }
}

async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }

  const checks = { supabase_configured: hasSupabase };

  if (!hasSupabase) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, checks, error: 'supabase_not_configured' })
    };
  }

  const conn = await verifyConnection();
  checks.supabase_connected = conn.ok;

  const tableResults = await Promise.all(REQUIRED_TABLES.map(checkTable));
  checks.tables = tableResults;

  const allOk = conn.ok && tableResults.every(t => t.ok);

  return {
    statusCode: allOk ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: allOk, checks })
  };
}

exports.handler = withCors(handler);
