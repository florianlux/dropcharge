const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

function parseIso(dateString) {
  return new Date(dateString).getTime();
}

function basePlatformCounts() {
  return { PSN: 0, Xbox: 0, Nintendo: 0, Other: 0 };
}

async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Supabase not configured' }) };
  }

  const now = Date.now();
  const since30m = new Date(now - 30 * 60 * 1000).toISOString();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: clickRows = [], error: clickErr } = await supabase
      .from('clicks')
      .select('id, slug, platform, amount, created_at')
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(500);
    if (clickErr) throw clickErr;

    let emailRows = [];
    let emailErr;
    ({ data: emailRows = [], error: emailErr } = await supabase
      .from('emails')
      .select('id, email, confirmed, created_at, source')
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(200));
    if (emailErr && (emailErr.message || '').toLowerCase().includes('confirmed')) {
      ({ data: emailRows = [], error: emailErr } = await supabase
        .from('emails')
        .select('id, email, created_at, source')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(200));
    }
    if (emailErr) throw emailErr;
    emailRows = (emailRows || []).map(row => ({
      ...row,
      confirmed: Boolean(row.confirmed)
    }));

    const clicks24h = clickRows.filter(row => row.created_at >= since24h);
    const clicks30m = clickRows.filter(row => row.created_at >= since30m);

    const platformCounts = basePlatformCounts();
    clicks24h.forEach(row => {
      const key = row.platform && platformCounts[row.platform] !== undefined ? row.platform : 'Other';
      platformCounts[key] += 1;
    });

    const amountMap = new Map();
    clickRows.forEach(row => {
      const key = `${row.platform || '—'}|${row.amount || '—'}|${row.slug || ''}`;
      const existing = amountMap.get(key) || {
        platform: row.platform || '—',
        amount: row.amount || '—',
        slug: row.slug || '—',
        count: 0
      };
      existing.count += 1;
      amountMap.set(key, existing);
    });
    const topAmounts = Array.from(amountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const emails24h = emailRows.length;
    const clicksCount24h = clicks24h.length;
    const conversion = clicksCount24h ? (emails24h / clicksCount24h) * 100 : 0;

    const feed = clickRows.slice(0, 20).map(entry => ({
      id: entry.id,
      slug: entry.slug,
      platform: entry.platform,
      amount: entry.amount,
      created_at: entry.created_at,
      timestamp: new Date(entry.created_at).toISOString()
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        metrics: {
          generatedAt: new Date().toISOString(),
          clicks24h: clicksCount24h,
          clicks30m: clicks30m.length,
          platformCounts,
          topAmounts,
          emails24h,
          conversion24h: Number(conversion.toFixed(1)),
          feed,
          emailRows
        }
      })
    };
  } catch (err) {
    console.log('stats error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

exports.handler = withCors(handler);
