const { supabase, hasSupabase } = require('./_lib/supabase');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
  }

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  const confirmed = process.env.ENABLE_DOUBLE_OPT_IN ? false : true;

  try {
    const { data: existing, error: selectErr } = await supabase
      .from('emails')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (selectErr) throw selectErr;

    if (existing) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, repeated: true }) };
    }

    const { error } = await supabase.from('emails').insert({
      email,
      confirmed,
      created_at: new Date().toISOString()
    });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.log('email insert/select error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
