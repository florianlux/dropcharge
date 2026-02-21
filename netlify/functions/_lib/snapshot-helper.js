const { supabase, hasSupabase } = require('./supabase');

/**
 * Creates a new system snapshot by incrementing the snapshot number
 * @param {string} reason - The reason for the snapshot (e.g., 'deal_created', 'subscriber_added')
 * @param {number} maxRetries - Maximum number of retry attempts for race condition handling
 * @returns {Promise<{ok: boolean, snapshot_number?: number, error?: string}>}
 */
async function createSnapshot(reason, maxRetries = 3) {
  if (!hasSupabase || !supabase) {
    console.log('Snapshot creation skipped: Supabase not configured');
    return { ok: false, error: 'supabase_not_configured' };
  }

  let attempt = 0;
  while (attempt < maxRetries) {
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
        // Check if it's a unique constraint violation (race condition)
        const isUniqueViolation = insertError.message?.toLowerCase().includes('duplicate') || 
                                   insertError.message?.toLowerCase().includes('unique');
        
        if (isUniqueViolation && attempt < maxRetries - 1) {
          console.log(`Snapshot number ${nextNumber} already exists, retrying (attempt ${attempt + 1}/${maxRetries})...`);
          attempt++;
          // Add a small delay before retrying to reduce collision probability
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
          continue;
        }
        
        console.log('Error inserting snapshot:', insertError.message);
        throw insertError;
      }

      console.log(`Snapshot created: #${nextNumber} - ${reason}`);
      return { ok: true, snapshot_number: nextNumber };
    } catch (err) {
      // If this is the last attempt or not a retryable error, fail
      if (attempt >= maxRetries - 1) {
        console.log('Snapshot creation error:', err.message);
        return { ok: false, error: err.message };
      }
      attempt++;
    }
  }

  return { ok: false, error: 'max_retries_exceeded' };
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
      // No snapshots exist yet - try to initialize with snapshot #1
      // Use the createSnapshot function which has retry logic
      const result = await createSnapshot('system_init');
      
      if (result.ok) {
        return {
          ok: true,
          data: {
            snapshot_number: result.snapshot_number || 1,
            created_at: new Date().toISOString()
          }
        };
      }
      
      // If creation failed, try one more time to fetch in case another request succeeded
      const { data: retryData, error: retryError } = await supabase
        .from('system_snapshots')
        .select('snapshot_number, created_at')
        .order('snapshot_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (retryError) throw retryError;
      
      if (retryData) {
        return {
          ok: true,
          data: {
            snapshot_number: retryData.snapshot_number,
            created_at: retryData.created_at
          }
        };
      }
      
      // Still no data, return error
      return { ok: false, error: 'initialization_failed' };
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
