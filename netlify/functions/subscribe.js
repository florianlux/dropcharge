const fs = require('fs');
const pathmod = require('path');
const { supabase, hasSupabase } = require('./_lib/supabase');

function dataFile() {
  const dir = pathmod.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return pathmod.join(dir, 'emails.json');
}

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
    return { statusCode: 400, body: 'Ungültige E-Mail' };
  }

  const confirmed = process.env.ENABLE_DOUBLE_OPT_IN ? false : true;

  if (hasSupabase && supabase) {
    const { data: existing, error: selectErr } = await supabase
      .from('emails')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (selectErr) {
      console.log('email select error', selectErr.message);
      return { statusCode: 500, body: 'Server error' };
    }

    if (existing) {
      return { statusCode: 200, body: JSON.stringify({ success: true, repeated: true }) };
    }

    const { error } = await supabase.from('emails').insert({
      email,
      confirmed,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.log('email insert error', error.message);
      return { statusCode: 500, body: 'Server error' };
    }
  } else {
    const file = dataFile();
    const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    if (list.some(entry => entry.email === email)) {
      return { statusCode: 200, body: JSON.stringify({ success: true, repeated: true }) };
    }
    list.push({ email, confirmed, created_at: new Date().toISOString() });
    fs.writeFileSync(file, JSON.stringify(list.slice(-5000), null, 2));
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  };
};
