// Provides Supabase public configuration to the frontend
const { withCors } = require('./_lib/cors');

async function handler(event) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  
  return {
    statusCode: 200,
    headers: { 
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=300'
    },
    body: `window.SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};`
  };
}

exports.handler = withCors(handler);
