const { supabase, hasSupabase } = require('./supabase');

/**
 * Creates a new system snapshot by incrementing the snapshot number
 * @param {string} reason - The reason for the snapshot (e.g., 'deal_created', 'subscriber_added')
 * @returns {Promise<{ok: boolean, snapshot_number?: number, error?: string}>}
 */
async function createSnapshot(reason) {
  if (!hasSupabase || !supabase) {
    console.log('Snapshot creation skipped: Supabase not configured');
    return { ok: false, error: 'supabase_not_configured' };
  }

  try {
    // Get the current highest snapshot number
    const { data: latest, error: selectError } = await supabase
      .from('system_snapshots')
      .select('snapshot_number')
      .order('snapshot_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.log('Error fetching latest snapshot:', selectError.message);
      throw selectError;
    }

    // Determine the next snapshot number (start at 1 if none exist)
    const nextNumber = latest ? latest.snapshot_number + 1 : 1;

    // Insert the new snapshot
    const { error: insertError } = await supabase
      .from('system_snapshots')
      .insert({
        snapshot_number: nextNumber,
        reason: reason || null,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.log('Error inserting snapshot:', insertError.message);
      throw insertError;
    }

    console.log(`Snapshot created: #${nextNumber} - ${reason}`);
    return { ok: true, snapshot_number: nextNumber };
  } catch (err) {
    console.log('Snapshot creation error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Gets the latest system snapshot
 * @returns {Promise<{ok: boolean, data?: {snapshot_number: number, created_at: string}, error?: string}>}
 */
async function getLatestSnapshot() {
  if (!hasSupabase || !supabase) {
    return { ok: false, error: 'supabase_not_configured' };
  }

  try {
    const { data, error } = await supabase
      .from('system_snapshots')
      .select('snapshot_number, created_at')
      .order('snapshot_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // No snapshots exist yet - initialize with snapshot #1
      await createSnapshot('system_init');
      return {
        ok: true,
        data: {
          snapshot_number: 1,
          created_at: new Date().toISOString()
        }
      };
    }

    return {
      ok: true,
      data: {
        snapshot_number: data.snapshot_number,
        created_at: data.created_at
      }
    };
  } catch (err) {
    console.log('Get latest snapshot error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  createSnapshot,
  getLatestSnapshot
};
