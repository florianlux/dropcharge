const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  const params = event.queryStringParameters || {};
  const slug = (params.slug || '').trim();

  if (!slug) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'slug_required' })
    };
  }

  try {
    const { data, error } = await supabase
      .from('spotlight_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'not_found' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, item: data })
    };
  } catch (err) {
    console.error('spotlight-get error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
