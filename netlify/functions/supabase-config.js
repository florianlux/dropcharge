// Provides Supabase public configuration to the frontend
const { withCors } = require('./_lib/cors');

async function handler(event) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  
  // Return as a JavaScript module that sets window variables
  // This is safer than returning arbitrary code for eval()
  const config = {
    url: supabaseUrl,
    anonKey: supabaseAnonKey
  };
  
  return {
    statusCode: 200,
    headers: { 
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=300'
    },
    body: `(function() {
  window.SUPABASE_URL = ${JSON.stringify(config.url)};
  window.SUPABASE_ANON_KEY = ${JSON.stringify(config.anonKey)};
})();`
  };
}

exports.handler = withCors(handler);
