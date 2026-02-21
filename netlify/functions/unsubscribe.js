const { supabase, hasSupabase } = require('./_lib/supabase');

function htmlResponse(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body
  };
}

exports.handler = async function handler(event) {
  const email = event.queryStringParameters?.email;
  if (!email) {
    return htmlResponse('<h1>Fehler</h1><p>Email fehlt.</p>');
  }
  if (!hasSupabase || !supabase) {
    return htmlResponse('<h1>Fehler</h1><p>Service nicht verfügbar.</p>');
  }
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: now })
      .eq('email', email.toLowerCase().trim())
      .select('email');
    if (error) throw error;
    if (!data || !data.length) {
      return htmlResponse('<h1>Nicht gefunden</h1><p>Diese E-Mail ist nicht in unserer Liste.</p>');
    }
    return htmlResponse('<h1>Du bist abgemeldet ✅</h1><p>Du erhältst keine weiteren DropCharge E-Mails.</p>');
  } catch (err) {
    console.log('unsubscribe error', err.message);
    return htmlResponse('<h1>Fehler</h1><p>Bitte später erneut versuchen.</p>');
  }
};
