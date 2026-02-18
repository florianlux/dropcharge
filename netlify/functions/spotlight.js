const fs = require('fs');
const path = require('path');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { getCookie, verifySession } = require('./_lib/auth');

const fallbackFile = path.join(__dirname, '..', '..', 'data', 'spotlights.json');

function readLocalSpotlight() {
  try {
    if (!fs.existsSync(fallbackFile)) return null;
    const raw = fs.readFileSync(fallbackFile, 'utf-8');
    const list = JSON.parse(raw);
    if (Array.isArray(list) && list.length) {
      return list[0];
    }
  } catch (err) {
    console.log('Local spotlight read failed', err.message);
  }
  return null;
}

function writeLocalSpotlight(record) {
  try {
    const dir = path.dirname(fallbackFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let list = [];
    if (fs.existsSync(fallbackFile)) {
      try {
        list = JSON.parse(fs.readFileSync(fallbackFile, 'utf-8'));
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }
    }
    list.unshift(record);
    fs.writeFileSync(fallbackFile, JSON.stringify(list, null, 2));
    return true;
  } catch (err) {
    console.log('Local spotlight write failed', err.message);
    return false;
  }
}

async function handleGet() {
  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from('spotlights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      console.log('spotlight get error', error.message);
    } else if (data && data.length) {
      return data[0];
    }
  }
  return readLocalSpotlight();
}

async function handlePost(event) {
  const token = getCookie(event.headers || {}, 'dc_admin_session');
  if (!verifySession(token)) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  if (!payload.title) {
    return { statusCode: 400, body: 'Title required' };
  }

  const record = {
    title: payload.title,
    cover_url: payload.cover_url || null,
    description: payload.description || null,
    amazon_url: payload.amazon_url || null,
    g2g_url: payload.g2g_url || null,
    release_date: payload.release_date || null,
    price: payload.price || null,
    created_at: new Date().toISOString()
  };

  if (hasSupabase && supabase) {
    const { error } = await supabase.from('spotlights').insert(record);
    if (error) {
      console.log('spotlight insert error', error.message);
      return { statusCode: 500, body: 'Failed to save spotlight' };
    }
  } else {
    const ok = writeLocalSpotlight(record);
    if (!ok) {
      return { statusCode: 500, body: 'Failed to store spotlight locally' };
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'GET') {
    const spotlight = await handleGet();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotlight })
    };
  }

  if (event.httpMethod === 'POST') {
    return await handlePost(event);
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
