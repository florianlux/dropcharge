const { supabase, hasSupabase } = require('./_lib/supabase')
const { requireAdmin } = require('./_lib/admin-token')
const { withCors } = require('./_lib/cors');

const NETWORKS = {
  amazon: {
    label: 'Amazon',
    trackerParam: 'tag',
    defaultTracker: process.env.AFFILIATE_AMAZON_TAG || 'dropcharge-21'
  },
  g2a: {
    label: 'G2A',
    trackerParam: null
  },
  custom: {
    label: 'Custom',
    trackerParam: null
  }
}

function slugify(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 72) || null
}

function coerceUrl(raw = '') {
  try {
    const url = new URL(raw)
    // Only allow http and https protocols for security
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url
  } catch (err) {
    return null
  }
}

async function ensureUniqueSlug(slug) {
  if (!hasSupabase || !supabase) return slug
  let attempt = 0
  let candidate = slug
  while (attempt < 5) {
    const { data } = await supabase
      .from('spotlights')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
    attempt += 1
    candidate = `${slug}-${Math.floor(Math.random() * 900 + 100)}`
  }
  throw new Error('slug_conflict')
}

function buildAffiliateUrl(productUrl, networkKey, trackerId, utmParams = {}) {
  const network = NETWORKS[networkKey] || NETWORKS.custom
  const parsed = coerceUrl(productUrl)
  if (!parsed) return null
  if (network.trackerParam) {
    parsed.searchParams.set(
      network.trackerParam,
      trackerId || network.defaultTracker
    )
  }
  // Add UTM parameters if provided
  if (utmParams.utm_source) parsed.searchParams.set('utm_source', utmParams.utm_source)
  if (utmParams.utm_campaign) parsed.searchParams.set('utm_campaign', utmParams.utm_campaign)
  if (utmParams.utm_medium) parsed.searchParams.set('utm_medium', utmParams.utm_medium)
  return parsed.toString()
}

function sanitizeRecord(payload, affiliateUrl) {
  const now = new Date().toISOString()
  const networkLabel = NETWORKS[payload.network]?.label || 'Deal'
  return {
    title: (payload.title || '').trim(),
    subtitle: payload.subtitle || networkLabel,
    description: payload.description || `Automatisch generierter Deal (${networkLabel})`,
    platform: payload.platform || payload.network?.toUpperCase() || null,
    vendor: networkLabel,
    slug: payload.slug,
    price: payload.price || null,
    price_cents: typeof payload.price_cents === 'number' ? payload.price_cents : null,
    affiliate_url: affiliateUrl,
    code_label: payload.code_label || 'Zum Deal',
    code_url: payload.product_url,
    cover_url: payload.cover_url || null,
    amazon_url: payload.network === 'amazon' ? payload.product_url : null,
    g2g_url: payload.network === 'g2a' ? payload.product_url : null,
    release_date: payload.release_date || null,
    utm_source: payload.utm_source || null,
    utm_campaign: payload.utm_campaign || null,
    utm_medium: payload.utm_medium || null,
    active: typeof payload.auto_live === 'boolean' ? payload.auto_live : true,
    starts_at: payload.starts_at || now,
    ends_at: payload.ends_at || null,
    priority: typeof payload.priority === 'number' ? payload.priority : 120,
    created_at: now,
    updated_at: now
  }
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const authError = requireAdmin(event.headers || {})
  if (authError) return authError

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: 'Storage not configured' }
  }

  let payload = {}
  try {
    payload = JSON.parse(event.body || '{}')
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON payload' }
  }

  if (!payload.title || !payload.product_url) {
    return { statusCode: 400, body: 'title and product_url are required' }
  }

  const productUrl = coerceUrl(payload.product_url)
  if (!productUrl) {
    return { statusCode: 400, body: 'Invalid product_url' }
  }

  const networkKey = (payload.network || 'custom').toLowerCase()
  const utmParams = {
    utm_source: payload.utm_source,
    utm_campaign: payload.utm_campaign,
    utm_medium: payload.utm_medium
  }
  const affiliateUrl = buildAffiliateUrl(productUrl.toString(), networkKey, payload.tracker_id, utmParams)
  if (!affiliateUrl) {
    return { statusCode: 400, body: 'Unable to build affiliate URL' }
  }

  let slug = slugify(payload.slug || payload.title)
  if (!slug) {
    return { statusCode: 400, body: 'Could not derive a slug' }
  }

  try {
    slug = await ensureUniqueSlug(slug)
  } catch (err) {
    return { statusCode: 409, body: 'Slug conflict – please provide a different slug' }
  }

  const record = sanitizeRecord({ ...payload, network: networkKey, slug, product_url: productUrl.toString() }, affiliateUrl)

  try {
    const { data, error } = await supabase
      .from('spotlights')
      .insert(record)
      .select('id, title, slug')
      .single()
    if (error) throw error

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        slug: data.slug,
        go_url: `/go/${data.slug}`,
        affiliate_url: affiliateUrl
      })
    }
  } catch (err) {
    console.log('affiliate factory error', err.message)
    return { statusCode: 500, body: 'Failed to create deal' }
  }
}

exports.handler = withCors(handler);
