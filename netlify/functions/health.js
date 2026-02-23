/**
 * health.js – Public healthcheck endpoint.
 *
 * Checks:
 *   - Required env vars present (boolean only, no values exposed)
 *   - Optional: Supabase connectivity ping
 *
 * GET /.netlify/functions/health
 */

const { hasSupabase, supabaseUrlPresent, supabaseServiceKeyPresent, verifyConnection } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_TOKEN'
];

const OPTIONAL_ENV = [
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'APP_BASE_URL',
  'EMAIL_REPLY_TO',
  'ADMIN_PASSWORD_HASH',
  'ENABLE_DOUBLE_OPT_IN',
  'TIKTOK_PIXEL_ID'
];

exports.handler = withCors(async (event) => {
  const envChecks = {};
  let allRequired = true;

  REQUIRED_ENV.forEach(key => {
    const present = Boolean(process.env[key]);
    envChecks[key] = present;
    if (!present) allRequired = false;
  });

  OPTIONAL_ENV.forEach(key => {
    envChecks[key] = Boolean(process.env[key]);
  });

  let dbOk = false;
  let dbError = null;
  if (hasSupabase) {
    try {
      const result = await verifyConnection();
      dbOk = result.ok;
      if (!result.ok) dbError = result.error;
    } catch (err) {
      dbError = err.message;
    }
  }

  const healthy = allRequired && dbOk;

  return {
    statusCode: healthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      ok: healthy,
      checks: {
        env: envChecks,
        all_required_env: allRequired,
        supabase_configured: hasSupabase,
        supabase_connected: dbOk,
        ...(dbError ? { supabase_error: dbError } : {})
      },
      timestamp: new Date().toISOString()
    })
  };
});
