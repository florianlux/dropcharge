/**
 * Validates and sanitizes the "from" field for the Resend API.
 * Resend requires either `email@example.com` or `Name <email@example.com>`.
 *
 * @param {string} raw – raw value (typically from an env var)
 * @returns {string|null} – sanitized string or null when the value is invalid
 */
function sanitizeFrom(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Strip control characters (newlines, tabs, etc.) and trim whitespace
  const cleaned = raw.replace(/[\x00-\x1F\x7F]+/g, ' ').trim();
  if (!cleaned) return null;

  // Shared email pattern: local@domain.tld (TLD at least 2 chars, no angle brackets)
  const emailRe = '[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]{2,}';

  // Pattern 1: plain email  –  user@example.com
  if (new RegExp(`^${emailRe}$`).test(cleaned)) {
    return cleaned;
  }

  // Pattern 2: Name <email>  –  DropCharge <noreply@dropcharge.de>
  const namedMatch = cleaned.match(new RegExp(`^(.*)<(${emailRe})>\\s*$`));
  if (namedMatch) {
    const name = namedMatch[1].trim();
    const email = namedMatch[2].trim();
    return name ? `${name} <${email}>` : email;
  }

  // Not a recognised format
  return null;
}

module.exports = { sanitizeFrom };
