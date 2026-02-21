const { verifyAdminJWT } = require('./supabase-auth');

function getHeader(headers = {}, name) {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      return headers[key];
    }
  }
  return null;
}

const authEnabled = Boolean(process.env.ADMIN_TOKEN) || Boolean(process.env.SUPABASE_URL);

function isAdminAuthorized(headers) {
  // Legacy token auth (for backward compatibility)
  if (process.env.ADMIN_TOKEN) {
    const expected = process.env.ADMIN_TOKEN || '';
    const provided = (getHeader(headers, 'x-admin-token') || '').trim();
    if (provided === expected) {
      return true;
    }
  }
  
  // If no legacy token or didn't match, we'll check JWT in requireAdmin
  return false;
}

function unauthorizedResponse() {
  return {
    statusCode: 401,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ error: 'unauthorized' })
  };
}

async function requireAdmin(headers) {
  // First check legacy token auth for backward compatibility
  if (isAdminAuthorized(headers)) {
    return null;
  }
  
  // Try JWT auth
  const jwtResult = await verifyAdminJWT(headers);
  if (jwtResult.ok) {
    return null;
  }
  
  // Both methods failed
  return unauthorizedResponse();
}

module.exports = {
  authEnabled,
  isAdminAuthorized,
  requireAdmin
};
