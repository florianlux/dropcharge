/**
 * Academy Progress – mark a lesson as completed.
 * POST with x-academy-token header.
 * Body: { lesson_id, completed: true }
 */
const { withCors } = require('./_lib/cors');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { resolveSession } = require('./academy_session');

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

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid json' }) };
  }

  const { lesson_id, completed } = body;
  if (!lesson_id) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'lesson_id required' }) };
  }

  const { error } = await supabase
    .from('academy_progress')
    .upsert({
      user_id: session.email,
      lesson_id: lesson_id,
      completed: completed !== false,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,lesson_id' });

  if (error) {
    console.log('academy_progress: upsert error', error.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'failed to save progress' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
});
