const { createClient } = require('@supabase/supabase-js');

function pickEnv(keys = []) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
  }
  return undefined;
}

const url = pickEnv([
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL'
]);
const serviceKey = pickEnv([
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_KEY'
]);

const hasSupabase = Boolean(url && serviceKey);

if (!hasSupabase) {
  console.warn('Supabase env vars missing: need SUPABASE_URL + SUPABASE_SERVICE_KEY');
}

const supabase = hasSupabase ? createClient(url, serviceKey) : null;

module.exports = {
  supabase,
  hasSupabase,
  supabaseUrl: url,
};
