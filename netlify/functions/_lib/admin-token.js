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

function getExpectedAdminToken() {
  return process.env.ADMIN_TOKEN
    || process.env.ADMIN_API_TOKEN
    || process.env.DASHBOARD_TOKEN
    || process.env.ADMIN_SECRET
    || '';
}

const authEnabled = Boolean(getExpectedAdminToken());

function isAdminAuthorized(headers) {
  if (!authEnabled) {
    return true;
  }
  const expected = getExpectedAdminToken().trim();
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
