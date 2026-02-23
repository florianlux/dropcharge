/**
 * Stripe Webhook – handles Stripe events for Academy.
 * Verifies signature, processes checkout/subscription events.
 * Idempotent: stores event_id in stripe_events table.
 */
const { supabase, hasSupabase } = require('./_lib/supabase');
const crypto = require('crypto');

function verifyStripeSignature(payload, signature, secret) {
  if (!secret || !signature) return false;
  const elements = signature.split(',');
  const pairs = {};
  for (const el of elements) {
    const [key, val] = el.split('=');
    if (key && val) pairs[key] = val;
  }
  const timestamp = pairs['t'];
  const sig = pairs['v1'];
  if (!timestamp || !sig) return false;
  const signedPayload = timestamp + '.' + payload;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
  }

  if (!hasSupabase) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'database not configured' }) };
  }

  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = event.body || '';
  const sig = event.headers['stripe-signature'];

  // Verify webhook signature
  if (whSecret) {
    if (!verifyStripeSignature(rawBody, sig, whSecret)) {
      console.log('stripe_webhook: signature verification failed');
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid signature' }) };
    }
  }

  let stripeEvent;
  try { stripeEvent = JSON.parse(rawBody); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid json' }) };
  }

  const eventId = stripeEvent.id;
  const eventType = stripeEvent.type;

  if (!eventId || !eventType) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'missing event id or type' }) };
  }

  // Idempotency check
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'already processed' }) };
  }

  // Store event
  await supabase.from('stripe_events').insert({
    event_id: eventId,
    event_type: eventType
  });

  const obj = stripeEvent.data?.object || {};

  try {
    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(obj);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(obj);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(obj);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(obj);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(obj);
        break;
      default:
        console.log('stripe_webhook: unhandled event type', eventType);
    }
  } catch (err) {
    console.log('stripe_webhook: handler error for', eventType, err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'processing error' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};

async function handleCheckoutComplete(session) {
  const email = session.customer_email || session.metadata?.email;
  const plan = session.metadata?.plan || 'basic';
  const customerId = session.customer;

  if (!email) {
    console.log('stripe_webhook: checkout complete missing email');
    return;
  }

  // Store stripe customer mapping
  if (customerId) {
    await supabase.from('stripe_customers').upsert({
      user_id: email,
      stripe_customer_id: customerId
    }, { onConflict: 'user_id' });
  }

  // Create order record
  await supabase.from('academy_orders').insert({
    user_id: email,
    plan: plan,
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent,
    amount: session.amount_total,
    currency: session.currency || 'eur',
    status: 'completed'
  });

  // Grant access
  await supabase.from('academy_access').upsert({
    user_id: email,
    plan: plan,
    status: 'active',
    granted_by: 'stripe',
    valid_until: plan === 'pro' ? null : null, // Both are valid indefinitely initially
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
}

async function handleInvoicePaid(invoice) {
  const customerId = invoice.customer;
  if (!customerId) return;

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!customer) return;

  // Keep Pro active
  await supabase.from('academy_access')
    .update({ status: 'active', plan: 'pro', updated_at: new Date().toISOString() })
    .eq('user_id', customer.user_id);
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  if (!customerId) return;

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!customer) return;

  const status = subscription.status;
  if (status === 'active') {
    await supabase.from('academy_access')
      .update({ status: 'active', plan: 'pro', updated_at: new Date().toISOString() })
      .eq('user_id', customer.user_id);
  } else if (status === 'canceled' || status === 'unpaid') {
    // Downgrade to basic
    await supabase.from('academy_access')
      .update({ plan: 'basic', status: 'active', updated_at: new Date().toISOString() })
      .eq('user_id', customer.user_id);
  }
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  if (!customerId) return;

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!customer) return;

  // Downgrade to basic (keep content access)
  await supabase.from('academy_access')
    .update({ plan: 'basic', status: 'active', updated_at: new Date().toISOString() })
    .eq('user_id', customer.user_id);
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  if (!customerId) return;

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!customer) return;

  // Downgrade to basic on payment failure
  await supabase.from('academy_access')
    .update({ plan: 'basic', status: 'active', updated_at: new Date().toISOString() })
    .eq('user_id', customer.user_id);
}
