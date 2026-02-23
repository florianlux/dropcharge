/**
 * Academy Admin – admin-only endpoints for managing academy.
 * Requires x-admin-token header.
 * GET ?action=users|content|orders|events
 * POST { action: 'grant'|'revoke'|'save_module'|'save_lesson', ... }
 */
const { withCors } = require('./_lib/cors');
const { requireAdmin } = require('./_lib/admin-token');
const { supabase, hasSupabase } = require('./_lib/supabase');

exports.handler = withCors(async (event) => {
  // Auth check
  const authErr = requireAdmin(event.headers);
  if (authErr) return authErr;

  if (!hasSupabase) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'database not configured' }) };
  }

  if (event.httpMethod === 'GET') {
    return handleGet(event);
  }
  if (event.httpMethod === 'POST') {
    return handlePost(event);
  }
  return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
});

async function handleGet(event) {
  const params = event.queryStringParameters || {};
  const action = params.action;

  switch (action) {
    case 'users': {
      const { data, error } = await supabase
        .from('academy_access')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true, users: data || [] }) };
    }
    case 'content': {
      const { data: modules } = await supabase.from('academy_modules').select('*').order('sort_order');
      const { data: lessons } = await supabase.from('academy_lessons').select('*').order('sort_order');
      return { statusCode: 200, body: JSON.stringify({ ok: true, modules: modules || [], lessons: lessons || [] }) };
    }
    case 'orders': {
      const { data } = await supabase.from('academy_orders').select('*').order('created_at', { ascending: false }).limit(100);
      return { statusCode: 200, body: JSON.stringify({ ok: true, orders: data || [] }) };
    }
    case 'events': {
      const { data } = await supabase.from('stripe_events').select('*').order('processed_at', { ascending: false }).limit(100);
      return { statusCode: 200, body: JSON.stringify({ ok: true, events: data || [] }) };
    }
    default:
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'unknown action' }) };
  }
}

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid json' }) };
  }

  const action = body.action;

  switch (action) {
    case 'grant': {
      const userId = (body.user_id || '').trim();
      const plan = ['basic', 'pro'].includes(body.plan) ? body.plan : 'basic';
      const validUntil = body.valid_until || null;
      if (!userId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'user_id required' }) };

      const { error } = await supabase.from('academy_access').upsert({
        user_id: userId,
        plan: plan,
        status: 'active',
        granted_by: 'admin',
        valid_until: validUntil,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (error) return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    case 'revoke': {
      const userId = (body.user_id || '').trim();
      if (!userId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'user_id required' }) };

      const { error } = await supabase.from('academy_access')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    case 'save_module': {
      const title = (body.title || '').trim();
      if (!title) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'title required' }) };

      const record = {
        title: title,
        description: body.description || '',
        plan_required: ['basic', 'pro'].includes(body.plan_required) ? body.plan_required : 'basic',
        sort_order: parseInt(body.sort_order) || 0,
        active: body.active !== false,
        updated_at: new Date().toISOString()
      };

      if (body.id) {
        const { error } = await supabase.from('academy_modules').update(record).eq('id', body.id);
        if (error) return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
      } else {
        const { error } = await supabase.from('academy_modules').insert(record);
        if (error) return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    case 'save_lesson': {
      const title = (body.title || '').trim();
      const moduleId = body.module_id;
      if (!title) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'title required' }) };
      if (!moduleId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'module_id required' }) };

      const record = {
        module_id: moduleId,
        title: title,
        content: body.content || '',
        plan_required: ['basic', 'pro'].includes(body.plan_required) ? body.plan_required : 'basic',
        sort_order: parseInt(body.sort_order) || 0,
        active: body.active !== false,
        updated_at: new Date().toISOString()
      };

      if (body.id) {
        const { error } = await supabase.from('academy_lessons').update(record).eq('id', body.id);
        if (error) return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
      } else {
        const { error } = await supabase.from('academy_lessons').insert(record);
        if (error) return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    default:
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'unknown action' }) };
  }
}
