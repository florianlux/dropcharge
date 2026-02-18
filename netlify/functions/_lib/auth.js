const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', '..', 'data');
const sessionsFile = path.join(dataDir, 'sessions.json');
const attemptsFile = path.join(dataDir, 'login-attempts.json');
const auditFile = path.join(dataDir, 'audit-log.json');

function ensureDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function verifyPassword(plain) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) throw new Error('ADMIN_PASSWORD_HASH not configured');
  return bcrypt.compare(plain, hash);
}

function summarizeAttempts(attempts) {
  const windowMs = 10 * 60 * 1000;
  const cutoff = Date.now() - windowMs;
  Object.keys(attempts).forEach(ip => {
    attempts[ip] = attempts[ip].filter(ts => ts > cutoff);
    if (attempts[ip].length === 0) delete attempts[ip];
  });
}

function isRateLimited(ip) {
  const attempts = readJSON(attemptsFile, {});
  summarizeAttempts(attempts);
  const list = attempts[ip] || [];
  writeJSON(attemptsFile, attempts);
  return list.length >= 5;
}

function recordFailedAttempt(ip) {
  const attempts = readJSON(attemptsFile, {});
  summarizeAttempts(attempts);
  attempts[ip] = attempts[ip] || [];
  attempts[ip].push(Date.now());
  writeJSON(attemptsFile, attempts);
  logAudit('failed_login', { ip });
}

function clearAttempts(ip) {
  const attempts = readJSON(attemptsFile, {});
  if (attempts[ip]) {
    delete attempts[ip];
    writeJSON(attemptsFile, attempts);
  }
}

function logAudit(event, payload = {}) {
  const current = readJSON(auditFile, []);
  current.push({
    event,
    payload,
    timestamp: new Date().toISOString()
  });
  writeJSON(auditFile, current.slice(-500));
}

function createSession(ip) {
  ensureDir();
  const sessions = readJSON(sessionsFile, []);
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000;
  sessions.push({ token, ip, createdAt: now, expiresAt });
  writeJSON(sessionsFile, sessions.filter(s => s.expiresAt > now - 5 * 60 * 1000));
  return token;
}

function verifySession(token) {
  if (!token) return false;
  const sessions = readJSON(sessionsFile, []);
  const now = Date.now();
  const match = sessions.find(s => s.token === token && s.expiresAt > now);
  if (!match) return false;
  return true;
}

function destroySession(token) {
  const sessions = readJSON(sessionsFile, []);
  const filtered = sessions.filter(s => s.token !== token);
  writeJSON(sessionsFile, filtered);
}

function getCookie(headers, name) {
  const header = headers.cookie || headers.Cookie || '';
  const cookies = header.split(';').map(chunk => chunk.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return null;
}

function buildSessionCookie(value) {
  const secure = process.env.CONTEXT && process.env.CONTEXT !== 'dev';
  const parts = [
    `dc_admin_session=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=86400'
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie() {
  return 'dc_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

module.exports = {
  verifyPassword,
  isRateLimited,
  recordFailedAttempt,
  clearAttempts,
  createSession,
  verifySession,
  destroySession,
  logAudit,
  getCookie,
  buildSessionCookie,
  clearSessionCookie
};
