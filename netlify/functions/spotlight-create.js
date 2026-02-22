const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  const method = event.httpMethod;

  // GET — list all spotlight pages
  if (method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('spotlight_pages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, items: data || [] })
      };
    } catch (err) {
      console.error('spotlight-create list error:', err.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: err.message })
      };
    }
  }

  // POST — create or update a spotlight page
  if (method === 'POST') {
    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'invalid_json' })
      };
    }

    const title = (payload.title || '').trim();
    if (!title) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'title_required' })
      };
    }

    const affiliate_url = (payload.affiliate_url || '').trim();
    if (!affiliate_url) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'affiliate_url_required' })
      };
    }

    const record = {};

    // If id is provided, it's an update
    if (payload.id) {
      record.id = payload.id;
    }

    record.title = title;
    record.slug = payload.slug ? slugify(payload.slug) : slugify(title);
    record.affiliate_url = affiliate_url;

    if (payload.subtitle !== undefined) record.subtitle = payload.subtitle;
    if (payload.brand !== undefined) record.brand = payload.brand;
    if (payload.coupon_code !== undefined) record.coupon_code = payload.coupon_code;
    if (payload.gradient !== undefined) record.gradient = payload.gradient;
    if (payload.logo_url !== undefined) record.logo_url = payload.logo_url;
    if (payload.hero_url !== undefined) record.hero_url = payload.hero_url;
    if (payload.badge_text !== undefined) record.badge_text = payload.badge_text;
    if (payload.cta_text !== undefined) record.cta_text = payload.cta_text || 'Jetzt sichern';
    if (payload.countdown_date !== undefined) record.countdown_date = payload.countdown_date || null;
    if (payload.is_active !== undefined) record.is_active = Boolean(payload.is_active);

    try {
      const { data, error } = await supabase
        .from('spotlight_pages')
        .upsert(record, { onConflict: payload.id ? 'id' : 'slug' })
        .select()
        .maybeSingle();
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, item: data })
      };
    } catch (err) {
      console.error('spotlight-create upsert error:', err.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: err.message })
      };
    }
  }

  // DELETE — remove a spotlight page by id
  if (method === 'DELETE') {
    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'invalid_json' })
      };
    }

    const id = (payload.id || '').trim();
    if (!id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'id_required' })
      };
    }

    try {
      const { error } = await supabase.from('spotlight_pages').delete().eq('id', id);
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      };
    } catch (err) {
      console.error('spotlight-create delete error:', err.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: err.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
  };
}

exports.handler = withCors(handler);
