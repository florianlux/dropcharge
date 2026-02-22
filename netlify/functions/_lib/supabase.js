const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error('Supabase missing env: SUPABASE_URL');
}
if (!serviceKey) {
  console.error('Supabase missing env: SUPABASE_SERVICE_ROLE_KEY');
}

const hasSupabase = Boolean(url && serviceKey);
const supabase = hasSupabase ? createClient(url, serviceKey) : null;

async function verifyConnection() {
  if (!supabase) {
    return { ok: false, error: 'Supabase client not initialised' };
  }
  try {
    // Simple lightweight query to ensure connectivity
    await supabase.from('clicks').select('id', { head: true, count: 'exact' }).limit(1);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const SCHEMA_MISMATCH_PATTERNS = [
  /column (\S+) does not exist/i,
  /relation "([^"]+)" does not exist/i,
  /table[^"]*"([^"]+)"[^"]*not found/i,
  /undefined column/i,
  /could not find.*column/i
];

function isSchemaError(error) {
  const msg = (error && (error.message || error.details || error.hint || '')) || '';
  return SCHEMA_MISMATCH_PATTERNS.some(pattern => pattern.test(msg));
}

function schemaMismatchResponse(err) {
  const msg = (err && (err.message || err.details || '')) || 'unknown schema error';
  console.error('[schema_mismatch]', msg, err);
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      ok: false,
      error: 'schema_mismatch',
      message: msg
    })
  };
}

module.exports = {
  supabase,
  hasSupabase,
  supabaseUrlPresent: Boolean(url),
  supabaseServiceKeyPresent: Boolean(serviceKey),
  verifyConnection,
  isSchemaError,
  schemaMismatchResponse,
};
