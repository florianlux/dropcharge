const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

/* ── Constants ──────────────────────────────────────── */
const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 600 * 1024;
const MAX_REDIRECTS = 5;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/* ── SSRF guard ─────────────────────────────────────── */
const PRIVATE_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^::1$/, /^fc00:/i, /^fe80:/i, /^fd/i, /^localhost$/i,
];

function isPrivateHost(hostname) {
  return PRIVATE_RANGES.some(re => re.test(hostname));
}

/* ── HTTP(S) fetcher with redirect following ────────── */
function fetchUrl(urlStr, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch { return reject(new Error('invalid_url')); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return reject(new Error('invalid_protocol'));
    }
    if (isPrivateHost(parsed.hostname)) {
      return reject(new Error('blocked_private_ip'));
    }

    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(urlStr, {
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DropCharge-ProductFetch/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5,de;q=0.3',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error('too_many_redirects'));
        const next = new URL(res.headers.location, urlStr).href;
        res.resume();
        return resolve(fetchUrl(next, redirectsLeft - 1));
      }
      if (res.statusCode < 200 || res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`http_${res.statusCode}`));
      }
      const chunks = [];
      let totalLen = 0;
      res.on('data', chunk => {
        totalLen += chunk.length;
        if (totalLen > MAX_HTML_BYTES) { res.destroy(); return reject(new Error('response_too_large')); }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf-8'), finalUrl: urlStr }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

/* ── Resolve shortlinks (only follow redirects, don't download body) ── */
function resolveRedirects(urlStr, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlStr); } catch { return reject(new Error('invalid_url')); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return reject(new Error('invalid_protocol'));
    }
    if (isPrivateHost(parsed.hostname)) {
      return reject(new Error('blocked_private_ip'));
    }

    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(urlStr, {
      method: 'HEAD',
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DropCharge-ProductFetch/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error('too_many_redirects'));
        const next = new URL(res.headers.location, urlStr).href;
        res.resume();
        return resolve(resolveRedirects(next, redirectsLeft - 1));
      }
      res.resume();
      resolve(urlStr);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', () => {
      // HEAD may fail, fall back to GET-based resolve
      fetchUrl(urlStr, redirectsLeft).then(r => resolve(r.finalUrl)).catch(reject);
    });
    req.end();
  });
}

/* ── Detect source from URL ─────────────────────────── */
function detectSource(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('amazon') || host.includes('amzn')) return 'amazon';
    if (host.includes('temu')) return 'temu';
    if (host.includes('g2a')) return 'g2a';
    return 'generic';
  } catch { return 'generic'; }
}

/* ── Extract ASIN from Amazon URL ───────────────────── */
function extractASIN(url) {
  const m = url.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})/i)
    || url.match(/(?:^|&|\?)asin=([A-Z0-9]{10})/i)
    || url.match(/\/([A-Z0-9]{10})(?:[/?&#]|$)/);
  return m ? m[1].toUpperCase() : null;
}

/* ── Amazon PA API ──────────────────────────────────── */
function hasPAAPI() {
  return Boolean(
    process.env.AMAZON_PAAPI_ACCESS_KEY &&
    process.env.AMAZON_PAAPI_SECRET_KEY &&
    process.env.AMAZON_PAAPI_PARTNER_TAG
  );
}

function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = sign(Buffer.from('AWS4' + key, 'utf-8'), dateStamp);
  const kRegion = sign(kDate, regionName);
  const kService = sign(kRegion, serviceName);
  return sign(kService, 'aws4_request');
}

async function fetchFromPAAPI(asin) {
  const accessKey = process.env.AMAZON_PAAPI_ACCESS_KEY;
  const secretKey = process.env.AMAZON_PAAPI_SECRET_KEY;
  const partnerTag = process.env.AMAZON_PAAPI_PARTNER_TAG;
  const host = process.env.AMAZON_PAAPI_HOST || 'webservices.amazon.de';
  const region = process.env.AMAZON_PAAPI_REGION || 'eu-west-1';
  const amzTarget = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems';

  const payload = JSON.stringify({
    ItemIds: [asin],
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.Features',
      'Images.Primary.Large',
      'Offers.Listings.Price'
    ]
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z/, 'Z');
  const dateStamp = amzDate.slice(0, 8);
  const service = 'ProductAdvertisingAPI';
  const endpoint = '/paapi5/getitems';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalHeaders = `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${amzTarget}\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = `POST\n${endpoint}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
  const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: endpoint,
      method: 'POST',
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type': 'application/json; charset=utf-8',
        'host': host,
        'x-amz-date': amzDate,
        'x-amz-target': amzTarget,
        'Authorization': authHeader
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          if (body.Errors || !body.ItemsResult || !body.ItemsResult.Items || !body.ItemsResult.Items.length) {
            return reject(new Error('paapi_no_results'));
          }
          const item = body.ItemsResult.Items[0];
          const result = {
            product_title: item.ItemInfo?.Title?.DisplayValue || null,
            product_description: (item.ItemInfo?.Features?.DisplayValues || []).join(' ').slice(0, 300) || null,
            product_image_url: item.Images?.Primary?.Large?.URL || null,
            product_price: null,
            product_currency: null,
            brand: 'Amazon'
          };
          const listing = item.Offers?.Listings?.[0];
          if (listing?.Price?.Amount) {
            result.product_price = listing.Price.Amount;
            result.product_currency = listing.Price.Currency || 'EUR';
          }
          resolve(result);
        } catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/* ── HTML meta-tag parser ────────────────────────── */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getContent(html, attr, val) {
  const a = escapeRegex(attr);
  const v = escapeRegex(val);
  const re = new RegExp(`<meta[^>]+(?:${a})\\s*=\\s*["']${v}["'][^>]+content\\s*=\\s*["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]+(?:${a})\\s*=\\s*["']${v}["']`, 'i');
  const m = html.match(re) || html.match(re2);
  return m ? m[1].trim() : null;
}

function parseJsonLd(html) {
  const results = [];
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (Array.isArray(obj)) results.push(...obj);
      else results.push(obj);
    } catch { /* skip invalid JSON-LD */ }
  }
  // Find Product schema
  for (const item of results) {
    if (item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product'))) {
      return item;
    }
    if (item['@graph'] && Array.isArray(item['@graph'])) {
      for (const g of item['@graph']) {
        if (g['@type'] === 'Product') return g;
      }
    }
  }
  return null;
}

