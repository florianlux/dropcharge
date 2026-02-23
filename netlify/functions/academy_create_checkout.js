/**
 * Academy Create Checkout – creates a Stripe Checkout Session.
 * POST body: { plan: 'basic'|'pro', email: 'user@email.de' }
 * Returns: { ok: true, url: 'https://checkout.stripe.com/...' }
 */
const { withCors } = require('./_lib/cors');

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'stripe not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid json' }) };
  }

  const plan = body.plan;
  const email = (body.email || '').trim().toLowerCase();

  if (!['basic', 'pro'].includes(plan)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'plan must be basic or pro' }) };
  }
  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'valid email required' }) };
  }

  const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_BASIC;
  if (!priceId) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'stripe price not configured for plan: ' + plan }) };
  }

  const baseUrl = process.env.PUBLIC_SITE_URL || 'https://dropcharge.io';
  const mode = plan === 'pro' ? 'subscription' : 'payment';

  // Build Stripe Checkout Session via API
  const params = new URLSearchParams();
  params.append('mode', mode);
  params.append('customer_email', email);
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', baseUrl + '/academy/app/?checkout=success');
  params.append('cancel_url', baseUrl + '/academy/#pricing');
  params.append('metadata[plan]', plan);
  params.append('metadata[email]', email);

  try {
    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + stripeKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const session = await resp.json();

    if (!resp.ok) {
      console.log('stripe checkout error:', session.error?.message);
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'checkout creation failed', details: session.error?.message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, url: session.url })
    };
  } catch (err) {
    console.log('stripe checkout exception:', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'internal error' }) };
  }
});
