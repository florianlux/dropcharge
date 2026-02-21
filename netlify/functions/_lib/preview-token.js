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

const crypto = require('crypto');

/**
 * Generates a short-lived preview token for a specific deal slug
 * Format: base64(slug:timestamp:hmac)
 */
function generatePreviewToken(slug) {
  const secret = process.env.PREVIEW_SECRET;
  if (!secret) {
    throw new Error('PREVIEW_SECRET environment variable is not set');
  }
  
  const timestamp = Date.now();
  const expiryMs = 5 * 60 * 1000; // 5 minutes
  const expiresAt = timestamp + expiryMs;
  
  const payload = `${slug}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64');
  
  return token;
}

/**
 * Validates a preview token for a specific slug
 * Returns true if valid and not expired
 */
function validatePreviewToken(token, slug) {
  if (!token) return false;
  
  try {
    const secret = process.env.PREVIEW_SECRET;
    if (!secret) {
      console.error('PREVIEW_SECRET environment variable is not set');
      return false;
    }
    
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [tokenSlug, expiresAtStr, hmac] = decoded.split(':');
    
    if (tokenSlug !== slug) return false;
    
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;
    
    const payload = `${tokenSlug}:${expiresAtStr}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch (err) {
    console.error('Preview token validation error:', err.message);
    return false;
  }
}

/**
 * Checks if the request has a valid preview token
 */
function hasValidPreviewToken(headers, slug) {
  const token = getHeader(headers, 'x-preview-token');
  return validatePreviewToken(token, slug);
}

module.exports = {
  generatePreviewToken,
  validatePreviewToken,
  hasValidPreviewToken
};
