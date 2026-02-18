const { getCookie, destroySession, clearSessionCookie } = require('./_lib/auth');

exports.handler = async function(event) {
  const token = getCookie(event.headers || {}, 'dc_admin_session');
  if (token) {
    destroySession(token);
  }
  return {
    statusCode: 302,
    headers: {
      'Set-Cookie': clearSessionCookie(),
      Location: '/admin/login'
    },
    body: ''
  };
};
