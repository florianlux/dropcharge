const fs = require('fs');
const path = require('path');
const { getCookie, verifySession } = require('./_lib/auth');

const adminFile = path.join(__dirname, '..', '..', 'admin.html');
const loginFile = path.join(__dirname, '..', '..', 'admin-login.html');

function htmlResponse(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body
  };
}

exports.handler = async function(event) {
  const subPath = event.path.replace(/^\/admin/, '') || '/';

  if (subPath.startsWith('/login')) {
    const html = fs.readFileSync(loginFile, 'utf8');
    return htmlResponse(html);
  }

  const token = getCookie(event.headers, 'dc_admin_session');
  if (!verifySession(token)) {
    return {
      statusCode: 302,
      headers: { Location: '/admin/login' },
      body: ''
    };
  }

  const html = fs.readFileSync(adminFile, 'utf8');
  return htmlResponse(html);
};
