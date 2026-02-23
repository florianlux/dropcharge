/**
 * Academy Content – returns modules, lessons, and user progress.
 * GET with x-academy-token header.
 */
const { withCors } = require('./_lib/cors');
const { supabase, hasSupabase } = require('./_lib/supabase');
const { resolveSession } = require('./academy_session');

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'GET') {
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

  // Fetch modules
  const { data: modules, error: modErr } = await supabase
    .from('academy_modules')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (modErr) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'failed to load modules' }) };
  }

  // Fetch lessons
  const { data: lessons, error: lesErr } = await supabase
    .from('academy_lessons')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (lesErr) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'failed to load lessons' }) };
  }

  // Fetch user progress
  const { data: progress } = await supabase
    .from('academy_progress')
    .select('lesson_id, completed')
    .eq('user_id', session.email);

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      modules: modules || [],
      lessons: lessons || [],
      progress: progress || []
    })
  };
});
