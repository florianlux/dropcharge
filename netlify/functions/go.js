const crypto = require('crypto');
const fs = require('fs');
const pathmod = require('path');
const geoip = require('geoip-lite');
const { supabase, hasSupabase } = require('./_lib/supabase');

function ensureDataDir() {
  const dir = pathmod.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

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

function getClientIp(headers) {
  const raw = headers['x-forwarded-for'] || headers['client-ip'] || headers['true-client-ip'] || headers['x-real-ip'] || '';
  return raw.split(',')[0].trim() || null;
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

exports.handler = async function(event) {
  const slug = event.path.replace('/go/', '').replace(/^\//, '');
  const offer = offers[slug];
  if (!offer) {
    return { statusCode: 404, body: 'Unknown link' };
  }

  const params = event.queryStringParameters || {};
  const headers = event.headers || {};
  const ipRaw = getClientIp(headers);
  const geo = ipRaw ? geoip.lookup(ipRaw) : null;
  const country = geo?.country || null;
  const ipHash = ipRaw ? crypto.createHash('sha256').update(ipRaw).digest('hex') : null;
  const regionCode = geo?.region || null;
  const regionName = mapRegion(country, regionCode);

  if (hasSupabase && supabase) {
    const insertPayload = {
      slug,
      platform: offer.platform,
      amount: offer.amount,
      utm_source: params.utm_source || null,
      utm_campaign: params.utm_campaign || null,
      referrer: headers.referer || null,
      user_agent: headers['user-agent'] || null,
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
    const dir = ensureDataDir();
    const file = pathmod.join(dir, 'clicks.json');
    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      slug,
      platform: offer.platform,
      amount: offer.amount,
      utm_source: params.utm_source || null,
      utm_campaign: params.utm_campaign || null,
      referrer: headers.referer || null,
      user_agent: headers['user-agent'] || null,
      ip_hash: ipHash,
      country,
      region: regionName,
      created_at: new Date().toISOString()
    };
    const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    current.push(payload);
    fs.writeFileSync(file, JSON.stringify(current.slice(-2000), null, 2));
  }

  return {
    statusCode: 302,
    headers: { Location: offer.url },
    body: ''
  };
};
