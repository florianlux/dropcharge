/**
 * ts-column.js – Detect the correct timestamp column on the events table.
 *
 * Migration 009 adds a `ts` column to `events`.  If the migration has not yet
 * been applied the column won't exist and queries that reference `ts` will fail
 * with "column events.ts does not exist".
 *
 * This helper probes the schema once per Lambda container lifetime and caches
 * the result so every subsequent call is free.
 *
 * Usage:
 *   const { getTimestampColumn } = require('./_lib/ts-column');
 *   const tsCol = await getTimestampColumn(supabase);
 *   // tsCol is 'ts' or 'created_at'
 */

const { isSchemaError } = require('./supabase');

let _cached = null;

async function getTimestampColumn(supabase) {
  if (_cached) return _cached;

  try {
    const { error } = await supabase
      .from('events')
      .select('ts')
      .limit(1);

    if (error && isSchemaError(error)) {
      _cached = 'created_at';
    } else {
      _cached = 'ts';
    }
  } catch {
    _cached = 'created_at';
  }

  return _cached;
}

// Exported for testing
function _resetCache() { _cached = null; }

module.exports = { getTimestampColumn, _resetCache };
