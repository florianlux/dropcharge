const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { sanitizeFrom } = require('./_lib/email-from');

exports.handler = withCors(async (event) => {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  const rawFrom = process.env.RESEND_FROM || process.env.RESEND_FALLBACK_FROM || null;
  const sanitizedFrom = sanitizeFrom(rawFrom);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      from: sanitizedFrom,
      fromRaw: rawFrom,
      fromValid: sanitizedFrom !== null,
      resendKeySet: !!process.env.RESEND_API_KEY,
      fallbackFromSet: !!process.env.RESEND_FALLBACK_FROM,
      samplePayload: {
        from: sanitizedFrom,
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      }
    })
  };
});
