const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

const hasSupabase = Boolean(url && serviceKey);

if (!hasSupabase) {
  console.warn('Supabase env vars missing: SUPABASE_URL / SUPABASE_SERVICE_KEY');
}

const supabase = hasSupabase ? createClient(url, serviceKey) : null;

module.exports = {
  supabase,
  hasSupabase,
};
