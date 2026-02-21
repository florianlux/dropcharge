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

const authEnabled = Boolean(process.env.ADMIN_TOKEN);

function isAdminAuthorized(headers) {
  if (!authEnabled) {
    return true;
  }
  const expected = process.env.ADMIN_TOKEN || '';
  const provided = (getHeader(headers, 'x-admin-token') || '').trim();
  return provided === expected;
}

function unauthorizedResponse() {
  return {
    statusCode: 401,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: false, error: 'unauthorized' })
  };
}

function requireAdmin(headers) {
  if (!isAdminAuthorized(headers)) {
    return unauthorizedResponse();
  }
  return null;
}

module.exports = {
  authEnabled,
  isAdminAuthorized,
  requireAdmin
};
