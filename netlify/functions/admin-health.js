const { requireAdmin, authEnabled } = require('./_lib/admin-token');
const { supabase, hasSupabase, supabaseUrlPresent, supabaseServiceKeyPresent, verifyConnection } = require('./_lib/supabase');

const buildSha = process.env.COMMIT_REF || process.env.VERCEL_GIT_COMMIT_SHA || 'local';

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) {
    return authError;
  }

  const basePayload = {
    authEnabled,
    hasSupabase,
    build: buildSha,
    env: {
      supabaseUrl: supabaseUrlPresent,
      supabaseServiceKey: supabaseServiceKeyPresent
    }
  };

  if (!supabaseUrlPresent || !supabaseServiceKeyPresent) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        ok: false,
        error: 'Supabase env vars missing'
      })
    };
  }

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        ok: false,
        error: 'Supabase client not initialised'
      })
    };
  }

  const connection = await verifyConnection();
  if (!connection.ok) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        ok: false,
        error: connection.error || 'Unknown connection error'
      })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...basePayload,
      ok: true
    })
  };
};
