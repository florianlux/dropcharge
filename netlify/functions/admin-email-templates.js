const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { TEMPLATES } = require('./_lib/email-templates');

console.log("ENV CHECK:", {
  hasResendKey: !!process.env.RESEND_API_KEY,
  hasFrom: !!process.env.RESEND_FROM,
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

exports.handler = withCors(async (event) => {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (event.httpMethod === 'GET') {
    // List available templates with sample data
    const list = Object.entries(TEMPLATES).map(([key, tpl]) => ({
      key,
      name: tpl.name,
      description: tpl.description,
      sampleData: tpl.sampleData
    }));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, templates: list })
    };
  }

  if (event.httpMethod === 'POST') {
    let payload = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
    }

    const templateKey = payload.template;
    if (!templateKey || !TEMPLATES[templateKey]) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'invalid_template', available: Object.keys(TEMPLATES) })
      };
    }

    const tpl = TEMPLATES[templateKey];
    const data = { ...tpl.sampleData, ...(payload.data || {}) };
    const rendered = tpl.render(data);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, subject: rendered.subject, html: rendered.html })
    };
  }

  return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
});
