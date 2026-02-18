const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url) {
  console.error('Supabase missing env: SUPABASE_URL');
}
if (!serviceKey) {
  console.error('Supabase missing env: SUPABASE_SERVICE_KEY');
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

module.exports = {
  supabase,
  hasSupabase,
  supabaseUrlPresent: Boolean(url),
  supabaseServiceKeyPresent: Boolean(serviceKey),
  verifyConnection,
};
