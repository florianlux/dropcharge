const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');
const { BASE_URL } = require('./_lib/email-templates');
const { sendWelcomeEmail } = require('./_lib/send-welcome');
const crypto = require('crypto');

const PRIZES = [
  { label: '5% Discount', weight: 30 },
  { label: '10% Discount', weight: 25 },
  { label: '15% Discount', weight: 15 },
  { label: 'Free Shipping', weight: 15 },
  { label: '20% Discount', weight: 10 },
  { label: 'Mystery Bonus', weight: 5 },
];

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let rand = Math.random() * total;
  for (const prize of PRIZES) {
    rand -= prize.weight;
    if (rand <= 0) return prize.label;
  }
  return PRIZES[0].label;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' }),
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_json' }),
    };
  }

  const email = (payload.email || '').trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'invalid_email' }),
    };
  }

  if (!payload.consent) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'consent_required' }),
    };
  }

  const prizeLabel = pickPrize();
  const unsubscribeToken = crypto.randomBytes(24).toString('hex');

  if (hasSupabase && supabase) {
    try {
      const { error } = await supabase.from('newsletter_subscribers').insert({
        email,
        status: 'active',
        source: 'spin_wheel',
        prize: prizeLabel,
        meta: { prize: prizeLabel },
        unsubscribe_token: unsubscribeToken,
        created_at: new Date().toISOString(),
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already')) {
          return {
            statusCode: 409,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: false, error: 'already_entered' }),
          };
        }
        console.error('spin-enter insert error:', error.message);
      } else {
        // Send welcome email (non-fatal – errors are caught and logged)
        try {
          const unsubscribeUrl = `${BASE_URL}/.netlify/functions/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
          await sendWelcomeEmail({ email, unsubscribeUrl });
        } catch (emailErr) {
          console.error('spin-enter welcome email error:', emailErr.message);
        }
      }
    } catch (err) {
      console.error('spin-enter db error:', err.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, prizeLabel }),
  };
}

exports.handler = withCors(handler);
