const { supabase, hasSupabase } = require('./_lib/supabase');
const { extractFlags } = require('./_lib/settings');

function defaultResponse() {
  return {
    ok: true,
    flags: extractFlags(),
    experiments: [],
    updatedAt: new Date().toISOString()
  };
}

exports.handler = async function() {
  if (!hasSupabase || !supabase) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify(defaultResponse())
    };
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value, updated_at')
      .in('key', ['flags', 'banner_message', 'experiments']);
    if (error) throw error;

    const map = {};
    let latest = null;
    (data || []).forEach(entry => {
      map[entry.key] = entry.value;
      if (entry.updated_at) {
        const ts = new Date(entry.updated_at).toISOString();
        if (!latest || ts > latest) latest = ts;
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify({
        ok: true,
        flags: extractFlags(map),
        experiments: Array.isArray(map.experiments) ? map.experiments : [],
        updatedAt: latest || new Date().toISOString()
      })
    };
  } catch (err) {
    console.log('public config error', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15' },
      body: JSON.stringify(defaultResponse())
    };
  }
};
