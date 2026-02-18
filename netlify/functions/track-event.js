const fs = require('fs');
const pathmod = require('path');
const { supabase, hasSupabase } = require('./_lib/supabase');

function dataFile() {
  const dir = pathmod.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return pathmod.join(dir, 'events.json');
}

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

  const record = {
    name: payload.name || 'unknown',
    utm_source: payload.utm_source || null,
    utm_campaign: payload.utm_campaign || null,
    meta: payload.meta || {},
    referrer: event.headers?.referer || null,
    created_at: new Date().toISOString()
  };

  if (hasSupabase && supabase) {
    const { error } = await supabase.from('events').insert(record);
    if (error) {
      console.log('event insert error', error.message);
      return { statusCode: 500, body: 'Server error' };
    }
  } else {
    const file = dataFile();
    const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    list.push(record);
    fs.writeFileSync(file, JSON.stringify(list.slice(-2000), null, 2));
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  };
};
