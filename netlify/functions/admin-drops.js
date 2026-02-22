const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { normalizeG2AReflink, isG2AUrl } = require('./_lib/affiliates');

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

  // GET — list all drops
  if (method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('drops')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, items: data || [] })
      };
    } catch (err) {
      console.error('admin-drops list error:', err.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: err.message })
      };
    }
  }

  // POST — create or update a drop
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

    const id = (payload.id || '').trim().toLowerCase();
    if (!id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'id_required' })
      };
    }

    // Normalize G2A destination URL server-side
    let destinationUrl = (payload.destination_url || '').trim();
    const gtag = process.env.G2A_GTAG;
    if (destinationUrl && gtag && isG2AUrl(destinationUrl)) {
      destinationUrl = normalizeG2AReflink(destinationUrl, gtag);
    }

    const record = { id };
    if (payload.title !== undefined) record.title = payload.title;
    if (payload.platform !== undefined) record.platform = payload.platform;
    if (payload.value_eur !== undefined) record.value_eur = payload.value_eur;
    if (destinationUrl) record.destination_url = destinationUrl;
    if (payload.active !== undefined) record.active = Boolean(payload.active);
    if (payload.featured !== undefined) record.featured = Boolean(payload.featured);
    if (payload.sort_order !== undefined) record.sort_order = Number(payload.sort_order) || 0;

    try {
      const { data, error } = await supabase
        .from('drops')
        .upsert(record, { onConflict: 'id' })
        .select()
        .maybeSingle();
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, drop: data })
      };
    } catch (err) {
      console.error('admin-drops upsert error:', err.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: err.message })
      };
    }
  }

  // DELETE — remove a drop by id
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
      const { error } = await supabase.from('drops').delete().eq('id', id);
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      };
    } catch (err) {
      console.error('admin-drops delete error:', err.message);
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
