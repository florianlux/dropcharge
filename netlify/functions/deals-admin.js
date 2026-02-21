const { supabase, hasSupabase, isSchemaError, schemaMismatchResponse } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');

const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace('.', '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return value === 'true' || value === '1';
}

function buildInlinePatch(payload = {}) {
  const patch = {};
  if (payload.title !== undefined) {
    patch.title = (payload.title || '').toString().trim();
  }
  if (payload.price !== undefined) {
    patch.price = payload.price === '' ? null : payload.price;
  }
  if (payload.affiliate_url !== undefined) {
    patch.affiliate_url = payload.affiliate_url || null;
  }
  if (payload.priority !== undefined) {
    const parsed = Number(payload.priority);
    patch.priority = Number.isFinite(parsed) ? parsed : 0;
  }
  if (payload.active !== undefined) {
    if (typeof payload.active === 'boolean') {
      patch.active = payload.active;
    } else if (payload.active === 'true' || payload.active === '1') {
      patch.active = true;
    } else if (payload.active === 'false' || payload.active === '0') {
      patch.active = false;
    }
  }
  return patch;
}

async function fetchDeals(filters = {}) {
  let query = supabase.from('spotlights').select('*');
  if (filters.platform && filters.platform !== 'all') {
    query = query.eq('platform', filters.platform);
  }
  const activeFilter = parseBoolean(filters.active);
  if (activeFilter !== null) {
    query = query.eq('active', activeFilter);
  }
  if (filters.sinceDays && Number(filters.sinceDays) > 0) {
    const since = new Date(Date.now() - Number(filters.sinceDays) * DAY_MS).toISOString();
    query = query.gte('updated_at', since);
  }
  query = query.order('priority', { ascending: false }).order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function fetchClickData(slugs, sinceIso) {
  if (!slugs.length) return [];
  const { data, error } = await supabase
    .from('clicks')
    .select('slug, created_at')
    .in('slug', slugs)
    .gte('created_at', sinceIso);
  if (error) throw error;
  return data || [];
}

async function fetchEventData(slugs, sinceIso) {
  if (!slugs.length) return [];
  const { data, error } = await supabase
    .from('events')
    .select('slug, type, created_at')
    .in('slug', slugs)
    .in('type', ['cta_click', 'deal_click', 'email_submit'])
    .gte('created_at', sinceIso);
  if (error) throw error;
  return data || [];
}

function initMetricObject(slug) {
  return {
    slug,
    clicks24: 0,
    clicks7: 0,
    cta24: 0,
    cta7: 0,
    deals24: 0,
    deals7: 0,
    emails24: 0,
    emails7: 0,
    ctr24: 0,
    conversion24: 0,
    revenue24: 0,
    revenue7: 0
  };
}

function buildMetrics({ deals, clickRows, eventRows, since24 }) {
  const metrics = {};
  deals.forEach((deal) => {
    if (!deal.slug) return;
    metrics[deal.slug] = initMetricObject(deal.slug);
  });
  const since24Ms = new Date(since24).getTime();
  clickRows.forEach((row) => {
    if (!row.slug || !metrics[row.slug]) return;
    const created = new Date(row.created_at).getTime();
    metrics[row.slug].clicks7 += 1;
    if (created >= since24Ms) metrics[row.slug].clicks24 += 1;
  });
  eventRows.forEach((row) => {
    if (!row.slug || !metrics[row.slug]) return;
    const created = new Date(row.created_at).getTime();
    const bucket = metrics[row.slug];
    if (row.type === 'cta_click') {
      bucket.cta7 += 1;
      if (created >= since24Ms) bucket.cta24 += 1;
    }
    if (row.type === 'deal_click') {
      bucket.deals7 += 1;
      if (created >= since24Ms) bucket.deals24 += 1;
    }
    if (row.type === 'email_submit') {
      bucket.emails7 += 1;
      if (created >= since24Ms) bucket.emails24 += 1;
    }
  });
  Object.values(metrics).forEach((bucket) => {
    const clicksBasis = bucket.clicks24 || bucket.deals24;
    const ctaBasis = bucket.cta24 || bucket.deals24;
    bucket.ctr24 = ctaBasis > 0 ? (bucket.deals24 / ctaBasis) * 100 : 0;
    bucket.conversion24 = clicksBasis > 0 ? (bucket.emails24 / clicksBasis) * 100 : 0;
  });
  return metrics;
}

function attachRevenue(deals, metrics) {
  deals.forEach((deal) => {
    if (!deal.slug || !metrics[deal.slug]) return;
    const bucket = metrics[deal.slug];
    const price = deal.price_cents
      ? deal.price_cents / 100
      : deal.price
      ? toNumber(deal.price)
      : 0;
    bucket.revenue24 = Number((price * bucket.clicks24).toFixed(2));
    bucket.revenue7 = Number((price * bucket.clicks7).toFixed(2));
  });
}

function buildSummary(deals) {
  return deals.reduce(
    (acc, deal) => {
      if (!deal.metrics) return acc;
      acc.clicks24 += deal.metrics.clicks24 || 0;
      acc.clicks7 += deal.metrics.clicks7 || 0;
      acc.revenue24 += deal.metrics.revenue24 || 0;
      acc.revenue7 += deal.metrics.revenue7 || 0;
      acc.emails24 += deal.metrics.emails24 || 0;
      acc.emails7 += deal.metrics.emails7 || 0;
      return acc;
    },
    { clicks24: 0, clicks7: 0, revenue24: 0, revenue7: 0, emails24: 0, emails7: 0 }
  );
}

function sortDeals(deals, sortField, direction) {
  const dir = direction === 'asc' ? 1 : -1;
  const getValue = (deal) => {
    const metrics = deal.metrics || {};
    if (sortField === 'clicks') return metrics.clicks24 || 0;
    if (sortField === 'conversion') return metrics.conversion24 || 0;
    if (sortField === 'revenue') return metrics.revenue24 || 0;
    return deal.priority || 0;
  };
  return deals.sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    if (aVal === bVal) return 0;
    return aVal > bVal ? dir : -dir;
  });
}

