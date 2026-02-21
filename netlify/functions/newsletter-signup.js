const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handler(event) {
  console.log('[newsletter-signup] Request received:', event.httpMethod);

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
    };
  }

  // Parse request body
  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    console.error('[newsletter-signup] Invalid JSON:', err.message);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Invalid JSON' })
    };
  }

  // Validate email
  const email = (payload.email || '').trim().toLowerCase();
  if (!email) {
    console.log('[newsletter-signup] Empty email');
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Email is required' })
    };
  }

  if (!isValidEmail(email)) {
    console.log('[newsletter-signup] Invalid email format:', email);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Invalid email format' })
    };
  }

  // Check Supabase connection
  if (!hasSupabase || !supabase) {
    console.error('[newsletter-signup] Supabase not configured');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Database not configured' })
    };
  }

  try {
    // Check if email already exists
    console.log('[newsletter-signup] Checking for existing email:', email);
    const { data: existing, error: selectErr } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, status')
      .eq('email', email)
      .maybeSingle();

    if (selectErr) {
      console.error('[newsletter-signup] Select error:', selectErr.message);
      throw selectErr;
    }

    if (existing) {
      console.log('[newsletter-signup] Email already exists:', email, 'status:', existing.status);
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          error: 'Email already subscribed'
        })
      };
    }

    // Prepare insert data
    const insertData = {
      email,
      status: 'active',
      created_at: new Date().toISOString(),
      source: payload.source || 'popup',
      utm_source: payload.utm?.utm_source || null,
      utm_medium: payload.utm?.utm_medium || null,
      utm_campaign: payload.utm?.utm_campaign || null,
      utm_term: payload.utm?.utm_term || null,
      utm_content: payload.utm?.utm_content || null,
      meta: payload.meta || {}
    };

    console.log('[newsletter-signup] Inserting new subscriber:', email);
    const { data: inserted, error: insertErr } = await supabase
      .from('newsletter_subscribers')
      .insert(insertData)
      .select()
      .single();

    if (insertErr) {
      console.error('[newsletter-signup] Insert error:', insertErr.message, insertErr);
      throw insertErr;
    }

    console.log('[newsletter-signup] Successfully subscribed:', email);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        message: 'Subscribed successfully'
      })
    };

  } catch (error) {
    console.error('[newsletter-signup] Error:', error.message, error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'Subscription failed',
        details: error.message
      })
    };
  }
}

exports.handler = withCors(handler);
