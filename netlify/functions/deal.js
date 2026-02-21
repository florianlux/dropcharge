const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');
const { hasValidPreviewToken } = require('./_lib/preview-token');

/**
 * Public route handler for /deal/:slug
 * Returns deal data if active, or 404 if inactive (unless preview token provided)
 */
async function handler(event) {
  const slug = event.path?.split('/').filter(Boolean).pop() || '';
  
  if (!slug) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'slug_required' })
    };
  }

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'database_unavailable' })
    };
  }

  try {
    // Check if request has valid preview token
    const isPreview = hasValidPreviewToken(event.headers, slug);

    // Fetch deal from database
    const { data, error } = await supabase
      .from('spotlights')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'deal_not_found' })
        };
      }
      throw error;
    }

    if (!data) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'deal_not_found' })
      };
    }

    // Check if deal is active (respecting time windows)
    const now = Date.now();
    const startsAt = data.starts_at ? new Date(data.starts_at).getTime() : 0;
    const endsAt = data.ends_at ? new Date(data.ends_at).getTime() : Infinity;
    
    const isActive = data.active && 
      (startsAt === 0 || startsAt <= now) &&
      (endsAt === Infinity || endsAt >= now);

    // If not active and no preview token, return 404
    if (!isActive && !isPreview) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'deal_not_available' })
      };
    }

    // Return deal data
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': isActive ? 'public, max-age=60' : 'private, no-cache'
      },
      body: JSON.stringify({
        deal: data,
        preview: !isActive
      })
    };
  } catch (err) {
    console.error('deal fetch error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'server_error' })
    };
  }
}

exports.handler = withCors(handler);
