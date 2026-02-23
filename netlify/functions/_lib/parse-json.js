/**
 * parse-json.js – Defensive JSON body parser for Netlify functions.
 *
 * Usage:
 *   const { parseBody } = require('./_lib/parse-json');
 *   const { data, error } = parseBody(event);
 */

const MAX_BODY_BYTES = 10_240; // 10 KB default

function parseBody(event, maxBytes) {
  const limit = maxBytes || MAX_BODY_BYTES;
  const raw = event && event.body ? event.body : '';

  if (raw.length > limit) {
    return { data: null, error: 'payload_too_large' };
  }

  if (!raw || raw.trim() === '') {
    return { data: {}, error: null };
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { data: null, error: 'expected_json_object' };
    }
    return { data: parsed, error: null };
  } catch (e) {
    return { data: null, error: 'invalid_json' };
  }
}

module.exports = { parseBody };
