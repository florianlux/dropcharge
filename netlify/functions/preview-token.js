const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { generatePreviewToken } = require('./_lib/preview-token');

/**
 * Admin endpoint to generate preview tokens
 * POST /preview-token with { slug: "deal-slug" }
 */
async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'method_not_allowed' })
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'invalid_json' })
    };
  }

  const { slug } = payload;
  if (!slug) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'slug_required' })
    };
  }

  try {
    const token = generatePreviewToken(slug);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        ok: true,
        token,
        slug,
        expiresIn: 300 // 5 minutes in seconds
      })
    };
  } catch (err) {
    console.error('preview token generation error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'token_generation_failed' })
    };
  }
}

exports.handler = withCors(handler);
