const { withCors } = require('./_lib/cors');
const { requireAdmin } = require('./_lib/admin-token');
const https = require('https');
const http = require('http');
const { URL } = require('url');

/* ── Constants ──────────────────────────────────────── */
const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 300 * 1024; // 300 KB
const MAX_REDIRECTS = 3;

/* ── SSRF guard – block private / reserved IPs ────── */
const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd/i,
  /^localhost$/i,
];

function isPrivateHost(hostname) {
  return PRIVATE_RANGES.some(re => re.test(hostname));
}

/* ── Tiny HTTP(S) fetcher with redirects ─────────── */
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
    const req = mod.get(urlStr, { timeout: FETCH_TIMEOUT_MS, headers: { 'User-Agent': 'DropCharge-Autofill/1.0' } }, (res) => {
      // Follow redirects
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

/* ── HTML meta-tag parser ────────────────────────── */
function parseMeta(html) {
  const meta = {};

  // Helper to grab content from <meta> by property or name
  function getContent(attr, val) {
    const re = new RegExp(`<meta[^>]+(?:${attr})\\s*=\\s*["']${val}["'][^>]+content\\s*=\\s*["']([^"']+)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]+(?:${attr})\\s*=\\s*["']${val}["']`, 'i');
    const m = html.match(re) || html.match(re2);
    return m ? m[1].trim() : null;
  }

  meta.ogTitle       = getContent('property', 'og:title');
  meta.ogDescription = getContent('property', 'og:description');
  meta.ogSiteName    = getContent('property', 'og:site_name');
  meta.ogImage       = getContent('property', 'og:image');
  meta.twitterImage  = getContent('name', 'twitter:image') || getContent('property', 'twitter:image');
  meta.metaDesc      = getContent('name', 'description');

  // <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  meta.titleTag = titleMatch ? titleMatch[1].trim() : null;

  // Favicons: <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
  const iconRe = /<link[^>]+rel\s*=\s*["'](?:shortcut )?icon["'][^>]+href\s*=\s*["']([^"']+)["']/i;
  const iconRe2 = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["'](?:shortcut )?icon["']/i;
  const appleRe = /<link[^>]+rel\s*=\s*["']apple-touch-icon["'][^>]+href\s*=\s*["']([^"']+)["']/i;
  const appleRe2 = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']apple-touch-icon["']/i;
  const iconMatch = html.match(appleRe) || html.match(appleRe2) || html.match(iconRe) || html.match(iconRe2);
  meta.favicon = iconMatch ? iconMatch[1].trim() : null;

  return meta;
}

/* ── Slugify ─────────────────────────────────────── */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/* ── Brand-to-gradient map ───────────────────────── */
const GRADIENT_MAP = {
  temu:        'linear-gradient(135deg, #f97316, #ef4444)',
  amazon:      'linear-gradient(135deg, #f59e0b, #f97316)',
  steam:       'linear-gradient(135deg, #1b2838, #2a475e)',
  nintendo:    'linear-gradient(135deg, #e40012, #8b0000)',
  xbox:        'linear-gradient(135deg, #107c10, #0e6b0e)',
  playstation: 'linear-gradient(135deg, #003087, #0070d1)',
  ebay:        'linear-gradient(135deg, #e53238, #f5af02)',
  aliexpress:  'linear-gradient(135deg, #e43225, #ff6a00)',
  shein:       'linear-gradient(135deg, #ec4899, #8b5cf6)',
};

function suggestGradient(brand) {
  const key = (brand || '').toLowerCase().replace(/[^a-z]/g, '');
  for (const [k, v] of Object.entries(GRADIENT_MAP)) {
    if (key.includes(k)) return v;
  }
  return 'linear-gradient(135deg, #7c3aed, #06b6d4)';
}

/* ── Resolve relative URLs ───────────────────────── */
function resolveUrl(href, baseUrl) {
  if (!href) return null;
  try { return new URL(href, baseUrl).href; } catch { return null; }
}

/* ── Main handler ────────────────────────────────── */
async function handler(event) {
  // Admin auth required
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  let url;
  try {
    const body = JSON.parse(event.body || '{}');
    url = (body.url || '').trim();
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
  try {
    parsed = new URL(url);
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_url' })
    };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_protocol' })
    };
  }

  let html, finalUrl;
  try {
    ({ html, finalUrl } = await fetchUrl(url));
  } catch (err) {
    return {
      statusCode: 422,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'fetch_failed', details: err.message })
    };
  }

  const meta = parseMeta(html);
  const domain = new URL(finalUrl).hostname.replace(/^www\./, '');

  // Derive brand
  const brand = meta.ogSiteName
    || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

  // Derive title
  const title = meta.ogTitle || meta.titleTag || brand;

  // Derive subtitle
  const subtitle = meta.ogDescription || meta.metaDesc || '';

  // Logo resolution: favicon > apple-touch-icon > Google favicon service
  let logo_url = null;
  if (meta.favicon) {
    logo_url = resolveUrl(meta.favicon, finalUrl);
  }
  if (!logo_url) {
    logo_url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  }

  // Hero image: og:image or twitter:image
  const hero_url = resolveUrl(meta.ogImage, finalUrl) || resolveUrl(meta.twitterImage, finalUrl) || null;

  // Suggested slug
  const slugText = brand + ' ' + (title !== brand ? title : '').slice(0, 30);
  const suggested_slug = slugify(slugText);

  // Gradient
  const gradient = suggestGradient(brand);

  // Badge text heuristic
  let badge_text = null;
  const combined = (title + ' ' + subtitle).toLowerCase();
  const discountMatch = combined.match(/(\d+)\s*%/);
  if (discountMatch) {
    badge_text = `-${discountMatch[1]}% DEAL`;
  }

  // Confidence
  let confidence = 'low';
  const sources = [];
  if (meta.ogTitle || meta.ogSiteName) sources.push('og_tags');
  if (meta.favicon) sources.push('favicon');
  if (!meta.ogTitle && !meta.ogSiteName) sources.push('heuristic');

  const filled = [brand, title !== brand, subtitle, logo_url, hero_url].filter(Boolean).length;
  if (filled >= 4) confidence = 'high';
  else if (filled >= 2) confidence = 'medium';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      data: {
        brand,
        title,
        subtitle: subtitle.slice(0, 200),
        logo_url,
        hero_url,
        suggested_slug,
        gradient,
        badge_text
      },
      debug: {
        source: sources.join('|') || 'heuristic',
        confidence
      }
    })
  };
}

exports.handler = withCors(handler);
