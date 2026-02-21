// DEPRECATED: This file uses the old emails table.
// Use newsletter-signup.js (with dash) instead which properly saves to newsletter_subscribers table.
// This file is kept for backward compatibility but should not be used.

const { withCors } = require('./_lib/cors');

async function handler(event) {
  return {
    statusCode: 410,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: false,
      error: 'This endpoint is deprecated. Use /newsletter-signup instead.'
    })
  };
}

exports.handler = withCors(handler);
