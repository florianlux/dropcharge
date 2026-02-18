const { verifyPassword, isRateLimited, recordFailedAttempt, clearAttempts, createSession, buildSessionCookie, logAudit } = require('./_lib/auth');

function getIp(headers) {
  const raw = headers['x-forwarded-for'] || headers['client-ip'] || headers['true-client-ip'] || headers['x-real-ip'] || '';
  return raw.split(',')[0].trim() || 'unknown';
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  const password = payload.password || '';
  const ip = getIp(event.headers || {});

  if (isRateLimited(ip)) {
    return { statusCode: 429, body: 'Login fehlgeschlagen' };
  }

  try {
    const ok = await verifyPassword(password);
    if (!ok) {
      recordFailedAttempt(ip);
      return { statusCode: 401, body: 'Login fehlgeschlagen' };
    }
  } catch (err) {
    console.log('login error', err.message);
    return { statusCode: 500, body: 'Login fehlgeschlagen' };
  }

  clearAttempts(ip);
  const token = createSession(ip);
  logAudit('login_success', { ip });

  return {
    statusCode: 200,
    headers: {
      'Set-Cookie': buildSessionCookie(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ success: true })
  };
};
