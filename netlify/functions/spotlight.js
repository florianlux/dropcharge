const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

function slugify(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || null;
}

function sanitizePayload(payload = {}) {
  return {
    title: (payload.title || '').trim(),
    subtitle: payload.subtitle || null,
    description: payload.description || null,
    platform: payload.platform || null,
    vendor: payload.vendor || null,
    slug: payload.slug || slugify(payload.title),
    price: payload.price || null,
    price_cents: typeof payload.price_cents === 'number' ? payload.price_cents : null,
    affiliate_url: payload.affiliate_url || null,
    code_label: payload.code_label || null,
    code_url: payload.code_url || null,
    cover_url: payload.cover_url || null,
    amazon_url: payload.amazon_url || null,
    g2g_url: payload.g2g_url || null,
    release_date: payload.release_date || null,
    active: typeof payload.active === 'boolean' ? payload.active : true,
    starts_at: payload.starts_at || null,
    ends_at: payload.ends_at || null,
    priority: typeof payload.priority === 'number' ? payload.priority : 0
  };
}

async function fetchActiveSpotlight() {
  if (!hasSupabase || !supabase) {
    return null;
  }
  const now = Date.now();
  const { data, error } = await supabase
    .from('spotlights')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  const entries = data || [];
  return entries.find(entry => {
    const startOk = !entry.starts_at || new Date(entry.starts_at).getTime() <= now;
    const endOk = !entry.ends_at || new Date(entry.ends_at).getTime() >= now;
    return startOk && endOk;
  }) || entries[0] || null;
}

async function handleGet() {
  try {
    const spotlight = await fetchActiveSpotlight();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({ spotlight })
    };
  } catch (err) {
    console.error('spotlight get error:', err.message);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ ok: true, spotlight: null })
    };
  }
}

async function handleAdminMutation(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'Storage not configured' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  if (event.httpMethod === 'POST') {
    if (!payload.title) {
      return { statusCode: 400, body: 'Title required' };
    }
    const record = sanitizePayload(payload);
    record.created_at = new Date().toISOString();
    record.updated_at = record.created_at;

    const { error } = await supabase.from('spotlights').insert(record);
    if (error) {
      console.log('spotlight insert error', error.message);
      return { statusCode: 500, body: 'Failed to save spotlight' };
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (event.httpMethod === 'PUT') {
    if (!payload.id) {
      return { statusCode: 400, body: 'ID required' };
    }
    const record = sanitizePayload(payload);
    record.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('spotlights')
      .update(record)
      .eq('id', payload.id);
    if (error) {
      console.log('spotlight update error', error.message);
      return { statusCode: 500, body: 'Failed to update spotlight' };
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (event.httpMethod === 'DELETE') {
    const id = payload.id || event.queryStringParameters?.id;
    if (!id) {
      return { statusCode: 400, body: 'ID required' };
    }
    const { error } = await supabase.from('spotlights').delete().eq('id', id);
    if (error) {
      console.log('spotlight delete error', error.message);
      return { statusCode: 500, body: 'Failed to delete spotlight' };
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
}

async function handler(event) {
  if (event.httpMethod === 'GET') {
    return handleGet(event);
  }
  return handleAdminMutation(event);
};

exports.handler = withCors(handler);
