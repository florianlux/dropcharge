const { getCookie, verifySession } = require('./_lib/auth');
const { supabase, hasSupabase } = require('./_lib/supabase');

async function fetchLatestClicks() {
  if (!hasSupabase || !supabase) {
    throw new Error('Supabase not configured');
  }
  const { data, error } = await supabase
    .from('clicks')
    .select('id, slug, platform, amount, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

exports.handler = async function(event) {
  const token = getCookie(event.headers || {}, 'dc_admin_session');
  const allowed = await verifySession(token);
  if (!allowed) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connected: false,
        error: 'Supabase nicht konfiguriert',
        clicks: []
      })
    };
  }

  try {
    const clicks = await fetchLatestClicks();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connected: true, clicks })
    };
  } catch (err) {
    console.log('admin-health error', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connected: false, error: err.message, clicks: [] })
    };
  }
};