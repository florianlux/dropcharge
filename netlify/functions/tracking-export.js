/**
 * tracking-export.js – Admin GET endpoint.
 * Returns a CSV export of events for the selected range.
 *
 * Query params:
 *   range  – 24h|7d|30d (default: 7d)
 *   type   – events|spotlights (default: events)
 */

const { supabase, hasSupabase } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { getTimestampColumn } = require('./_lib/ts-column');

function sinceDate(range) {
  const hours = range === '24h' ? 24 : range === '30d' ? 720 : 168;
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function csvEscape(val) {
  const s = String(val == null ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function row(fields) {
  return fields.map(csvEscape).join(',');
}

exports.handler = withCors(async (event) => {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'supabase_not_configured' })
    };
  }

  const p = event.queryStringParameters || {};
  const range = p.range || '7d';
  const since = sinceDate(range);
  const exportType = p.type === 'spotlights' ? 'spotlights' : 'events';

  try {
    const tsCol = await getTimestampColumn(supabase);

    if (exportType === 'spotlights') {
      // Spotlight CTA stats aggregated
      const { data, error } = await supabase
        .from('events')
        .select(`slug,${tsCol},event_name,utm_source,utm_campaign,country`)
        .eq('event_name', 'cta_click')
        .gte(tsCol, since)
        .order(tsCol, { ascending: false })
        .limit(5000);
      if (error) throw error;

      const header = row(['slug', 'event_name', 'ts', 'utm_source', 'utm_campaign', 'country']);
      const lines = (data || []).map(r =>
        row([r.slug, r.event_name, r[tsCol], r.utm_source, r.utm_campaign, r.country])
      );
      const csv = [header, ...lines].join('\n');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tracking-spotlights-${range}.csv"`,
          'Cache-Control': 'no-store'
        },
        body: csv
      };
    }

    // Default: events CSV
    const EVENTS_COLUMNS = ['id', 'ts', 'event_name', 'slug', 'path', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'session_key', 'user_id', 'device_type', 'os', 'browser', 'country', 'referrer'];
    const selectStr = EVENTS_COLUMNS.map(c => c === 'ts' ? tsCol : c).join(',').replace('event_name', 'event_name,name,device_hint');
    const { data, error } = await supabase
      .from('events')
      .select(selectStr)
      .gte(tsCol, since)
      .order(tsCol, { ascending: false })
      .limit(10000);
    if (error) throw error;

    const header = row(EVENTS_COLUMNS);
    const lines = (data || []).map(r =>
      row([r.id, r[tsCol], r.event_name || r.name, r.slug, r.path, r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.utm_term, r.session_key, r.user_id, r.device_type || r.device_hint, r.os, r.browser, r.country, r.referrer])
    );
    const csv = [header, ...lines].join('\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tracking-events-${range}.csv"`,
        'Cache-Control': 'no-store'
      },
      body: csv
    };
  } catch (err) {
    console.error('tracking-export error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
});
