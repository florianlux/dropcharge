const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

/* ── Template presets ────────────────────────────────── */
const TEMPLATES = {
  temu: {
    theme: 'temu',
    badge_text: 'LIMITED • DEAL',
    cta_text: 'Jetzt sichern →',
    subtitle: 'Viral Deal – nur kurz verfügbar. Link öffnen & Angebot checken.',
    gradient: 'linear-gradient(135deg, #f97316, #a855f7)',
  },
  amazon: {
    theme: 'amazon',
    badge_text: 'Jetzt Preis prüfen',
    cta_text: 'Auf Amazon ansehen →',
    subtitle: 'Preis kann sich ändern. Schnell prüfen & sparen.',
    gradient: 'linear-gradient(135deg, #f59e0b, #06b6d4)',
  },
  g2a: {
    theme: 'g2a',
    badge_text: 'CHEAP KEY • INSTANT',
    cta_text: 'Key sichern →',
    subtitle: 'Digital Key – sofort verfügbar. Preis checken & Code holen.',
    gradient: 'linear-gradient(135deg, #3b82f6, #a855f7)',
  },
  neutral: {
    theme: 'neutral',
    badge_text: 'EXCLUSIVE',
    cta_text: 'Jetzt Deal sichern →',
    subtitle: 'Exklusiver Drop – Link öffnen und sparen.',
    gradient: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
  }
};

/* ── Slugify ─────────────────────────────────────────── */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/* ── Internal product-fetch call ─────────────────────── */
async function fetchProductData(productUrl, forceFetch, headers) {
  // Dynamically require the product-fetch handler
  const productFetchMod = require('./product-fetch');
  const fakeEvent = {
    httpMethod: 'POST',
    headers: headers,
    body: JSON.stringify({ url: productUrl, force: forceFetch })
  };
  const response = await productFetchMod.handler(fakeEvent);
  const body = JSON.parse(response.body);
  if (!body.ok) return null;
  return body.data;
}

/* ── Main handler ────────────────────────────────────── */
async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_json' })
    };
  }

  const productUrl = (payload.product_url || '').trim();
  if (!productUrl) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'product_url_required' })
    };
  }

  const affiliateUrl = (payload.affiliate_url || '').trim() || productUrl;
  const theme = TEMPLATES[payload.theme] ? payload.theme : 'neutral';
  const forceFetch = Boolean(payload.force_fetch);
  const overrides = payload.overrides || {};
  const template = TEMPLATES[theme];

  // Fetch product data
  let productData = null;
  try {
    productData = await fetchProductData(productUrl, forceFetch, event.headers);
  } catch (e) {
    console.error('product fetch error:', e.message);
  }

  // Derive spotlight fields
  const title = (overrides.title || '').trim()
    || (productData && productData.product_title)
    || 'Product Spotlight';

  const subtitle = (overrides.subtitle || '').trim()
    || (productData && productData.product_description)
    || template.subtitle;

  const heroUrl = (productData && productData.product_image_url) || null;
  const brand = (productData && productData.brand) || (theme !== 'neutral' ? theme.charAt(0).toUpperCase() + theme.slice(1) : 'DropCharge');

  const badgeText = (overrides.badge_text || '').trim() || template.badge_text;
  const ctaText = (overrides.cta_text || '').trim() || template.cta_text;
  const gradient = (overrides.gradient || '').trim() || template.gradient;

  // Generate slug
  const slugText = brand + ' ' + title.slice(0, 30);
  let slug = slugify(slugText);
  // Ensure uniqueness by appending random suffix
  const suffix = Math.random().toString(36).slice(2, 6);
  slug = slug + '-' + suffix;

  const record = {
    slug,
    title,
    subtitle: subtitle.slice(0, 300),
    brand,
    affiliate_url: affiliateUrl,
    gradient,
    hero_url: heroUrl,
    badge_text: badgeText,
    cta_text: ctaText,
    is_active: true,
    theme,
    product_url: productUrl,
    product_title: productData ? productData.product_title : null,
    product_description: productData ? (productData.product_description || '').slice(0, 500) : null,
    product_price: productData ? productData.product_price : null,
    product_currency: productData ? productData.product_currency : null,
    product_image_url: heroUrl,
    product_source: productData ? productData.source : null,
    product_last_fetched_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('spotlight_pages')
      .insert(record)
      .select()
      .maybeSingle();
    if (error) throw error;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, page: data })
    };
  } catch (err) {
    console.error('spotlight-create-from-product insert error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
