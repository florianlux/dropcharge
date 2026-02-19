const { supabase, hasSupabase } = require('./supabase');

async function fetchSettings(keys = []) {
  if (!hasSupabase || !supabase) {
    return {};
  }
  let query = supabase.from('settings').select('key, value');
  if (Array.isArray(keys) && keys.length > 0) {
    query = query.in('key', keys);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data || []).reduce((acc, entry) => {
    acc[entry.key] = entry.value;
    return acc;
  }, {});
}

async function upsertSettings(updates = {}) {
  if (!hasSupabase || !supabase) {
    throw new Error('supabase_not_configured');
  }
  const rows = Object.entries(updates).map(([key, value]) => ({
    key,
    value: value ?? {},
    updated_at: new Date().toISOString()
  }));
  if (!rows.length) return { ok: true };
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
  return { ok: true };
}

function extractFlags(settingsMap = {}) {
  const defaults = {
    disable_email_capture: false,
    disable_affiliate_redirect: false,
    banner_message: ''
  };
  const flags = typeof settingsMap.flags === 'object' && settingsMap.flags !== null ? settingsMap.flags : {};
  const bannerMessage = typeof settingsMap.banner_message === 'string'
    ? settingsMap.banner_message
    : (typeof flags.banner_message === 'string' ? flags.banner_message : '');
  return {
    ...defaults,
    ...flags,
    banner_message: bannerMessage
  };
}

module.exports = {
  fetchSettings,
  upsertSettings,
  extractFlags
};
