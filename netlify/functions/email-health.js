const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

async function checkLogTable() {
  if (!hasSupabase || !supabase) return false;
  try {
    const { error } = await supabase
      .from('email_logs')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

exports.handler = withCors(async () => {
  const logTableExists = await checkLogTable();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      env: {
        resendKey: !!process.env.RESEND_API_KEY,
        resendFrom: !!process.env.RESEND_FROM,
        supabaseUrl: !!process.env.SUPABASE_URL,
        serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      db: {
        logTableExists
      }
    })
  };
});
