const { supabase, hasSupabase } = require('./_lib/supabase');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const record = {
    name: payload.name || 'unknown',
    utm_source: payload.utm_source || null,
    utm_campaign: payload.utm_campaign || null,
    meta: payload.meta || {},
    referrer: event.headers?.referer || null,
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from('events').insert(record);
    if (error) throw error;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.log('event insert error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