function parseMetadata(html) {
  const meta = {};
  meta.ogTitle = getContent(html, 'property', 'og:title');
  meta.ogDescription = getContent(html, 'property', 'og:description');
  meta.ogSiteName = getContent(html, 'property', 'og:site_name');
  meta.ogImage = getContent(html, 'property', 'og:image');
  meta.metaDesc = getContent(html, 'name', 'description');
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  meta.titleTag = titleMatch ? titleMatch[1].trim() : null;
  return meta;
}

/* ── Extract product data from JSON-LD ──────────────── */
function extractFromJsonLd(jsonLd) {
  if (!jsonLd) return null;
  const result = {};
  result.product_title = jsonLd.name || null;
  result.product_description = (jsonLd.description || '').slice(0, 300) || null;

  // Image
  if (jsonLd.image) {
    if (typeof jsonLd.image === 'string') result.product_image_url = jsonLd.image;
    else if (Array.isArray(jsonLd.image) && jsonLd.image.length) {
      result.product_image_url = typeof jsonLd.image[0] === 'string' ? jsonLd.image[0] : jsonLd.image[0]?.url || null;
    } else if (jsonLd.image.url) result.product_image_url = jsonLd.image.url;
  }

  // Price from offers
  const offers = jsonLd.offers;
  if (offers) {
    const offerObj = Array.isArray(offers) ? offers[0] : offers;
    if (offerObj?.price || offerObj?.lowPrice) {
      const p = parseFloat(offerObj.price || offerObj.lowPrice);
      if (!isNaN(p)) {
        result.product_price = p;
        result.product_currency = offerObj.priceCurrency || 'EUR';
      }
    }
  }

  // Confidence
  const hasName = Boolean(result.product_title);
  const hasImage = Boolean(result.product_image_url);
  const hasPrice = result.product_price != null;
  if (hasName && hasImage && hasPrice) result.confidence = 'high';
  else if (hasName && hasImage) result.confidence = 'medium';
  else result.confidence = 'low';

  return result;
}

/* ── Extract from OG / meta tags ────────────────────── */
function extractFromMeta(meta) {
  const result = {};
  result.product_title = meta.ogTitle || meta.titleTag || null;
  result.product_description = (meta.ogDescription || meta.metaDesc || '').slice(0, 300) || null;
  result.product_image_url = meta.ogImage || null;
  result.product_price = null;
  result.product_currency = null;

  const hasName = Boolean(result.product_title);
  const hasImage = Boolean(result.product_image_url);
  if (hasName && hasImage) result.confidence = 'medium';
  else if (hasName) result.confidence = 'low';
  else result.confidence = 'low';

  return result;
}

/* ── Cache helpers ──────────────────────────────────── */
async function getCached(url) {
  if (!hasSupabase || !supabase) return null;
  try {
    const { data } = await supabase
      .from('product_cache')
      .select('json, fetched_at')
      .eq('url', url)
      .maybeSingle();
    if (!data) return null;
    const age = Date.now() - new Date(data.fetched_at).getTime();
    if (age > CACHE_TTL_MS) return null;
    return data.json;
  } catch { return null; }
}

