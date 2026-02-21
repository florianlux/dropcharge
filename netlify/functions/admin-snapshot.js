const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { getLatestSnapshot } = require('./_lib/snapshot-helper');

async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  try {
    const result = await getLatestSnapshot();
    
    if (!result.ok) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ ok: false, error: result.error })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        data: result.data
      })
    };
  } catch (err) {
    console.log('admin-snapshot error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
