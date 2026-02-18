const { requireAdmin } = require('./_lib/admin-token');
const { supabase, hasSupabase, supabaseUrlPresent, supabaseServiceKeyPresent, verifyConnection } = require('./_lib/supabase');

async function fetchLatestClicks() {
  const { data, error } = await supabase
    .from('clicks')
    .select('id, slug, platform, amount, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  const envStatus = {
    urlPresent: supabaseUrlPresent,
    serviceKeyPresent: supabaseServiceKeyPresent
  };

  if (!supabaseUrlPresent || !supabaseServiceKeyPresent) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connected: false,
        error: 'Supabase env vars missing',
        env: envStatus,
        clicks: []
      })
    };
  }

  if (!hasSupabase) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connected: false,
        error: 'Supabase client not initialised',
        env: envStatus,
        clicks: []
      })
    };
  }

  const connection = await verifyConnection();
  if (!connection.ok) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connected: false,
        error: connection.error || 'Unknown connection error',
        env: envStatus,
        clicks: []
      })
    };
  }

  try {
    const clicks = await fetchLatestClicks();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connected: true, env: envStatus, clicks })
    };
  } catch (err) {
    console.log('admin-health error', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connected: false, error: err.message, env: envStatus, clicks: [] })
    };
  }
};