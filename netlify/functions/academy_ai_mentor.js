/**
 * Academy AI Mentor – Pro-only chat endpoint.
 * POST with x-academy-token header.
 * Body: { prompt: 'question' }
 * Checks Pro entitlement + monthly quota (50/month).
 * Calls LLM if OPENAI_API_KEY is configured; otherwise returns helpful fallback.
 */
const { withCors } = require('./_lib/cors');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { resolveSession } = require('./academy_session');

const MONTHLY_QUOTA = 50;

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
  }

  if (!hasSupabase) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'database not configured' }) };
  }

  const token = event.headers['x-academy-token'];
  const session = await resolveSession(token);
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
  }

  // Check Pro access
  const { data: access } = await supabase
    .from('academy_access')
    .select('plan, status')
    .eq('user_id', session.email)
    .maybeSingle();

  if (!access || access.status !== 'active' || access.plan !== 'pro') {
    return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Pro-Zugang erforderlich' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid json' }) };
  }

  const prompt = (body.prompt || '').trim();
  if (!prompt || prompt.length > 2000) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'prompt required (max 2000 chars)' }) };
  }

  // Check monthly quota
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count } = await supabase
    .from('academy_tool_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.email)
    .eq('tool', 'ai_mentor')
    .gte('used_at', monthStart);

  const used = count || 0;
  if (used >= MONTHLY_QUOTA) {
    return {
      statusCode: 429,
      body: JSON.stringify({ ok: false, error: 'Monatliches Limit erreicht (' + MONTHLY_QUOTA + ' Prompts). Nächsten Monat geht es weiter!', remaining: 0 })
    };
  }

  // Log usage
  await supabase.from('academy_tool_usage').insert({
    user_id: session.email,
    tool: 'ai_mentor'
  });

  const remaining = MONTHLY_QUOTA - used - 1;

  // Try LLM call if configured
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + openaiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'Du bist ein erfahrener Gaming-Affiliate-Marketing-Berater. Antworte kurz, praxisnah und auf Deutsch. Fokussiere dich auf DropCharge und Gaming-Credit-Deals. Gib keine illegalen, unethischen oder Spam-Tipps.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const reply = data.choices?.[0]?.message?.content || 'Keine Antwort erhalten.';
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true, reply: reply, remaining: remaining })
        };
      }
      console.log('ai_mentor: openai error', resp.status);
    } catch (e) {
      console.log('ai_mentor: openai exception', e.message);
    }
  }

  // Fallback response
  const fallbackReplies = [
    'Gute Frage! Für Gaming-Affiliate-Marketing empfehle ich dir, mit TikTok-Kurzvideos zu starten. Zeige echte Deals und nutze Trending Sounds.',
    'Ein wichtiger Tipp: Fokussiere dich auf eine Plattform (z.B. PSN oder Xbox) und werde dort zum Experten. Diversifiziere später.',
    'Conversion-Optimierung ist der Schlüssel: Stelle sicher, dass dein CTA klar sichtbar ist und deine Landingpage mobile-optimiert ist.',
    'Email-Listen sind Gold wert im Affiliate-Marketing. Sammle von Anfang an Emails und sende regelmäßig Deal-Updates.',
    'Denke langfristig: Baue Vertrauen auf, bevor du monetarisierst. Authentische Empfehlungen konvertieren besser als aggressive Sales-Pitches.'
  ];
  const reply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)] +
    '\n\n(Hinweis: Der AI Mentor ist derzeit im Fallback-Modus. Die vollständige KI-Integration wird in Kürze aktiviert.)';

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, reply: reply, remaining: remaining })
  };
});
