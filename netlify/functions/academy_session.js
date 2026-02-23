/**
 * Academy Session – validates token, returns user info + access status.
 * GET with x-academy-token header.
 */
const { withCors } = require('./_lib/cors');
const { supabase, hasSupabase } = require('./_lib/supabase');
const crypto = require('crypto');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function resolveSession(token) {
  if (!token || !hasSupabase) return null;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'academy_session_' + tokenHash)
    .maybeSingle();

  if (!data || !data.value) return null;

  let session;
  try { session = typeof data.value === 'string' ? JSON.parse(data.value) : data.value; } catch (e) { return null; }

  // Check expiry
  if (session.created && Date.now() - session.created > SESSION_TTL_MS) {
    // Clean up expired token
    await supabase.from('settings').delete().eq('key', 'academy_session_' + tokenHash);
    return null;
  }

  return session;
}

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
  }

  if (!hasSupabase) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'database not configured' }) };
  }

  const token = event.headers['x-academy-token'];
  const session = await resolveSession(token);

  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'invalid or expired session' }) };
  }

  // Get access info
  const { data: access } = await supabase
    .from('academy_access')
    .select('*')
    .eq('user_id', session.email)
    .maybeSingle();

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      user: { email: session.email },
      access: access || null
    })
  };
});

// Export for reuse by other functions
exports.resolveSession = resolveSession;
