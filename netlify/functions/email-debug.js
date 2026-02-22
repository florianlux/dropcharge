const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

exports.handler = withCors(async (event) => {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  const from = process.env.RESEND_FROM || process.env.RESEND_FALLBACK_FROM || null;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      from,
      resendKeySet: !!process.env.RESEND_API_KEY,
      fallbackFromSet: !!process.env.RESEND_FALLBACK_FROM,
      samplePayload: {
        from,
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      }
    })
  };
});
