const { supabase, hasSupabase } = require('./_lib/supabase');

function htmlResponse(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body
  };
}

exports.handler = async function handler(event) {
  const token = event.queryStringParameters?.token;
  if (!token) {
    return htmlResponse('<h1>Fehler</h1><p>Token fehlt.</p>');
  }
  if (!hasSupabase || !supabase) {
    return htmlResponse('<h1>Fehler</h1><p>Service nicht verfügbar.</p>');
  }
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: now })
      .eq('unsubscribe_token', token)
      .select('email');
    if (error) throw error;
    if (!data || !data.length) {
      return htmlResponse('<h1>Nicht gefunden</h1><p>Dieser Link ist ungültig oder wurde bereits verwendet.</p>');
    }
    return htmlResponse('<h1>Du bist abgemeldet ✅</h1><p>Du erhältst keine weiteren DropCharge E-Mails.</p>');
  } catch (err) {
    console.error('unsubscribe error', err.message, err.stack);
    return htmlResponse('<h1>Fehler</h1><p>Bitte später erneut versuchen.</p>');
  }
};
