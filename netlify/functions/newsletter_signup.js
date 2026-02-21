const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://dropcharge.netlify.app').replace(/\/$/, '');

async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
    }

    let payload = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (_err) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
    }

    const email = (payload.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_email' }) };
    }

    if (!hasSupabase || !supabase) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
    }

    // Upsert into newsletter_leads
    const { data: lead, error: upsertError } = await supabase
      .from('newsletter_leads')
      .upsert(
        {
          email,
          status: 'pending',
          source: payload.source || null,
          page: payload.page || null,
          user_agent: (event.headers || {})['user-agent'] || null,
          metadata: payload.utm ? { utm: payload.utm, consent: payload.consent } : {}
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select('id, status, unsubscribe_token, created_at')
      .single();

    if (upsertError) throw upsertError;

    // Determine if this is a new signup or existing
    const isNew = !lead.created_at || (Date.now() - new Date(lead.created_at).getTime()) < 5000;
    const status = isNew ? 'inserted' : 'exists';

    // Log event
    await supabase.from('newsletter_events').insert({
      lead_id: lead.id,
      type: isNew ? 'created' : 'lead_updated',
      meta: { source: payload.source || 'popup' }
    });

    // Send welcome email for new signups via Resend
    if (isNew && process.env.RESEND_API_KEY) {
      try {
        const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
        const unsubscribeUrl = `${BASE_URL}/unsubscribe?token=${lead.unsubscribe_token}`;
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: emailFrom,
            to: email,
            subject: 'Willkommen bei DropCharge 🚀',
            html: [
              '<p>Hey! Danke fürs Anmelden bei DropCharge.</p>',
              '<p>Ab jetzt bekommst du die besten Gaming-Deals direkt in dein Postfach.</p>',
              `<p style="margin-top:24px;font-size:12px;color:#666">Du willst keine Deals mehr? <a href="${unsubscribeUrl}">Hier abmelden</a></p>`
            ].join('\n')
          })
        });
        if (res.ok) {
          await supabase.from('newsletter_events').insert({
            lead_id: lead.id,
            type: 'welcome_sent',
            meta: {}
          });
        }
      } catch (mailErr) {
        console.log('welcome mail error', mailErr.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, status })
    };
  } catch (error) {
    console.error('newsletter_signup error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: error.message })
    };
  }
}

exports.handler = withCors(handler);