async function setCache(url, json) {
  if (!hasSupabase || !supabase) return;
  try {
    await supabase.from('product_cache').upsert({
      url,
      json,
      fetched_at: new Date().toISOString()
    }, { onConflict: 'url' });
  } catch (e) { console.error('product_cache write error:', e.message); }
}

/* ── Main handler ────────────────────────────────────── */
async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  let url, force;
  try {
    const body = JSON.parse(event.body || '{}');
    url = (body.url || '').trim();
    force = Boolean(body.force);
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_json' })
    };
  }

  if (!url) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'url_required' })
    };
  }

  // Validate protocol
  let parsed;
  try { parsed = new URL(url); } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'invalid_url' }) };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'invalid_protocol' }) };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'blocked_private_ip' }) };
  }

  const steps = [];

  // Check cache
  if (!force) {
    const cached = await getCached(url);
    if (cached) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, data: cached, debug: { steps: ['cache_hit'], cache: 'hit' } })
      };
    }
  }
  steps.push('cache_miss');

  // Step 1: Resolve shortlinks/redirects to canonical URL
  let canonicalUrl = url;
  try {
    canonicalUrl = await resolveRedirects(url);
    if (canonicalUrl !== url) steps.push('redirect_resolved');
  } catch (e) {
    steps.push('redirect_resolve_failed:' + e.message);
    // Try with GET-based fetch as fallback
    try {
      const result = await fetchUrl(url);
      canonicalUrl = result.finalUrl;
      steps.push('fallback_redirect_resolved');
    } catch {
      // Keep original URL
    }
  }

  const source = detectSource(canonicalUrl);
  steps.push('source:' + source);

  let data = {
    source,
    canonical_url: canonicalUrl,
    product_title: null,
    product_description: null,
    product_price: null,
    product_currency: null,
    product_image_url: null,
    brand: null,
    confidence: 'low'
  };

  // Step 2: Source-specific fetching
  if (source === 'amazon') {
    data.brand = 'Amazon';

    // Try PA API first
    if (hasPAAPI()) {
      const asin = extractASIN(canonicalUrl);
      if (asin) {
        steps.push('asin:' + asin);
        try {
          const paResult = await fetchFromPAAPI(asin);
          data.product_title = paResult.product_title;
          data.product_description = paResult.product_description;
          data.product_image_url = paResult.product_image_url;
          data.product_price = paResult.product_price;
          data.product_currency = paResult.product_currency;
          data.confidence = 'high';
          steps.push('paapi_success');
        } catch (e) {
          steps.push('paapi_failed:' + e.message);
        }
      } else {
        steps.push('asin_not_found');
      }
    } else {
      steps.push('paapi_not_configured');
    }

    // Fallback: metadata from HTML
    if (!data.product_title) {
      try {
        const { html } = await fetchUrl(canonicalUrl);
        const meta = parseMetadata(html);
        const jsonLd = parseJsonLd(html);
        const jResult = extractFromJsonLd(jsonLd);
        const mResult = extractFromMeta(meta);
        const best = jResult && jResult.product_title ? jResult : mResult;
        data.product_title = best.product_title;
        data.product_description = best.product_description;
        data.product_image_url = best.product_image_url;
        if (best.product_price != null) {
          data.product_price = best.product_price;
          data.product_currency = best.product_currency;
        }
        data.confidence = best.confidence || 'low';
        steps.push('metadata_fallback');
      } catch (e) {
        steps.push('metadata_failed:' + e.message);
      }
    }
  } else {
    // Temu, G2A, Generic
    if (source === 'temu') data.brand = 'Temu';
    else if (source === 'g2a') data.brand = 'G2A';

    try {
      const { html } = await fetchUrl(canonicalUrl);
      const jsonLd = parseJsonLd(html);
      const meta = parseMetadata(html);
      const jResult = extractFromJsonLd(jsonLd);
      const mResult = extractFromMeta(meta);

      // Prefer JSON-LD
      if (jResult && jResult.product_title) {
        data.product_title = jResult.product_title;
        data.product_description = jResult.product_description;
        data.product_image_url = jResult.product_image_url;
        if (jResult.product_price != null) {
          data.product_price = jResult.product_price;
          data.product_currency = jResult.product_currency;
        }
        data.confidence = jResult.confidence || 'medium';
        steps.push('jsonld_parsed');
      } else {
        data.product_title = mResult.product_title;
        data.product_description = mResult.product_description;
        data.product_image_url = mResult.product_image_url;
        data.confidence = mResult.confidence || 'low';
        steps.push('og_meta_parsed');
      }

      // For sources without brand from meta, use detected brand
      if (!data.brand && meta.ogSiteName) {
        data.brand = meta.ogSiteName;
      }
    } catch (e) {
      steps.push('fetch_failed:' + e.message);
    }
  }

  // Cache the result
  await setCache(url, data);
  steps.push('cached');

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, data, debug: { steps, cache: 'miss' } })
  };
}

exports.handler = withCors(handler);
