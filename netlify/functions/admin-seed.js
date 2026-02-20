const { requireAdmin } = require('./_lib/admin-token');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { withCors } = require('./_lib/cors');

const platforms = ['PSN', 'Xbox', 'Nintendo'];
const amounts = ['10€', '20€', '50€', '1 Monat', '3 Monate'];
const slugs = ['psn-10', 'psn-20', 'xbox-1m', 'nintendo-15'];
const funnelStages = ['landing_view', 'cta_click', 'deal_click', 'email_submit'];

const platformMixes = {
  balanced: [0.34, 0.33, 0.33],
  ps_focus: [0.6, 0.25, 0.15],
  xbox_focus: [0.2, 0.6, 0.2],
  nintendo_focus: [0.2, 0.2, 0.6]
};

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function choosePlatform(mix = 'balanced') {
  const weights = platformMixes[mix] || platformMixes.balanced;
  const roll = Math.random();
  if (roll < weights[0]) return 'PSN';
  if (roll < weights[0] + weights[1]) return 'Xbox';
  return 'Nintendo';
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, number));
}

async function handler(event) {
  const authError = requireAdmin(event.headers || {});
  if (authError) return authError;

  if (!hasSupabase || !supabase) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }) };
  }

  let options = {};
  if (event.body) {
    try {
      options = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
    }
  }

  const clicksRequested = clamp(Number(options.clicks || 25), 0, 200);
  const includeEmails = Boolean(options.includeEmails);
  const includeEvents = options.includeEvents !== false; // default true
  const mix = options.platformMix || 'balanced';

  try {
    if (clicksRequested > 0) {
      const clicksPayload = Array.from({ length: clicksRequested }).map(() => {
        const platform = choosePlatform(mix);
        const slug = platform === 'PSN' ? randomItem(['psn-10', 'psn-20', 'psn-50'])
          : platform === 'Xbox' ? randomItem(['xbox-1m', 'xbox-3m', 'xbox-6m'])
          : randomItem(['nintendo-15', 'nintendo-25', 'nintendo-50']);
        return {
          slug,
          platform,
          amount: randomItem(amounts),
          created_at: new Date(Date.now() - Math.random() * 3600000).toISOString()
        };
      });
      const { error: clicksError } = await supabase.from('clicks').insert(clicksPayload);
      if (clicksError) throw clicksError;
    }

    if (includeEmails) {
      const emailsPayload = Array.from({ length: 5 }).map((_, idx) => ({
        email: `${Date.now()}-${idx}@seed.local`,
        confirmed: true,
        created_at: new Date().toISOString()
      }));
      const { error: emailsError } = await supabase.from('emails').insert(emailsPayload);
      if (emailsError) throw emailsError;
    }

    if (includeEvents) {
      const eventsPayload = Array.from({ length: Math.max(5, clicksRequested / 2) }).map(() => {
        const stage = randomItem(funnelStages);
        const platform = choosePlatform(mix);
        return {
          type: stage,
          name: stage,
          platform,
          slug: randomItem(slugs),
          path: '/#cta',
          session_id: `seed-${Math.random().toString(36).slice(2, 8)}`,
          device_hint: Math.random() > 0.6 ? 'mobile' : 'desktop',
          meta: { seed: true },
          created_at: new Date(Date.now() - Math.random() * 3600000).toISOString()
        };
      });
      const { error: eventsError } = await supabase.from('events').insert(eventsPayload);
      if (eventsError) throw eventsError;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.log('seed error', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};

exports.handler = withCors(handler);