async function handleList(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const filters = {
      platform: params.platform,
      active: params.active,
      sinceDays: params.since || null
    };
    const sort = params.sort || 'priority';
    const direction = params.direction === 'asc' ? 'asc' : 'desc';

    const deals = await fetchDeals(filters);
    const slugs = deals.map((deal) => deal.slug).filter(Boolean);
    const since7d = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const since24 = new Date(Date.now() - DAY_MS).toISOString();

    let metrics = {};
    if (slugs.length) {
      const [clickRows, eventRows] = await Promise.all([
        fetchClickData(slugs, since7d),
        fetchEventData(slugs, since7d)
      ]);
      metrics = buildMetrics({ deals, clickRows, eventRows, since24 });
      attachRevenue(deals, metrics);
    }

    const enrichedDeals = deals.map((deal) => ({
      ...deal,
      metrics: metrics[deal.slug] || initMetricObject(deal.slug || '')
    }));

    const sortedDeals = sortDeals(enrichedDeals, sort, direction);
    const summary = buildSummary(sortedDeals);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true, deals: sortedDeals, summary })
    };
  } catch (err) {
    if (isSchemaError(err)) return schemaMismatchResponse(err);
    console.log('deals list error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

async function handleInlineUpdate(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_json' })
    };
  }

  if (!payload.id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'id_required' })
    };
  }

  const patch = buildInlinePatch(payload);
  if (!Object.keys(patch).length) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'nothing_to_update' })
    };
  }
  patch.updated_at = new Date().toISOString();

  try {
    const { error } = await supabase
      .from('spotlights')
      .update(patch)
      .eq('id', payload.id);
    if (error) throw error;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    if (isSchemaError(err)) return schemaMismatchResponse(err);
    console.log('deal inline update error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: 'update_failed' })
    };
  }
}

async function handler(event) {
  const method = event.httpMethod || 'GET';
  if (method === 'GET') return handleList(event);
  if (method === 'PUT') return handleInlineUpdate(event);
  return { statusCode: 405, body: 'Method Not Allowed' };
};

exports.handler = withCors(handler);
