const { supabase, hasSupabase, isSchemaError } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Columns added by migration 008 — may not exist yet
const EXTENDED_COLUMNS = [
  'theme', 'product_url', 'product_title', 'product_description',
  'product_price', 'product_currency', 'product_image_url',
  'product_source', 'product_last_fetched_at'
];

function stripExtendedColumns(record) {
  const stripped = { ...record };
  for (const col of EXTENDED_COLUMNS) delete stripped[col];
  return stripped;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return json(500, { ok: false, error: 'supabase_not_configured', details: { hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars' } });
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
      return json(200, { ok: true, items: data || [] });
    } catch (err) {
      console.error('spotlight-create list error:', err.message);
      return json(500, { ok: false, error: err.message, details: { supabase: err.message } });
    }
  }

  // POST — create or update a spotlight page
  if (method === 'POST') {
    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: 'invalid_json' });
    }

    const title = (payload.title || '').trim();
    if (!title) {
      return json(400, { ok: false, error: 'title_required' });
    }

    const affiliate_url = (payload.affiliate_url || '').trim();
    if (!affiliate_url) {
      return json(400, { ok: false, error: 'affiliate_url_required' });
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
    if (payload.theme !== undefined) record.theme = payload.theme;
    if (payload.product_url !== undefined) record.product_url = payload.product_url;
    if (payload.product_title !== undefined) record.product_title = payload.product_title;
    if (payload.product_description !== undefined) record.product_description = payload.product_description;
    if (payload.product_price !== undefined) record.product_price = payload.product_price;
    if (payload.product_currency !== undefined) record.product_currency = payload.product_currency;
    if (payload.product_image_url !== undefined) record.product_image_url = payload.product_image_url;
    if (payload.product_source !== undefined) record.product_source = payload.product_source;
    if (payload.product_last_fetched_at !== undefined) record.product_last_fetched_at = payload.product_last_fetched_at;

    const conflict = payload.id ? 'id' : 'slug';

    try {
      const { data, error } = await supabase
        .from('spotlight_pages')
        .upsert(record, { onConflict: conflict })
        .select()
        .maybeSingle();
      if (error) throw error;
      return json(200, { ok: true, item: data });
    } catch (err) {
      // If the error is due to missing columns (migration 008 not applied),
      // retry without the extended columns
      if (isSchemaError(err)) {
        console.warn('spotlight-create: schema mismatch, retrying without extended columns');
        const fallback = stripExtendedColumns(record);
        try {
          const { data, error } = await supabase
            .from('spotlight_pages')
            .upsert(fallback, { onConflict: conflict })
            .select()
            .maybeSingle();
          if (error) throw error;
          return json(200, { ok: true, item: data, warning: 'extended_columns_stripped' });
        } catch (retryErr) {
          console.error('spotlight-create upsert retry error:', retryErr.message);
          return json(500, { ok: false, error: 'insert_failed', details: { supabase: retryErr.message } });
        }
      }
      console.error('spotlight-create upsert error:', err.message);
      return json(500, { ok: false, error: 'insert_failed', details: { supabase: err.message } });
    }
  }

  // DELETE — remove a spotlight page by id
  if (method === 'DELETE') {
    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: 'invalid_json' });
    }

    const id = (payload.id || '').trim();
    if (!id) {
      return json(400, { ok: false, error: 'id_required' });
    }

    try {
      const { error } = await supabase.from('spotlight_pages').delete().eq('id', id);
      if (error) throw error;
      return json(200, { ok: true });
    } catch (err) {
      console.error('spotlight-create delete error:', err.message);
      return json(500, { ok: false, error: 'delete_failed', details: { supabase: err.message } });
    }
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
}

exports.handler = withCors(handler);
