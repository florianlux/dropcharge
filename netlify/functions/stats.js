const fs = require('fs');
const path = require('path');
const { getCookie, verifySession } = require('./_lib/auth');
const { supabase, hasSupabase } = require('./_lib/supabase');

function readLocal(name) {
  const dir = path.join(__dirname, '..', '..', 'data');
  const file = path.join(dir, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

exports.handler = async function(event) {
  const token = getCookie(event.headers || {}, 'dc_admin_session');
  if (!verifySession(token)) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  if (hasSupabase && supabase) {
    try {
      const { data: recentClicks = [], error: clickErr } = await supabase
        .from('clicks')
        .select('id,slug,platform,amount,utm_source,utm_campaign,referrer,user_agent,country,ip_hash,created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (clickErr) throw clickErr;

      const { count: totalClicks = 0, error: countErr } = await supabase
        .from('clicks')
        .select('id', { count: 'exact', head: true });
      if (countErr) throw countErr;

      const { data: emailRows = [], error: emailErr } = await supabase
        .from('emails')
        .select('id,email,confirmed,created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (emailErr) throw emailErr;

      const { count: totalEmails = 0, error: emailCountErr } = await supabase
        .from('emails')
        .select('id', { count: 'exact', head: true });
      if (emailCountErr) throw emailCountErr;

      const totals = {
        platform: { PSN: 0, Xbox: 0, Nintendo: 0 },
        amount: {}
      };
      recentClicks.forEach(entry => {
        if (entry.platform && totals.platform[entry.platform] !== undefined) {
          totals.platform[entry.platform] += 1;
        }
        if (entry.amount) {
          totals.amount[entry.amount] = (totals.amount[entry.amount] || 0) + 1;
        }
      });

      const conversion = totalClicks ? totalEmails / totalClicks : 0;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: recentClicks, totals, emailCount: totalEmails, conversion, emails: emailRows })
      };
    } catch (err) {
      console.log('stats error', err.message);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // Local fallback (no Supabase configured)
  try {
    const entries = readLocal('clicks');
    const emails = readLocal('emails');
    const totals = {
      platform: { PSN: 0, Xbox: 0, Nintendo: 0 },
      amount: {}
    };
    entries.forEach(entry => {
      if (entry.platform && totals.platform[entry.platform] !== undefined) {
        totals.platform[entry.platform] += 1;
      }
      if (entry.amount) {
        totals.amount[entry.amount] = (totals.amount[entry.amount] || 0) + 1;
      }
    });
    const emailCount = emails.length;
    const conversion = entries.length ? emailCount / entries.length : 0;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: entries.slice(-200).reverse(),
        totals,
        emailCount,
        conversion,
        emails: emails.slice(-50).reverse()
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
