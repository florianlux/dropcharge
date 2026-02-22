const DEFAULT_ORIGINS = (process.env.ADMIN_ALLOWED_ORIGINS || 'https://dropcharge.io,http://localhost:8888,http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function pickOrigin(event) {
  const requestOrigin = event?.headers?.origin;
  if (requestOrigin && DEFAULT_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  return DEFAULT_ORIGINS[0] || requestOrigin || '*';
}

function corsHeaders(origin, extra = {}) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'content-type,x-admin-token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    ...extra
  };
}

function withCors(handler) {
  return async function corsWrapper(event, context) {
    const origin = pickOrigin(event);
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: corsHeaders(origin), body: '' };
    }
    const response = await handler(event, context);
    const nextHeaders = corsHeaders(origin, response?.headers || {});
    return { ...response, headers: nextHeaders };
  };
}

module.exports = { withCors };
