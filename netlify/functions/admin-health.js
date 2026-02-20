const { requireAdmin, authEnabled } = require('./_lib/admin-token');
const { supabase, hasSupabase, supabaseUrlPresent, supabaseServiceKeyPresent, verifyConnection } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

const buildSha = process.env.COMMIT_REF || process.env.VERCEL_GIT_COMMIT_SHA || 'local';
const REQUIRED_TABLES = ['clicks', 'emails', 'events', 'spotlights', 'settings'];

async function checkSchema() {
  if (!supabase) return { ok: false, missing: REQUIRED_TABLES };
  const missing = [];
  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase.from(table).select('id', { count: 'exact', head: true }).limit(1);
      if (error) {
        missing.push(table);
      }
    } catch (err) {
      missing.push(table);
    }
  }
  return { ok: missing.length === 0, missing };
}

async function handler(event) {
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
        error: 'Supabase env vars missing',
        schemaOk: false
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
        error: 'Supabase client not initialised',
        schemaOk: false
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
        error: connection.error || 'Unknown connection error',
        schemaOk: false
      })
    };
  }

  const schema = await checkSchema();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...basePayload,
      ok: true,
      schemaOk: schema.ok,
      missingTables: schema.missing
    })
  };
};

exports.handler = withCors(handler);
