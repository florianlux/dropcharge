const { supabase, hasSupabase, isSchemaError, schemaMismatchResponse } = require('./_lib/supabase');
const { requireAdmin } = require('./_lib/admin-token');
const { withCors } = require('./_lib/cors');
const { isG2AUrl, normalizeG2AReflink } = require('./_lib/affiliates');

const URL_COLUMNS = ['affiliate_url', 'code_url', 'amazon_url', 'g2g_url'];

async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  const gtag = process.env.G2A_GTAG;
  if (!gtag) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'G2A_GTAG env variable not set' })
    };
  }

  if (!hasSupabase || !supabase) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Supabase not configured' })
    };
  }

  try {
    const { data: rows, error } = await supabase
      .from('spotlights')
      .select('id, affiliate_url, code_url, amazon_url, g2g_url');

    if (error) {
      if (isSchemaError(error)) return schemaMismatchResponse(error);
      throw error;
    }

    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    const examples = [];

    for (const row of (rows || [])) {
      scanned++;
      const changes = {};
      let hasChange = false;

      for (const col of URL_COLUMNS) {
        const original = row[col];
        if (!original || !isG2AUrl(original)) continue;
        const normalized = normalizeG2AReflink(original, gtag);
        if (normalized !== original) {
          changes[col] = normalized;
          hasChange = true;
          if (examples.length < 5) {
            examples.push({ id: row.id, column: col, before: original, after: normalized });
          }
        }
      }

      if (!hasChange) {
        skipped++;
        continue;
      }

      changes.updated_at = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('spotlights')
        .update(changes)
        .eq('id', row.id);

      if (updateErr) {
        errors.push({ id: row.id, error: updateErr.message });
      } else {
        updated++;
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, scanned, updated, skipped, errors, examples })
    };
  } catch (err) {
    if (isSchemaError(err)) return schemaMismatchResponse(err);
    console.log('admin-fix-g2a-links error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
}

exports.handler = withCors(handler);
