const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

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

  if (hasSupabase && supabase) {
    try {
      const { error } = await supabase.from('emails').insert({
        email,
        confirmed: false,
        source: 'spin_wheel',
        meta: { prize: prizeLabel },
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
