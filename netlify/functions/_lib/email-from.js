/**
 * Validates and sanitises the "from" field for the Resend API.
 * Resend requires either `email@example.com` or `Name <email@example.com>`.
 *
 * @param {string} raw – raw value (typically from an env var)
 * @returns {string|null} – sanitised string or null when the value is invalid
 */
function sanitizeFrom(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Strip control characters (newlines, tabs, etc.) and trim whitespace
  const cleaned = raw.replace(/[\x00-\x1F\x7F]+/g, ' ').trim();
  if (!cleaned) return null;

  // Pattern 1: plain email  –  user@example.com
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(cleaned)) {
    return cleaned;
  }

  // Pattern 2: Name <email>  –  DropCharge <noreply@dropcharge.de>
  const namedMatch = cleaned.match(/^(.*)<([^\s@]+@[^\s@]+\.[^\s@]+)>\s*$/);
  if (namedMatch) {
    const name = namedMatch[1].trim();
    const email = namedMatch[2].trim();
    return name ? `${name} <${email}>` : email;
  }

  // Not a recognised format
  return null;
}

module.exports = { sanitizeFrom };
