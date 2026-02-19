const { requireAdmin } = require('./_lib/admin-token');
const { supabase, hasSupabase } = require('./_lib/supabase');

const platforms = ['PSN', 'Xbox', 'Nintendo'];
const amounts = ['10€', '20€', '50€', '1 Monat', '3 Monate'];
const slugs = ['psn-10', 'psn-20', 'xbox-1m', 'nintendo-15'];
const emails = ['seed1@example.com', 'seed2@example.com', 'seed3@example.com'];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

exports.handler = async function(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  try {
    const clicksPayload = Array.from({ length: 10 }).map(() => ({
      slug: randomItem(slugs),
      platform: randomItem(platforms),
      amount: randomItem(amounts),
      created_at: new Date().toISOString()
    }));

    const { error: clicksError } = await supabase.from('clicks').insert(clicksPayload);
    if (clicksError) throw clicksError;

    const emailsPayload = emails.map(email => ({
      email: `${Date.now()}-${email}`,
      confirmed: true,
      created_at: new Date().toISOString()
    }));

    const { error: emailsError } = await supabase.from('emails').insert(emailsPayload);
    if (emailsError) throw emailsError;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.log('seed error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
