const crypto = require('crypto');
const geoip = require('geoip-lite');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { fetchSettings, extractFlags } = require('./_lib/settings');
const { withCors } = require('./_lib/cors');
const { normalizeG2AReflink } = require('./_lib/affiliates');

const germanStates = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen'
};

function mapRegion(country, code) {
  if (!code) return null;
  if (country === 'DE') {
    return germanStates[code] || code;
  }
  return code;
}

function getClientIp(headers = {}) {
  const raw = headers['x-forwarded-for'] || headers['client-ip'] || headers['true-client-ip'] || headers['x-real-ip'] || '';
  return raw.split(',')[0].trim() || null;
}

function hashUserAgent(ua) {
  if (!ua) return null;
  return crypto.createHash('sha256').update(ua).digest('hex');
}

function detectDevice(ua) {
  if (!ua) return 'unknown';
  const lowered = ua.toLowerCase();
  if (lowered.includes('mobile') || lowered.includes('iphone') || lowered.includes('android')) {
    return 'mobile';
  }
  if (lowered.includes('tablet') || lowered.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}

const offers = {
  'psn-10': { url: 'https://www.g2a.com/n/psn5_lux', platform: 'PSN', amount: '10€' },
  'psn-20': { url: 'https://www.g2a.com/n/psn5_lux', platform: 'PSN', amount: '20€' },
  'psn-50': { url: 'https://www.g2a.com/n/psn5_lux', platform: 'PSN', amount: '50€' },
  'xbox-1m': { url: 'https://www.g2a.com/n/xbox_lux1', platform: 'Xbox', amount: '1 Monat' },
  'xbox-3m': { url: 'https://www.g2a.com/n/xbox_lux1', platform: 'Xbox', amount: '3 Monate' },
  'xbox-6m': { url: 'https://www.g2a.com/n/xbox_lux1', platform: 'Xbox', amount: '6 Monate' },
  'nintendo-15': { url: 'https://www.g2a.com/n/nintendo15_lux', platform: 'Nintendo', amount: '15€' },
  'nintendo-25': { url: 'https://www.g2a.com/n/nintendo15_lux', platform: 'Nintendo', amount: '25€' },
  'nintendo-50': { url: 'https://www.g2a.com/n/nintendo15_lux', platform: 'Nintendo', amount: '50€' }
};

async function getFlags() {
  try {
    const map = await fetchSettings(['flags', 'banner_message']);
    return extractFlags(map);
  } catch (err) {
    console.log('settings fetch failed', err.message);
    return extractFlags();
  }
}

async function loadDynamicOffer(slug) {
  if (!hasSupabase || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('spotlights')
      .select('slug, platform, price, title, vendor, affiliate_url, code_url, amazon_url, g2g_url, active')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data || data.active === false) return null;
    const redirectUrl = data.affiliate_url || data.code_url || data.amazon_url || data.g2g_url;
    if (!redirectUrl) return null;
    return {
      url: redirectUrl,
      platform: data.platform || data.vendor || 'Deal',
      amount: data.price || data.title || data.slug
    };
  } catch (err) {
    console.log('dynamic go lookup failed', err.message);
    return null;
  }
}

async function handler(event) {
  const slug = event.path.replace('/go/', '').replace(/^\//, '');
  let offer = await loadDynamicOffer(slug);
  if (!offer) {
    offer = offers[slug];
  }
  if (!offer) {
    return { statusCode: 404, body: 'Unknown link' };
  }

  const flags = await getFlags();
  if (flags.disable_affiliate_redirect) {
    const message = flags.banner_message || 'Drops kommen bald wieder. Stay tuned!';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: `<!doctype html><html><head><meta charset="utf-8"/><title>DropCharge</title><style>body{font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;padding:4rem;background:#050505;color:#f5f5f5;text-align:center;}a{display:inline-flex;margin-top:1rem;padding:0.75rem 1.5rem;border-radius:999px;border:1px solid rgba(255,255,255,.2);color:#fff;text-decoration:none;}p{max-width:520px;margin:1rem auto;font-size:1.1rem;line-height:1.4;}</style></head><body><h1>Coming Soon</h1><p>${message}</p><a href="/">Zurück zur Übersicht</a></body></html>`
    };
  }

  const params = event.queryStringParameters || {};
  const headers = event.headers || {};
  const userAgent = headers['user-agent'] || '';
  const ipRaw = getClientIp(headers);
  const geo = ipRaw ? geoip.lookup(ipRaw) : null;
  const country = geo?.country || null;
  const ipHash = ipRaw ? crypto.createHash('sha256').update(ipRaw).digest('hex') : null;
  const regionCode = geo?.region || null;
  const regionName = mapRegion(country, regionCode);
  const deviceHint = detectDevice(userAgent);
  const uaHash = hashUserAgent(userAgent);

  if (hasSupabase && supabase) {
    const insertPayload = {
      slug,
      platform: offer.platform,
      amount: offer.amount,
      utm_source: params.utm_source || null,
      utm_campaign: params.utm_campaign || null,
      utm_medium: params.utm_medium || null,
      referrer: headers.referer || null,
      user_agent: userAgent || null,
      user_agent_hash: uaHash,
      device_hint: deviceHint,
      ip_hash: ipHash,
      country,
      region: regionName,
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from('clicks').insert(insertPayload);
    if (error) {
      console.log('Supabase click insert error', error.message);
    }
  } else {
    console.log('Supabase not configured – skipping click log');
  }

  let redirectUrl = offer.url;
  // Apply G2A reflink tag if configured
  if (process.env.G2A_GTAG) {
    redirectUrl = normalizeG2AReflink(redirectUrl, process.env.G2A_GTAG);
  }

  return {
    statusCode: 302,
    headers: { Location: redirectUrl },
    body: ''
  };
};

exports.handler = withCors(handler);
